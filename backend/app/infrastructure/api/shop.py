"""Phase 8 — public shop endpoints (no auth).

Houses the *read* side of the Shop bounded context that the frontend
constructor + catalog consume:
  * Phase 8A — `GET /api/shop/settings`
  * Phase 8B — `GET /api/shop/banners?position=`
  * Phase 8C — `GET /api/subscription-plans`

No `Request`-suffix DTOs here; this is a read-only public surface.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.application.shop.banner_use_cases import ListBannersPublic
from app.application.shop.settings_use_cases import GetShopSettings
from app.application.subscription.plan_use_cases import (
    ListSubscriptionPlansPublic,
)
from app.container import (
    get_banner_repo,
    get_shop_settings_repo,
    get_subscription_plan_repo,
)
from app.domain.shop.banner import BannerPosition

router = APIRouter()


class ShopSettingsResponse(BaseModel):
    """Public shape — same fields as the admin response.

    Defined here (not imported from `admin/shop_settings.py`) so a
    future admin-only field (audit timestamp, internal flags) does not
    accidentally leak by transitive type sharing. Same posture as
    `PanelSchema` (public catalog) vs `PanelResponse` (admin).
    """
    id: str
    design_overlay_price: int
    installation_price: int
    min_order_amount: int
    recommendations_limit_per_source: int
    updated_at: str


class PublicBannerResponse(BaseModel):
    """Public banner — admin-only fields (`updated_at`, `created_at`)
    omitted to match the «no admin metadata leakage» posture of
    `PanelSchema` (public catalog) vs `PanelResponse` (admin).
    """
    id: str
    title: str
    subtitle: str
    image_path: str
    cta_label: str
    cta_url: str
    position: str
    priority: int


class PublicBannerListResponse(BaseModel):
    items: list[PublicBannerResponse] = Field(default_factory=list)


class PublicSubscriptionPlanResponse(BaseModel):
    """Public plan — admin-only fields (`is_active`, `sort_order`,
    `created_at`, `updated_at`) omitted; the public catalog only sees
    active plans (use case hard-codes the filter)."""
    id: str
    name: str
    price: int
    period: str
    area_limit_m2: float
    popular: bool
    features: list[str] = Field(default_factory=list)


class PublicSubscriptionPlanListResponse(BaseModel):
    items: list[PublicSubscriptionPlanResponse] = Field(default_factory=list)


@router.get("/shop/settings", response_model=ShopSettingsResponse)
async def get_shop_settings_public(
    response: Response,
    repo=Depends(get_shop_settings_repo),
):
    """Public read of the singleton shop settings.

    No auth — frontend caches this for 5 minutes (TanStack Query) and
    falls back to the legacy `frontend/src/shared/config/constants.ts`
    constants if the request fails (offline-resilient). Phase 8D —
    `Cache-Control: public, max-age=300` matches the front-end cache
    TTL so an admin's PATCH propagates to the catalog within 5 minutes
    without a hard refresh.
    """
    s = await GetShopSettings(repo).execute()
    response.headers["Cache-Control"] = "public, max-age=300"
    return ShopSettingsResponse(
        id=s.id,
        design_overlay_price=s.design_overlay_price,
        installation_price=s.installation_price,
        min_order_amount=s.min_order_amount,
        recommendations_limit_per_source=s.recommendations_limit_per_source,
        updated_at=s.updated_at.isoformat(),
    )


@router.get("/shop/banners", response_model=PublicBannerListResponse)
async def list_banners_public(
    response: Response,
    position: str | None = Query(None),
    repo=Depends(get_banner_repo),
):
    """Public read of active banners, optionally narrowed by position.

    Use case hard-codes `active_only=True` so a query-string twiddle
    cannot leak draft / inactive banners.
    """
    pos: BannerPosition | None = None
    if position is not None:
        try:
            pos = BannerPosition(position)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Unknown position {position!r}; expected one of "
                    f"{[p.value for p in BannerPosition]}"
                ),
            )
    banners = await ListBannersPublic(repo).execute(position=pos)
    response.headers["Cache-Control"] = "public, max-age=300"
    return PublicBannerListResponse(
        items=[
            PublicBannerResponse(
                id=b.id, title=b.title, subtitle=b.subtitle,
                image_path=b.image_path, cta_label=b.cta_label,
                cta_url=b.cta_url, position=b.position.value,
                priority=b.priority,
            )
            for b in banners
        ],
    )


@router.get(
    "/subscription-plans",
    response_model=PublicSubscriptionPlanListResponse,
)
async def list_plans_public(
    response: Response,
    repo=Depends(get_subscription_plan_repo),
):
    """Public read of active subscription plans, sorted by `sort_order`.

    Use case hard-codes `active_only=True`. Frontend caches for 5 min.
    """
    plans = await ListSubscriptionPlansPublic(repo).execute()
    response.headers["Cache-Control"] = "public, max-age=300"
    return PublicSubscriptionPlanListResponse(
        items=[
            PublicSubscriptionPlanResponse(
                id=p.id, name=p.name, price=p.price, period=p.period,
                area_limit_m2=p.area_limit_m2, popular=p.popular,
                features=list(p.features),
            )
            for p in plans
        ],
    )
