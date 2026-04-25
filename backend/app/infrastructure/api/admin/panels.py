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

from app.application.catalog.panel_use_cases import (
    CreatePanelAdmin,
    DeletePanelAdmin,
    GetPanelAdmin,
    ListPanelsAdmin,
    UpdatePanelAdmin,
)
from app.container import get_panel_repo
from app.domain.catalog.panel import Panel
from app.domain.catalog.value_objects import PanelSize
from app.utils.dependencies import get_current_admin_id

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


class PanelsListResponse(BaseModel):
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


class CreatePanelRequest(BaseModel):
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


class UpdatePanelRequest(BaseModel):
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


@router.get("/panels", response_model=PanelsListResponse)
async def list_panels_admin(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    """Admin list — includes inactive panels.

    Public catalog has its own endpoint that hard-codes
    `include_inactive=False` so this endpoint cannot be coerced into
    leaking hidden SKUs by URL fiddling.
    """
    items, total = await ListPanelsAdmin(panel_repo).execute(
        offset=offset, limit=limit,
    )
    return PanelsListResponse(
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
    body: CreatePanelRequest,
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
    body: UpdatePanelRequest,
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    # Recompose size only if at least one of its three components is
    # present in the patch — passing one field alone (e.g. just
    # width_mm) requires loading the current row to fill the others, so
    # we delegate that to the use case which already does `get_by_id`.
    size: PanelSize | None = None
    if (
        body.width_mm is not None
        or body.height_mm is not None
        or body.size_label is not None
    ):
        # Load current to fill any unspecified component. Keeps the
        # admin UI free to update just `size_label` without re-sending
        # dimensions.
        current = await GetPanelAdmin(panel_repo).execute(panel_id)
        size = PanelSize(
            width_mm=body.width_mm if body.width_mm is not None else current.size.width_mm,
            height_mm=body.height_mm if body.height_mm is not None else current.size.height_mm,
            label=body.size_label if body.size_label is not None else current.size.label,
        )
    panel = await UpdatePanelAdmin(panel_repo).execute(
        panel_id=panel_id,
        name=body.name,
        slug=body.slug,
        size=size,
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
    _admin_id: str = Depends(get_current_admin_id),
    panel_repo=Depends(get_panel_repo),
):
    deleted = await DeletePanelAdmin(panel_repo).execute(panel_id)
    if not deleted:
        # 404 with the same envelope shape the global handler emits —
        # keeps the frontend's branching uniform.
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=404,
            content={"detail": f"Panel {panel_id} not found", "code": "panel_not_found"},
        )
    return Response(status_code=204)
