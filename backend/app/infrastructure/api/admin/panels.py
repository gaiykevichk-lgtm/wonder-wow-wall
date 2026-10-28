"""Phase 7B — admin Panel SKU CRUD endpoints.

* `GET    /api/admin/panels`              — paginated list (incl. inactive)
* `GET    /api/admin/panels/{id}`         — single panel by id
* `POST   /api/admin/panels`              — create
* `PATCH  /api/admin/panels/{id}`         — partial update
* `DELETE /api/admin/panels/{id}`         — hard delete

Domain → HTTP mapping (registered in `app/main.py`):
  `PanelNotFoundError`     → 404 + `{detail, code: "panel_not_found"}`
  `PanelSlugConflictError` → 409 + `{detail, code: "panel_slug_conflict"}`

Pydantic models do shape validation (string length, non-negative ints);
domain invariants (required slug, dimensions positive) live in the use
cases — same split as Phase 4B/5.

Why size is sent as `width_mm`/`height_mm`/`size_label` (3 flat fields)
rather than a nested `{size: {...}}` object:
  Mirrors the SQL columns 1-to-1 and keeps the AntD form Item bindings
  flat. The composition into `PanelSize` happens in the endpoint right
  before calling the use case.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.panel_use_cases import (
    CreatePanelAdmin,
    DeletePanelAdmin,
    GetPanelAdmin,
    ListPanelsAdmin,
    UpdatePanelAdmin,
)
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
)
from app.container import get_audit_repo, get_panel_repo, get_recommendation_repo, get_db_session
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.persistence.models import PanelTextureAssignmentModel, PanelAvailabilityStatusModel, PanelModel
from app.domain.catalog.panel import Panel
from app.domain.catalog.panel_exceptions import PanelNotFoundError, PanelSlugConflictError
from app.domain.catalog.value_objects import PanelSize, PanelSizeKey, PANEL_SIZES, BASE_PANEL_PRICES
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Response shapes ─────────────────────────────────────────────────


class PanelResponse(BaseModel):
    id: str
    name: str
    slug: str
    width_mm: int
    height_mm: int
    size_label: str
    base_price: int
    stock_quantity: int = 0
    availability_status_id: str | None = None
    availability_status_name: str | None = None
    availability_status_color: str | None = None
    description: str
    thickness_mm: int
    execution: str
    mounting_system: str
    base_material: str
    packaging: str
    photo_path: str
    photo_paths: list[str] = Field(default_factory=list)
    # Базовый силуэт формы — белый PNG, используется как превью в карточках каталога.
    form_preview_path: str = ""
    is_active: bool
    created_at: str


class PanelListResponse(BaseModel):
    items: list[PanelResponse] = Field(default_factory=list)
    total: int
    offset: int
    limit: int


def _to_response(p: Panel) -> PanelResponse:
    return PanelResponse(
        id=p.id,
        name=p.name,
        slug=p.slug,
        width_mm=p.size.width_mm,
        height_mm=p.size.height_mm,
        size_label=p.size.label,
        base_price=p.base_price,
        stock_quantity=p.stock_quantity,
        availability_status_id=p.availability_status_id,
        description=p.description,
        thickness_mm=getattr(p, "thickness_mm", 3),
        execution=getattr(p, "execution", "Архитектурное декоративное покрытие"),
        mounting_system=getattr(p, "mounting_system", "Запатентованная система быстрой замены"),
        base_material=getattr(p, "base_material", "Ультралёгкий композит высокой плотности"),
        packaging=getattr(p, "packaging", ""),
        photo_path=p.photo_path,
        photo_paths=list(p.photo_paths),
        form_preview_path=p.form_preview_path,
        is_active=p.is_active,
        created_at=p.created_at.isoformat(),
    )


# ─── Request shapes ──────────────────────────────────────────────────


class PanelCreate(BaseModel):
    """Pydantic-side input shape for `POST /api/admin/panels`.

    `slug` length cap matches `PanelModel.slug` (120) so an oversize
    payload bounces at 422 instead of dying at the SQL layer. `size_label`
    is optional with default empty — the domain doesn't require it, but
    the admin UI almost always supplies it for display.
    """
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=120)
    width_mm: int = Field(gt=0)
    height_mm: int = Field(gt=0)
    size_label: str = Field(default="", max_length=40)
    base_price: int = Field(ge=0)
    availability_status_id: str | None = None
    description: str = Field(default="", max_length=4000)
    thickness_mm: int = Field(default=3, gt=0)
    execution: str = Field(default="Архитектурное декоративное покрытие", max_length=500)
    mounting_system: str = Field(default="Запатентованная система быстрой замены", max_length=500)
    base_material: str = Field(default="Ультралёгкий композит высокой плотности", max_length=500)
    packaging: str = Field(default="", max_length=500)
    photo_path: str = Field(default="", max_length=500)
    # Catalog gallery. Capped at 2 because the catalog card renders at
    # most two shots per panel; a longer list is a client bug, not
    # something to silently truncate server-side.
    photo_paths: list[str] = Field(default_factory=list, max_length=2)
    # Базовый силуэт формы (белый PNG) для превью в карточках каталога.
    form_preview_path: str = Field(default="", max_length=500)
    is_active: bool = True


class PanelSizesCreate(BaseModel):
    """Create independent SKUs for the selected sizes of one form."""
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=109)
    sizes: list[PanelSizeKey] = Field(min_length=1, max_length=3)
    description: str = Field(default="", max_length=4000)
    thickness_mm: int = Field(default=3, gt=0)
    execution: str = Field(default="Архитектурное декоративное покрытие", max_length=500)
    mounting_system: str = Field(default="Запатентованная система быстрой замены", max_length=500)
    base_material: str = Field(default="Ультралёгкий композит высокой плотности", max_length=500)
    packaging: str = Field(default="", max_length=500)
    photo_path: str = Field(default="", max_length=500)
    photo_paths: list[str] = Field(default_factory=list, max_length=2)
    is_active: bool = True

    @model_validator(mode="after")
    def unique_sizes(self):
        if len(self.sizes) != len(set(self.sizes)):
            raise ValueError("Sizes must be unique")
        return self


class PanelUpdate(BaseModel):
    """PATCH semantics — stock is deliberately not writable by admins."""
    model_config = {"extra": "forbid"}
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    width_mm: int | None = Field(default=None, gt=0)
    height_mm: int | None = Field(default=None, gt=0)
    size_label: str | None = Field(default=None, max_length=40)
    base_price: int | None = Field(default=None, ge=0)
    availability_status_id: str | None = None
    description: str | None = Field(default=None, max_length=4000)
    thickness_mm: int | None = Field(default=None, gt=0)
    execution: str | None = Field(default=None, max_length=500)
    mounting_system: str | None = Field(default=None, max_length=500)
    base_material: str | None = Field(default=None, max_length=500)
    packaging: str | None = Field(default=None, max_length=500)
    photo_path: str | None = Field(default=None, max_length=500)
    # `[]` clears the gallery (and, via `sync_photos`, the primary photo);
    # omitting the field leaves both untouched.
    photo_paths: list[str] | None = Field(default=None, max_length=2)
    form_preview_path: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


async def _enrich_panel_responses(items: list[PanelResponse], session: AsyncSession) -> list[PanelResponse]:
    ids = [item.availability_status_id for item in items if item.availability_status_id]
    if not ids:
        return items
    rows = (await session.execute(select(PanelAvailabilityStatusModel).where(PanelAvailabilityStatusModel.id.in_(ids)))).scalars().all()
    statuses = {row.id: row for row in rows}
    for item in items:
        status = statuses.get(item.availability_status_id)
        if status:
            item.availability_status_name = status.name
            item.availability_status_color = status.color
    return items


# ─── List ────────────────────────────────────────────────────────────


class AvailabilityStatusPayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


@router.get("/panel-availability-statuses")
async def list_panel_availability_statuses(_admin_id: str = Depends(get_current_admin_id), session: AsyncSession = Depends(get_db_session)):
    rows = (await session.execute(select(PanelAvailabilityStatusModel).order_by(PanelAvailabilityStatusModel.sort_order, PanelAvailabilityStatusModel.name))).scalars().all()
    return [{"id": r.id, "name": r.name, "color": r.color} for r in rows]


@router.post("/panel-availability-statuses", status_code=201)
async def create_panel_availability_status(body: AvailabilityStatusPayload, _admin_id: str = Depends(get_current_admin_id), session: AsyncSession = Depends(get_db_session)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Название статуса обязательно")
    row = PanelAvailabilityStatusModel(name=name, color=body.color)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return {"id": row.id, "name": row.name, "color": row.color}


@router.patch("/panel-availability-statuses/{status_id}")
async def update_panel_availability_status(status_id: str, body: AvailabilityStatusPayload, _admin_id: str = Depends(get_current_admin_id), session: AsyncSession = Depends(get_db_session)):
    row = await session.get(PanelAvailabilityStatusModel, status_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Статус не найден")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Название статуса обязательно")
    row.name, row.color = name, body.color
    await session.commit()
    return {"id": row.id, "name": row.name, "color": row.color}


@router.delete("/panel-availability-statuses/{status_id}", status_code=204)
async def delete_panel_availability_status(status_id: str, _admin_id: str = Depends(get_current_admin_id), session: AsyncSession = Depends(get_db_session)):
    row = await session.get(PanelAvailabilityStatusModel, status_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Статус не найден")
    await session.execute(update(PanelModel).where(PanelModel.availability_status_id == status_id).values(availability_status_id=None))
    await session.delete(row)
    await session.commit()
    return Response(status_code=204)


@router.get("/panels", response_model=PanelListResponse)
async def list_panels_admin(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    # Phase 7B remediation 2 (FE-B) — server-side filters. `is_active`
    # is `bool | None` so explicit `?is_active=false` can narrow on
    # hidden SKUs without losing the include_inactive default of the
    # admin endpoint. `search` is capped at 200 to mirror the cap on
    # the orders/users admin filters.
    is_active: bool | None = Query(None),
    search: str | None = Query(None, max_length=200),
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
    session: AsyncSession = Depends(get_db_session),
):
    """Admin list — includes inactive panels.

    Public catalog has its own endpoint that hard-codes
    `include_inactive=False` so this endpoint cannot be coerced into
    leaking hidden SKUs by URL fiddling.
    """
    items, total = await ListPanelsAdmin(panel_repo).execute(
        is_active=is_active,
        search=search,
        offset=offset,
        limit=limit,
    )
    return PanelListResponse(
        items=await _enrich_panel_responses([_to_response(p) for p in items], session),
        total=total,
        offset=offset,
        limit=limit,
    )


@router.post("/panels/sizes", response_model=list[PanelResponse], status_code=201)
async def create_panel_sizes_admin(
    body: PanelSizesCreate,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    """Reuse matching sizes of the same base form without replacing IDs."""
    candidates = [(key, PANEL_SIZES[key], f"{body.slug}-{key.value}") for key in body.sizes]
    # Slugs may be shared by copied rows. Use name + size for the size-wizard's
    # idempotent lookup; a copy must not make this lookup ambiguous.
    matches = []
    offset = 0
    while True:
        batch, total = await panel_repo.list_panels(offset=offset, limit=500, include_inactive=True)
        matches.extend(batch)
        offset += len(batch)
        if offset >= total or not batch:
            break
    existing = []
    for _, size, slug in candidates:
        same_slug = [item for item in matches if item.slug == slug]
        if any(item.name != body.name or item.size.key != size.key for item in same_slug):
            raise PanelSlugConflictError(f"Panel with slug {slug!r} has another form or size")
        same_name_size = [
            item for item in matches
            if " ".join(item.name.strip().casefold().split()) == " ".join(body.name.strip().casefold().split())
            and item.size.key == size.key
        ]
        if same_name_size and not same_slug:
            # Same form name + size under a free slug (e.g. legacy `arka`
            # rows vs the size wizard's `arka-300x300`): also a duplicate,
            # reuse the oldest row instead of creating an exact copy.
            existing.append(min(same_name_size, key=lambda item: (item.created_at, item.id)))
            continue
        existing.append(min(same_slug, key=lambda item: (item.created_at, item.id)) if same_slug else None)
    result = []
    creator = CreatePanelAdmin(panel_repo)
    for (key, size, slug), panel in zip(candidates, existing):
        if panel is None:
            panel = await creator.execute(
                name=body.name, slug=slug, size=size,
                base_price=BASE_PANEL_PRICES[key.value],
                availability_status_id=body.availability_status_id,
                description=body.description,
                thickness_mm=body.thickness_mm, execution=body.execution,
                mounting_system=body.mounting_system, base_material=body.base_material,
                packaging=body.packaging,
                photo_path=body.photo_path, photo_paths=body.photo_paths,
                is_active=body.is_active,
            )
        result.append(_to_response(panel))
    return result


# ─── Detail ──────────────────────────────────────────────────────────


@router.get("/panels/{panel_id}", response_model=PanelResponse)
async def get_panel_admin(
    panel_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
    session: AsyncSession = Depends(get_db_session),
):
    panel = await GetPanelAdmin(panel_repo).execute(panel_id)
    return (await _enrich_panel_responses([_to_response(panel)], session))[0]


# ─── Create ──────────────────────────────────────────────────────────


@router.post("/panels", response_model=PanelResponse, status_code=201)
async def create_panel_admin(
    body: PanelCreate,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    size = PanelSize(
        width_mm=body.width_mm,
        height_mm=body.height_mm,
        label=body.size_label,
    )
    panel = await CreatePanelAdmin(panel_repo).execute(
        name=body.name,
        slug=body.slug,
        size=size,
        base_price=body.base_price,
        availability_status_id=body.availability_status_id,
        description=body.description,
        thickness_mm=body.thickness_mm, execution=body.execution,
        mounting_system=body.mounting_system, base_material=body.base_material,
        packaging=body.packaging,
        photo_path=body.photo_path,
        photo_paths=body.photo_paths,
        form_preview_path=body.form_preview_path,
        is_active=body.is_active,
    )
    return _to_response(panel)


# ─── Duplicate a base panel with no catalog texture ───────────────────


@router.post("/panels/{panel_id}/duplicate", response_model=PanelResponse, status_code=201)
async def duplicate_unassigned_panel_admin(
    panel_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
    session: AsyncSession = Depends(get_db_session),
):
    source = await panel_repo.get_by_id(panel_id)
    if source is None:
        raise PanelNotFoundError(panel_id)

    # A textured row must use the row duplicate endpoint, which also copies
    # its assignment and executions. Never silently duplicate only its panel.
    assignment = await session.scalar(select(PanelTextureAssignmentModel.id).where(
        PanelTextureAssignmentModel.panel_id == panel_id,
        PanelTextureAssignmentModel.is_catalog_row.is_(True),
    ).limit(1))
    if assignment is not None:
        raise HTTPException(status_code=409, detail="Use catalog row duplication for textured panels")

    copied = await CreatePanelAdmin(panel_repo).execute(
        name=source.name, slug=source.slug, size=source.size,
        base_price=source.base_price,
        availability_status_id=source.availability_status_id,
        description=source.description,
        thickness_mm=source.thickness_mm, execution=source.execution,
        mounting_system=source.mounting_system, base_material=source.base_material,
        packaging=source.packaging,
        photo_path=source.photo_path, photo_paths=list(source.photo_paths),
        form_preview_path=source.form_preview_path, is_active=source.is_active,
    )
    return _to_response(copied)


# ─── Update ──────────────────────────────────────────────────────────


@router.patch("/panels/{panel_id}", response_model=PanelResponse)
async def update_panel_admin(
    panel_id: str,
    body: PanelUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    # Size patch fields pass through individually — the use case already
    # loads the row for `get_by_id` and composes the new `PanelSize` from
    # current + patch components, so we don't pre-load here (was an N+1).
    panel = await UpdatePanelAdmin(panel_repo).execute(
        panel_id=panel_id,
        name=body.name,
        slug=body.slug,
        width_mm=body.width_mm,
        height_mm=body.height_mm,
        size_label=body.size_label,
        base_price=body.base_price,
        availability_status_id=body.availability_status_id,
        description=body.description,
        thickness_mm=body.thickness_mm, execution=body.execution,
        mounting_system=body.mounting_system, base_material=body.base_material,
        packaging=body.packaging,
        photo_path=body.photo_path,
        photo_paths=body.photo_paths,
        form_preview_path=body.form_preview_path,
        is_active=body.is_active,
    )
    return _to_response(panel)


# ─── Delete ──────────────────────────────────────────────────────────


@router.delete("/panels/{panel_id}", status_code=204)
async def delete_panel_admin(
    panel_id: str,
    admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
    audit_repo=Depends(get_audit_repo),
    rec_repo=Depends(get_recommendation_repo),
    ip: str | None = Depends(get_request_ip),
):
    # Phase 10 — wire the recommendation cleanup so a deleted panel
    # cannot leave orphan rows in `recommendations` (as source) or
    # `recommendation_targets` (as target). The cascade report is
    # folded into the PANEL_DELETE audit entry by the use case.
    deleted = await DeletePanelAdmin(
        panel_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        recommendation_cleanup=CleanupRecommendationsOnDelete(rec_repo),
    ).execute(panel_id, actor_id=admin_id)
    if not deleted:
        # Defer the envelope shape to the global PanelNotFoundError
        # handler — keeps the frontend's branching uniform and avoids
        # duplicating the {detail, code} payload here.
        raise PanelNotFoundError(f"Panel {panel_id} not found")
    return Response(status_code=204)
