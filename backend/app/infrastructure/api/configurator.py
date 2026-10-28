"""Configurator sessions — TZ 07 («Конфигуратор своего фото»).

Flow: wall photo upload → AI-designer dialogue (area, sizes, style,
materials, comment, optional zone rectangle) → server-generated proposals
where a REAL panel is placed on the USER's photo (CFG-07) via the
multimodal ``/api/visualizer/ai-preview`` engine, priced by the same rules
as ``/api/calculate`` (TZ 05).

Design notes
------------
* Anonymous by design (like ``auto-perspective``): requiring auth here
  would boot mid-flow users to ``/login`` (see the 2026-04-24 incident
  comment in ``visualizer.py``).
* Sessions live in process memory with a 30-day TTL (Q08 decision: photo
  itself is persisted in file storage; the dialogue mirror also lives in
  the browser's localStorage, so a server restart costs at most the
  cached proposals — they are regenerable).
* Panorama stitching (CFG-01) uses server-side OpenCV when the optional
  ``opencv-python-headless`` dependency is present; otherwise the endpoint
  answers ``503 code=stitch_unavailable`` and the frontend falls back to
  the single-photo scenario (risk R2 in 94_Шаги_реализации_Конфигуратор.md).
"""

from __future__ import annotations

import base64
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.application.catalog.texture_use_cases import (
    ListTextureColorsPublic,
    ListTexturesPublic,
)
from app.application.configurator.prompt_settings import read_prompt_settings, compose_generation_prompt
from app.application.configurator.session_storage import load_session, save_session
from app.application.media.use_cases import UploadMedia
from app.container import (
    get_panel_repo,
    get_panel_variant_repo,
    get_file_storage,
    get_media_repo,
    get_texture_color_repo,
    get_texture_repo,
)
from app.domain.media.services import FileStorage
from app.domain.media.value_objects import (
    GLOBAL_MAX_SIZE_BYTES,
    MediaPurpose,
)
from app.infrastructure.api.ai_preview import generate_wall_preview
from app.infrastructure.api.calculate import calculate_project

logger = logging.getLogger(__name__)

router = APIRouter()

SESSION_TTL_SECONDS = 30 * 24 * 3600  # Q08: 30 days
PROPOSAL_COUNT = 3  # TZ 07 CFG-06: minimum 2, optimal 3 [Р]

# Style/material keywords → texture name hints. Used to filter the panel
# cards (hybrid Q06) and to pick *different* proposals (CFG-08).
_MATERIAL_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Камень и дерево": ("камен", "дерево", "дуб", "известняк", "мрамор", "гранит"),
    "Только дерево": ("дерево", "дуб", "ясень", "орех", "планкен"),
    "Кожа и текстиль": ("кож", "текстиль", "ткан", "лён", "велюр"),
    "Металл и бетон": ("металл", "бетон", "цемент", "шлифов"),
}
_STYLE_PROMPTS: dict[str, str] = {
    "Современный": "современный минимализм, чистые линии, спокойные тона",
    "Скандинавский": "скандинавский уют, светлое дерево, мягкий свет",
    "Лофт": "индустриальный лофт, брутальные фактуры, контраст",
    "Неоклассика": "премиальная неоклассика, симметрия, благородные тона",
}


# ─── Session store ────────────────────────────────────────────────────


@dataclass
class ConfiguratorSession:
    id: str
    photo_path: str
    photo_url: str
    created_at: float
    answers: dict[str, Any] | None = None
    proposals: list[dict[str, Any]] = field(default_factory=list)


_SESSIONS: dict[str, ConfiguratorSession] = {}


def _prune_expired() -> None:
    deadline = time.time() - SESSION_TTL_SECONDS
    for sid in [s for s, v in _SESSIONS.items() if v.created_at < deadline]:
        _SESSIONS.pop(sid, None)


async def _get_session(session_id: str) -> ConfiguratorSession:
    _prune_expired()
    session = _SESSIONS.get(session_id)
    if session is None:
        stored = await load_session(session_id)
        if stored and time.time() - stored["created_at"] < SESSION_TTL_SECONDS:
            session = ConfiguratorSession(**stored)
            _SESSIONS[session_id] = session
    if session is None:
        raise HTTPException(status_code=404, detail="Configurator session not found")
    return session


# ─── Schemas ──────────────────────────────────────────────────────────


class ZoneRect(BaseModel):
    """Выделенная область в относительных координатах фото (0..1)."""

    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    w: float = Field(..., gt=0.0, le=1.0)
    h: float = Field(..., gt=0.0, le=1.0)


class DialogAnswers(BaseModel):
    area_choice: str = Field(default="whole", pattern="^(whole|custom)$")
    width_m: float = Field(default=3.2, gt=0.3, le=30)
    height_m: float = Field(default=2.7, gt=0.3, le=10)
    style: str = "Современный"
    material: str = "Камень и дерево"
    comment: str = ""
    zone: ZoneRect | None = None
    panel_id: str | None = None
    pro_mode: bool = False
    texture_id: str | None = None
    variant_id: str | None = None


class SessionCreated(BaseModel):
    id: str
    photo_url: str


class ProposalCalc(BaseModel):
    boxes_count: int
    panels_count: int
    actual_area: float
    purchase_price: int
    price_per_m2: int | None = None


class Proposal(BaseModel):
    id: str
    variant_tag: str
    texture_name: str
    color_name: str
    style: str
    area_m2: float
    coverage: str
    status: str  # "ready" | "visualization_failed"
    preview_url: str | None = None
    reason: str = ""
    calc: ProposalCalc | None = None


class ProposalsResponse(BaseModel):
    session_id: str
    proposals: list[Proposal]


class StitchResponse(BaseModel):
    panorama_url: str
    photos_used: int


# ─── Helpers ──────────────────────────────────────────────────────────


def _material_matches(texture_name: str, material: str) -> bool:
    keywords = _MATERIAL_KEYWORDS.get(material, ())
    if not keywords:
        return True
    lowered = texture_name.lower()
    return any(k in lowered for k in keywords)


def _zone_ratio(zone: ZoneRect | None) -> float:
    if zone is None:
        return 1.0
    return max(0.01, min(1.0, zone.w * zone.h))


async def _pick_candidates(
    texture_repo,
    color_repo,
    material: str,
    panel_id: str | None,
) -> list[dict[str, str]]:
    """Return up to PROPOSAL_COUNT distinct (texture, color) combinations.

    CFG-08: proposals must differ by panel/execution/coverage zone, so we
    deliberately spread candidates across material groups first and across
    colors inside a group second.
    """
    textures = await ListTexturesPublic(texture_repo).execute()
    enriched: list[dict[str, str]] = []
    for texture in textures:
        colors = await ListTextureColorsPublic(color_repo).execute(texture.id)
        color = next(iter(colors), None)
        enriched.append(
            {
                "texture_id": texture.id,
                "texture_name": texture.name,
                "swatch_image": texture.swatch_image,
                "color_id": color.id if color else "",
                "color_name": color.name if color else "",
                "color_swatch": color.swatch_image if color else texture.swatch_image,
            }
        )
    if panel_id:
        chosen = [e for e in enriched if e["texture_id"] == panel_id]
        if chosen:
            rest = [e for e in enriched if e not in chosen]
            return (chosen + rest)[:PROPOSAL_COUNT]
    matching = [e for e in enriched if _material_matches(e["texture_name"], material)]
    pool = matching or enriched
    # Spread: prefer different texture names first.
    picked: list[dict[str, str]] = []
    for entry in pool:
        if all(p["texture_name"] != entry["texture_name"] for p in picked):
            picked.append(entry)
    for entry in pool:
        if len(picked) >= PROPOSAL_COUNT:
            break
        if entry not in picked:
            picked.append(entry)
    if picked:
        while len(picked) < PROPOSAL_COUNT:
            picked.append(dict(picked[len(picked) % len(pool)]))
    return picked[:PROPOSAL_COUNT]


def _build_prompt(
    *,
    style: str,
    material: str,
    comment: str,
    coverage: str,
    texture_name: str,
) -> str:
    style_hint = _STYLE_PROMPTS.get(style, style)
    parts = [
        f"Стиль: {style_hint}.",
        f"Материал панели: {texture_name} ({material}).",
        f"Покрытие: {coverage}.",
    ]
    if comment.strip():
        parts.append(f"Пожелания пользователя: {comment.strip()}.")
    return " ".join(parts)


async def _photo_data_url(storage: FileStorage, session: ConfiguratorSession) -> str:
    from app.infrastructure.api.ai_preview import image_to_data_url

    url = storage.url_for(session.photo_path)
    if url.startswith("http"):
        return await image_to_data_url(url, max_dimension=1536, quality=95)
    # `url` looks like `/uploads/...` — the backend exposes those through
    # its own HTTP endpoint (which nginx proxies to S3 / local fs). Fetch
    # from there so we work in every storage mode without reading the
    # production container's filesystem.
    import httpx  # noqa: PLC0415

    backend = os.environ.get("PUBLIC_BACKEND_URL", "").rstrip("/")
    if not backend:
        # Fallback to localhost for in-process testing.
        backend = "http://localhost:8080"
    full = f"{backend}{url}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(full)
        resp.raise_for_status()
        data = resp.content
    b64 = base64.b64encode(data).decode()
    return f"data:image/jpeg;base64,{b64}"


def _resolve_media_url(raw: str | None, storage: FileStorage) -> str | None:
    """Turn a stored media reference into an absolute URL for the AI engine.

    Texture/color swatches come from the repository as bare storage keys
    (``MISC/uuid.jpg``). ``image_to_data_url`` only understands ``data:`` and
    ``http(s)`` URLs — feeding it a bare key raised deep inside every
    proposal (CFG-07 silently degraded to ``visualization_failed``). Resolve
    keys through FileStorage and, when the result is site-relative
    (``/uploads/...``), prefix the public backend URL.
    """
    if not raw:
        return None
    if raw.startswith(("data:", "http://", "https://")):
        return raw
    url = storage.url_for(raw) if not raw.startswith("/") else raw
    if url.startswith("/"):
        backend = os.environ.get("PUBLIC_BACKEND_URL", "").rstrip("/") or "http://localhost:8080"
        url = f"{backend}{url}"
    return url


# ─── Endpoints ────────────────────────────────────────────────────────


@router.post(
    "/sessions",
    response_model=SessionCreated,
    status_code=201,
    summary="Create configurator session with a wall photo",
)
async def create_session(
    file: UploadFile = File(...),
    repo=Depends(get_media_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    """CFG-01/CFG-03: anonymous upload of the user's wall photo.

    Validation (mime/size/dimensions) is delegated to the shared media
    use case with purpose ``CONFIGURATOR_PHOTO`` (20 MB cap per TZ 07).
    """
    if file.size is not None and file.size > GLOBAL_MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Файл больше 20 МБ — снимите легче")
    use_case = UploadMedia(repo=repo, storage=storage)
    asset = await use_case.execute(
        actor_id="anonymous-configurator",
        stream=file.file,
        original_name=file.filename or "wall.jpg",
        declared_mime=(file.content_type or "").lower(),
        purpose=MediaPurpose.CONFIGURATOR_PHOTO,
    )
    session = ConfiguratorSession(
        id=str(uuid.uuid4()),
        photo_path=asset.path,
        photo_url=storage.url_for(asset.path),
        created_at=time.time(),
    )
    _SESSIONS[session.id] = session
    await save_session(session)
    # url_for is recomputed per request elsewhere: S3 signed URLs expire
    # long before the 30-day session TTL does.
    return SessionCreated(id=session.id, photo_url=session.photo_url)


@router.get("/sessions/{session_id}", summary="Session state (photo + answers)")
async def get_session(
    session_id: str, storage: FileStorage = Depends(get_file_storage)
):
    session = await _get_session(session_id)
    return {
        "id": session.id,
        "photo_url": storage.url_for(session.photo_path),
        "answers": session.answers,
        "proposals": session.proposals,
    }


@router.put("/sessions/{session_id}", summary="Persist dialogue answers (CFG-09)")
async def update_session(session_id: str, body: DialogAnswers):
    session = await _get_session(session_id)
    session.answers = body.model_dump()
    await save_session(session)
    return {"id": session.id, "answers": session.answers}


@router.post(
    "/sessions/{session_id}/proposals",
    response_model=ProposalsResponse,
    summary="Generate real proposals on the user's photo (CFG-06…08)",
)
async def generate_proposals(
    session_id: str,
    body: DialogAnswers,
    storage: FileStorage = Depends(get_file_storage),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    panel_repo=Depends(get_panel_repo),
    variant_repo=Depends(get_panel_variant_repo),
):
    session = await _get_session(session_id)
    session.answers = body.model_dump()

    pro_panel = None
    if body.pro_mode:
        if not all((body.panel_id, body.texture_id, body.variant_id)):
            raise HTTPException(status_code=422, detail="Выберите панель, текстуру и исполнение")
        variant = await variant_repo.get_by_id(body.variant_id)
        pro_panel = await panel_repo.get_by_id(body.panel_id)
        texture = await texture_repo.get_by_id(body.texture_id)
        if not variant or not pro_panel or not texture or not variant.is_active or not pro_panel.is_active or not texture.is_active or variant.panel_id != body.panel_id or variant.texture_id != body.texture_id:
            raise HTTPException(status_code=422, detail="Панель, текстура и исполнение несовместимы или недоступны")
        paths = variant.design_image_paths or variant.image_paths
        if not paths:
            raise HTTPException(status_code=422, detail="У исполнения отсутствует изображение для генерации")
        candidate = {"texture_id": texture.id, "texture_name": texture.name, "swatch_image": paths[0], "color_id": "", "color_name": variant.name or texture.name, "color_swatch": paths[0]}
        candidates = [dict(candidate) for _ in range(PROPOSAL_COUNT)]
    else:
        candidates = await _pick_candidates(texture_repo, color_repo, body.material, body.panel_id)
    if not candidates:
        raise HTTPException(status_code=409, detail="Нет доступных фактур для предложений")

    photo_url = await _photo_data_url(storage, session)

    wall_area_m2 = body.width_m * body.height_m
    zone = body.zone if body.area_choice == "custom" else None
    proposals: list[Proposal] = []

    prompt_settings = await read_prompt_settings()
    for index, candidate in enumerate(candidates):
        # CFG-08: third variant covers only the accent zone even for a
        # "whole wall" answer — different execution, same photo identity.
        if index == 2 and zone is None and not body.pro_mode:
            coverage = "акцентная зона 60%×50% в центре стены"
            area_m2 = wall_area_m2 * 0.30
            calc_zone = ZoneRect(x=0.2, y=0.25, w=0.6, h=0.5)
        elif zone is not None:
            coverage = "выделенная пользователем область"
            area_m2 = wall_area_m2 * _zone_ratio(zone)
            calc_zone = zone
        else:
            coverage = "вся стена от угла до угла"
            area_m2 = wall_area_m2
            calc_zone = None

        if calc_zone is not None:
            width_cm = max(50.0, body.width_m * 100 * calc_zone.w)
            height_cm = max(50.0, body.height_m * 100 * calc_zone.h)
        else:
            width_cm = body.width_m * 100
            height_cm = body.height_m * 100

        calc = calculate_project(height_cm=height_cm, width_cm=width_cm)

        preview_url: str | None = None
        status = "ready"
        reason = (
            f"{candidate['texture_name']} в стиле «{body.style}»: "
            f"{coverage}."
        )
        try:
            preview_url, _ = await generate_wall_preview(
                reference_max_dimension=1536,
                reference_quality=95,
                photo_b64=photo_url,
                design_name=candidate["texture_name"],
                design_color="#FFFFFF",
                design_image_url=_resolve_media_url(
                    candidate["color_swatch"] or candidate["swatch_image"], storage
                ),
                custom_prompt=compose_generation_prompt(prompt_settings["system_prompt"],
                    f"Режим: {'PRO' if body.pro_mode else 'обычный'}. "
                    f"Панель: {pro_panel.name if pro_panel else 'подбор по материалу'}. "
                    f"Размер панели: {str(pro_panel.size.width_mm) + ' × ' + str(pro_panel.size.height_mm) + ' мм' if pro_panel else 'не выбран'}. "
                    f"Вариант визуализации: {index + 1}; сохраняй выбранное исполнение и покрытие. "
                    f"Размер стены: {body.width_m} × {body.height_m} м. "
                    f"Площадь покрытия: {area_m2:.2f} м². "
                    f"Цвет: {candidate['color_name']}. "
                    f"Область (x,y,w,h; 0..1): {calc_zone.model_dump() if calc_zone else 'вся стена'}. "
                    + _build_prompt(
                    style="точное воспроизведение выбранного исполнения" if body.pro_mode else body.style,
                    material=candidate["texture_name"] if body.pro_mode else body.material,
                    comment=body.comment,
                    coverage=coverage,
                    texture_name=candidate["texture_name"],
                )),
            )
        except HTTPException as exc:
            status = "visualization_failed"
            logger.warning(
                "configurator: ai-preview HTTPException for %s: %s",
                candidate["texture_name"],
                exc.detail,
            )
        except Exception:  # noqa: BLE001 — degradation per step 3.6
            status = "visualization_failed"
            logger.exception(
                "configurator: ai-preview failed for %s", candidate["texture_name"]
            )

        proposals.append(
            Proposal(
                id=f"{session.id}-p{index}",
                variant_tag=f"variant-{index + 1}",
                texture_name=candidate["texture_name"],
                color_name=candidate["color_name"] or "—",
                style=body.style,
                area_m2=round(area_m2, 2),
                coverage=coverage,
                status=status,
                preview_url=preview_url,
                reason=reason,
                calc=ProposalCalc(
                    boxes_count=calc.boxes_count,
                    panels_count=calc.panels_count,
                    actual_area=calc.actual_area,
                    purchase_price=calc.purchase_price,
                    price_per_m2=getattr(calc, "price_per_m2", None),
                ),
            )
        )

    session.proposals = [p.model_dump() for p in proposals]
    await save_session(session)
    return ProposalsResponse(session_id=session.id, proposals=proposals)


@router.post(
    "/stitch",
    response_model=StitchResponse,
    summary="Stitch several wall photos into one panorama (CFG-01)",
    responses={
        422: {"description": "Stitch failed (`code: stitch_failed`)"},
        503: {"description": "OpenCV unavailable (`code: stitch_unavailable`)"},
    },
)
async def stitch_panorama(
    files: list[UploadFile] = File(...),
    storage: FileStorage = Depends(get_file_storage),
):
    if len(files) < 2:
        raise HTTPException(status_code=422, detail="Для панорамы нужно минимум 2 фото")
    if len(files) > 6:
        raise HTTPException(status_code=422, detail="Максимум 6 фото для склейки")
    try:  # optional heavy dependency — absent in lean test images
        import importlib  # noqa: PLC0415

        cv2 = importlib.import_module("cv2")
        np = importlib.import_module("numpy")
    except (ImportError, ModuleNotFoundError) as exc:  # pragma: no cover
        raise HTTPException(
            status_code=503,
            detail={"code": "stitch_unavailable", "message": "OpenCV не установлен"},
        ) from exc

    images = []
    for upload in files:
        data = await upload.read()
        if len(data) > GLOBAL_MAX_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Файл больше 20 МБ")
        array = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=422, detail="Одно из фото не читается")
        images.append(image)

    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    status, panorama = stitcher.stitch(images)
    if status != cv2.Stitcher_OK or panorama is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "stitch_failed",
                "message": "Не удалось склеить панораму — продолжите с одним фото",
            },
        )

    ok, encoded = cv2.imencode(".jpg", panorama, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise HTTPException(status_code=500, detail="Не удалось сохранить панораму")

    import io  # noqa: PLC0415

    path = await storage.save(
        io.BytesIO(encoded.tobytes()),
        purpose=MediaPurpose.CONFIGURATOR_PHOTO,
        extension="jpg",
    )
    return StitchResponse(
        panorama_url=storage.url_for(path), photos_used=len(images)
    )
