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
domain invariants (slug uniqueness, dimensions positive) live in the use
cases — same split as Phase 4B/5.

Why size is sent as `width_mm`/`height_mm`/`size_label` (3 flat fields)
rather than a nested `{size: {...}}` object:
  Mirrors the SQL columns 1-to-1 and keeps the AntD form Item bindings
  flat. The composition into `PanelSize` happens in the endpoint right
  before calling the use case.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field

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
from app.container import get_audit_repo, get_panel_repo, get_recommendation_repo
from app.domain.catalog.panel import Panel
from app.domain.catalog.panel_exceptions import PanelNotFoundError
from app.domain.catalog.value_objects import PanelSize
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
    description: str
    photo_path: str
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
        description=p.description,
        photo_path=p.photo_path,
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
    description: str = Field(default="", max_length=4000)
    photo_path: str = Field(default="", max_length=500)
    is_active: bool = True


class PanelUpdate(BaseModel):
    """PATCH semantics — `None` means "don't touch".

    To *clear* an optional string field (description / photo_path) the
    client passes `""`, not omits it. Same pattern as the orders patch
    endpoint.
    """
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    width_mm: int | None = Field(default=None, gt=0)
    height_mm: int | None = Field(default=None, gt=0)
    size_label: str | None = Field(default=None, max_length=40)
    base_price: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=4000)
    photo_path: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


# ─── List ────────────────────────────────────────────────────────────


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
        items=[_to_response(p) for p in items],
        total=total,
        offset=offset,
        limit=limit,
    )


# ─── Detail ──────────────────────────────────────────────────────────


@router.get("/panels/{panel_id}", response_model=PanelResponse)
async def get_panel_admin(
    panel_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    panel = await GetPanelAdmin(panel_repo).execute(panel_id)
    return _to_response(panel)


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
        description=body.description,
        photo_path=body.photo_path,
        is_active=body.is_active,
    )
    return _to_response(panel)


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
        description=body.description,
        photo_path=body.photo_path,
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
