"""Project Calculator API — расчёт проекта стены.

Спецификация: `docs/product-specs/PRODUCT-CARD.md` §4.

Формулы (PC-CALC-301..304):
  * площадь стены   = (высота_см × ширина_см) / 10 000
  * коробок         = ceil(площадь × 1.1 / площадь коробки)   ← страховой запас 10 %
  * фактический м²  = коробки × площадь коробки
  * панелей, шт.    = коробки × панелей в коробке

Цены (PC-API-002/003): базовая цена панели берётся из каталога панелей
(`panels.base_price` по типоразмеру), цена дизайн-накладки — из самого
дизайна, а при его отсутствии — из `shop_settings.design_overlay_price`.
Подписка (PC-API-004) подбирается из активных тарифов по фактической
площади проекта. Комбинированный режим (PC-API-005) считает каждую
позицию отдельно и суммирует результат.
"""
from __future__ import annotations

from math import ceil

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.container import (
    get_design_repo,
    get_panel_repo,
    get_shop_settings_repo,
    get_subscription_plan_repo,
)

router = APIRouter()

# ─── Панель-типоразмеры (PC-CALC §4.6 — источник истины) ────────────
PANEL_SPECS = {
    "300x300": {
        "label": "300×300 мм",
        "panels_per_box": 12,
        "panel_area_m2": 0.09,
        "box_area_m2": 1.08,
    },
    "300x600": {
        "label": "300×600 мм",
        "panels_per_box": 6,
        "panel_area_m2": 0.18,
        "box_area_m2": 1.08,
    },
    "600x600": {
        "label": "600×600 мм",
        "panels_per_box": 4,
        "panel_area_m2": 0.36,
        "box_area_m2": 1.44,
    },
}

# Fallback-цены базовой панели. Используются только если каталог панелей
# пуст или в нём нет SKU нужного типоразмера. Значения совпадают с
# `frontend/src/shared/config/constants.ts:BASE_PANEL_PRICES`.
FALLBACK_BASE_PRICES = {
    "300x300": 890,
    "300x600": 1490,
    "600x600": 2490,
}

FALLBACK_OVERLAY_PRICE = 1200
SAFETY_MARGIN = 1.1


class CombinedItemRequest(BaseModel):
    """Позиция комбинированного дизайна (PC-CALC-203).

    Доля площади (share) — для деления стены между позициями.
    Количество коробок (boxes) — для суммирования позиций по коробкам:
    пользователь вводит, сколько коробок каждой позиции покупает, и backend
    считает панели/метраж/цену строго по коробкам (без округления вверх).
    """

    panel_size: str = Field(..., description="Типоразмер панели")
    share: float | None = Field(
        default=None, gt=0, le=1, description="Доля площади стены (0..1]",
    )
    boxes: int | None = Field(
        default=None, ge=1, le=10_000, description="Коробок этой позиции",
    )

    @field_validator("panel_size")
    @classmethod
    def validate_panel_size(cls, v: str) -> str:
        if v not in PANEL_SPECS:
            raise ValueError(
                f"Неверный типоразмер: {v}. Доступны: {list(PANEL_SPECS.keys())}"
            )
        return v


class CalculateRequest(BaseModel):
    """Запрос на расчёт проекта."""

    height: float = Field(..., ge=50, le=1000, description="Высота в см")
    width: float = Field(..., ge=50, le=2000, description="Ширина в см")
    panel_size: str = Field(default="300x300", description="Типоразмер панели")
    design_type: str = Field(default="mono", description="mono или combined")
    design_id: str | None = Field(
        default=None, description="ID дизайна — для цены накладки",
    )
    items: list[CombinedItemRequest] | None = Field(
        default=None,
        description="Позиции комбинированного дизайна (design_type=combined)",
    )

    @field_validator("panel_size")
    @classmethod
    def validate_panel_size(cls, v: str) -> str:
        if v not in PANEL_SPECS:
            raise ValueError(
                f"Неверный типоразмер: {v}. Доступны: {list(PANEL_SPECS.keys())}"
            )
        return v

    @field_validator("design_type")
    @classmethod
    def validate_design_type(cls, v: str) -> str:
        if v not in ("mono", "combined"):
            raise ValueError("design_type должен быть 'mono' или 'combined'")
        return v


class CalculateBreakdownItem(BaseModel):
    """Разбивка по типоразмеру (для комбинированного дизайна)."""

    panel_size: str
    label: str
    share: float
    wall_area: float
    boxes_count: int
    actual_area: float
    panels_count: int
    price_per_panel: int
    purchase_price: int


class CalculateResponse(BaseModel):
    """Ответ с результатами расчёта."""

    wall_area: float = Field(..., description="Площадь стены в м²")
    boxes_count: int = Field(..., description="Количество коробок (округление вверх)")
    actual_area: float = Field(..., description="Фактический метраж с учётом коробок")
    panels_count: int = Field(..., description="Общее количество панелей")
    price_per_m2: int = Field(..., description="Цена за м²")
    price_per_panel: int = Field(default=0, description="Цена одной панели с накладкой")
    subscription_price: int = Field(..., description="Цена подписки в месяц")
    subscription_plan_id: str = Field(default="", description="ID подобранного тарифа")
    subscription_plan_name: str = Field(default="", description="Название тарифа")
    purchase_price: int = Field(..., description="Цена покупки")
    design_type: str = Field(default="mono", description="mono или combined")
    panel_specs: dict = Field(..., description="Характеристики панели")
    breakdown: list[CalculateBreakdownItem] = Field(
        default_factory=list, description="Разбивка по типоразмерам",
    )


# ─── Цены ────────────────────────────────────────────────────────────

async def _resolve_base_prices(panel_repo) -> dict[str, int]:
    """Базовая цена панели по типоразмеру из каталога панелей.

    Каталог — источник истины (админ меняет цены без деплоя). Отсутствующие
    типоразмеры добираются из `FALLBACK_BASE_PRICES`, чтобы расчёт никогда
    не возвращал 0 ₽.
    """
    prices = dict(FALLBACK_BASE_PRICES)
    if panel_repo is None:
        return prices
    try:
        panels, _total = await panel_repo.list_panels(limit=200)
    except Exception:
        return prices
    for panel in panels or []:
        size = getattr(panel, "size", None)
        width = getattr(size, "width_mm", None) or getattr(panel, "width_mm", None)
        height = getattr(size, "height_mm", None) or getattr(panel, "height_mm", None)
        base_price = getattr(panel, "base_price", 0) or 0
        if not width or not height or base_price <= 0:
            continue
        key = f"{width}x{height}"
        if key in PANEL_SPECS:
            prices[key] = int(base_price)
    return prices


async def _resolve_overlay_price(
    design_repo, settings_repo, design_id: str | None,
) -> int:
    """Цена дизайн-накладки: цена дизайна → настройки магазина → fallback."""
    if design_id and design_repo is not None:
        try:
            design = await design_repo.get_by_id(design_id)
        except Exception:
            design = None
        price = getattr(design, "price", 0) or 0
        if price > 0:
            return int(price)
    if settings_repo is not None:
        try:
            shop_settings = await settings_repo.get()
        except Exception:
            shop_settings = None
        price = getattr(shop_settings, "design_overlay_price", 0) or 0
        if price > 0:
            return int(price)
    return FALLBACK_OVERLAY_PRICE


async def _resolve_subscription(plan_repo, actual_area: float) -> tuple[int, str, str]:
    """Подбор тарифа подписки по фактической площади (PC-API-004).

    Берём самый дешёвый активный тариф, лимит которого покрывает площадь.
    Если площадь больше всех лимитов — самый большой тариф. `area_limit_m2 == 0`
    трактуется как «без лимита».
    """
    plans = []
    if plan_repo is not None:
        try:
            plans = await plan_repo.list_plans(active_only=True) or []
        except Exception:
            plans = []
    if not plans:
        return 0, "", ""

    unlimited = [p for p in plans if not getattr(p, "area_limit_m2", 0)]
    limited = sorted(
        (p for p in plans if getattr(p, "area_limit_m2", 0)),
        key=lambda p: p.area_limit_m2,
    )
    for plan in limited:
        if plan.area_limit_m2 >= actual_area:
            return int(plan.price), plan.id, plan.name
    if unlimited:
        cheapest = min(unlimited, key=lambda p: p.price)
        return int(cheapest.price), cheapest.id, cheapest.name
    if limited:
        biggest = limited[-1]
        return int(biggest.price), biggest.id, biggest.name
    return 0, "", ""


# ─── Расчёт ──────────────────────────────────────────────────────────

def _calc_one(
    wall_area: float, panel_size: str, price_per_panel: int, share: float,
    boxes: int | None = None,
) -> CalculateBreakdownItem:
    specs = PANEL_SPECS[panel_size]
    if boxes is not None:
        # Режим «по коробкам»: количество фиксировано пользователем,
        # округления вверх нет — продажа строго коробками.
        boxes_count = boxes
        actual_area = round(boxes_count * specs["box_area_m2"], 2)
        area = actual_area
    else:
        area = wall_area * share
        boxes_count = ceil(area * SAFETY_MARGIN / specs["box_area_m2"])
        actual_area = round(boxes_count * specs["box_area_m2"], 2)
    panels_count = boxes_count * specs["panels_per_box"]
    return CalculateBreakdownItem(
        panel_size=panel_size,
        label=specs["label"],
        share=round(share, 4),
        wall_area=round(area, 2),
        boxes_count=boxes_count,
        actual_area=actual_area,
        panels_count=panels_count,
        price_per_panel=price_per_panel,
        purchase_price=panels_count * price_per_panel,
    )


def calculate_project(
    height_cm: float,
    width_cm: float,
    panel_size: str = "300x300",
    design_type: str = "mono",
    *,
    base_prices: dict[str, int] | None = None,
    overlay_price: int = FALLBACK_OVERLAY_PRICE,
    items: list[CombinedItemRequest] | None = None,
    subscription: tuple[int, str, str] | None = None,
) -> CalculateResponse:
    """Чистая функция расчёта — без обращений к БД (легко тестируется)."""
    prices = dict(FALLBACK_BASE_PRICES)
    if base_prices:
        prices.update(base_prices)

    wall_area = (height_cm * width_cm) / 10_000

    def panel_price(size_key: str) -> int:
        return int(prices.get(size_key, 0)) + int(overlay_price)

    if design_type == "combined" and items:
        if any(i.boxes is not None for i in items):
            # Суммирование по коробкам: каждая позиция — фиксированное
            # число коробок; доли не нужны, округления вверх нет.
            breakdown = [
                _calc_one(
                    wall_area,
                    i.panel_size,
                    panel_price(i.panel_size),
                    0.0,
                    boxes=i.boxes or 1,
                )
                for i in items
            ]
            # Доля для отображения — по фактическому метражу позиции.
            total_actual = sum(b.actual_area for b in breakdown) or 1.0
            for b in breakdown:
                b.share = round(b.actual_area / total_actual, 4)
                b.wall_area = b.actual_area
        else:
            shares = [(i.share if i.share is not None else 1.0) for i in items]
            total_share = sum(shares) or 1.0
            breakdown = [
                _calc_one(
                    wall_area,
                    i.panel_size,
                    panel_price(i.panel_size),
                    (i.share if i.share is not None else 1.0) / total_share,
                )
                for i in items
            ]
    else:
        breakdown = [_calc_one(wall_area, panel_size, panel_price(panel_size), 1.0)]

    boxes_count = sum(b.boxes_count for b in breakdown)
    actual_area = round(sum(b.actual_area for b in breakdown), 2)
    panels_count = sum(b.panels_count for b in breakdown)
    purchase_price = sum(b.purchase_price for b in breakdown)

    main_size = breakdown[0].panel_size if breakdown else panel_size
    specs = PANEL_SPECS[main_size]
    price_per_panel = panel_price(main_size)
    # Цена за м² по основному типоразмеру: цена панели / её площадь.
    price_per_m2 = int(round(price_per_panel / specs["panel_area_m2"]))

    sub_price, sub_id, sub_name = subscription or (0, "", "")

    return CalculateResponse(
        wall_area=round(wall_area, 2),
        boxes_count=boxes_count,
        actual_area=actual_area,
        panels_count=panels_count,
        price_per_m2=price_per_m2,
        price_per_panel=price_per_panel,
        subscription_price=sub_price,
        subscription_plan_id=sub_id,
        subscription_plan_name=sub_name,
        purchase_price=purchase_price,
        design_type=design_type if (design_type == "combined" and items) else "mono",
        panel_specs=specs,
        breakdown=breakdown if len(breakdown) > 1 else [],
    )


@router.post("", response_model=CalculateResponse)
async def calculate_project_endpoint(
    request: CalculateRequest,
    panel_repo=Depends(get_panel_repo),
    design_repo=Depends(get_design_repo),
    settings_repo=Depends(get_shop_settings_repo),
    plan_repo=Depends(get_subscription_plan_repo),
) -> CalculateResponse:
    """POST /api/calculate — расчёт стоимости проекта."""
    base_prices = await _resolve_base_prices(panel_repo)
    overlay_price = await _resolve_overlay_price(
        design_repo, settings_repo, request.design_id,
    )

    # Первый проход — чтобы узнать фактическую площадь для подбора тарифа.
    draft = calculate_project(
        height_cm=request.height,
        width_cm=request.width,
        panel_size=request.panel_size,
        design_type=request.design_type,
        base_prices=base_prices,
        overlay_price=overlay_price,
        items=request.items,
    )
    subscription = await _resolve_subscription(plan_repo, draft.actual_area)

    return calculate_project(
        height_cm=request.height,
        width_cm=request.width,
        panel_size=request.panel_size,
        design_type=request.design_type,
        base_prices=base_prices,
        overlay_price=overlay_price,
        items=request.items,
        subscription=subscription,
    )


@router.get("/panel-sizes", response_model=dict)
async def get_panel_sizes():
    """GET /api/calculate/panel-sizes — список типоразмеров панелей."""
    return PANEL_SPECS
