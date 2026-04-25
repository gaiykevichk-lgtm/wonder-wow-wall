"""Phase 7A — admin Category + Design CRUD endpoints.

Categories:
* `GET    /api/admin/categories`            — list with design counts
* `POST   /api/admin/categories`            — create
* `PATCH  /api/admin/categories/{id}`       — partial update
* `DELETE /api/admin/categories/{id}`       — refused if in-use (409)

Designs:
* `GET    /api/admin/designs`                       — paginated, includes unpublished
* `GET    /api/admin/designs/{id}`                  — detail
* `POST   /api/admin/designs`                       — create
* `PATCH  /api/admin/designs/{id}`                  — partial update
* `POST   /api/admin/designs/{id}/toggle-visibility`— flip is_published
* `DELETE /api/admin/designs/{id}`                  — hard delete + cascade cleanup

Domain → HTTP mapping (registered in `app/main.py`):
  `DesignNotFoundError`        → 404 + `{detail, code: "design_not_found"}`
  `DesignSlugConflictError`    → 409 + `{detail, code: "design_slug_conflict"}`
  `CategoryNotFoundError`      → 404 + `{detail, code: "category_not_found"}`
  `CategorySlugConflictError`  → 409 + `{detail, code: "category_slug_conflict"}`
  `CategoryInUseError`         → 409 + `{detail, code: "category_in_use"}`

Pydantic models do shape validation (string length, non-negative ints);
domain invariants (slug uniqueness, category existence, in-use guard)
live in the use cases — same split as Phase 4B/5/7B.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.admin_use_cases import (
    CreateCategoryAdmin,
    CreateDesignAdmin,
    DeleteCategoryAdmin,
    DeleteDesignAdmin,
    ListCategoriesAdmin,
    ListDesignsAdmin,
    ToggleDesignVisibilityAdmin,
    UpdateCategoryAdmin,
    UpdateDesignAdmin,
)
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
)
from app.application.catalog.use_cases import GetDesignDetails
from app.container import (
    get_audit_repo,
    get_category_repo,
    get_design_repo,
    get_recommendation_repo,
)
from app.domain.catalog.catalog_exceptions import (
    CategoryNotFoundError,
    DesignNotFoundError,
)
from app.domain.catalog.entities import Category, Design
from app.domain.catalog.value_objects import Color
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════


class CategoryAdminResponse(BaseModel):
    id: str
    name: str
    slug: str
    image: str
    designs_count: int


class CategoryListResponse(BaseModel):
    items: list[CategoryAdminResponse] = Field(default_factory=list)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)
    image: str = Field(default="", max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    image: str | None = Field(default=None, max_length=500)


class ColorPayload(BaseModel):
    """Mirror of `app/domain/catalog/value_objects.Color`.

    Hex is validated only for length (#RRGGBB) — a malformed colour
    string would render as itself in the catalog UI rather than crash
    the page; the admin form is the authority on shape.
    """
    hex: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=64)


class DesignAdminResponse(BaseModel):
    id: str
    name: str
    slug: str
    category_id: str
    style: str
    image: str
    description: str
    price: int
    colors: list[ColorPayload] = Field(default_factory=list)
    rating: float
    reviews_count: int
    is_new: bool
    is_popular: bool
    is_published: bool
    created_at: str


class DesignListResponse(BaseModel):
    items: list[DesignAdminResponse] = Field(default_factory=list)
    total: int
    offset: int
    limit: int


class DesignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    category_id: str = Field(min_length=1, max_length=36)
    style: str = Field(default="", max_length=100)
    image: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=4000)
    price: int = Field(ge=0)
    colors: list[ColorPayload] = Field(default_factory=list)
    is_published: bool = True
    is_new: bool = False
    is_popular: bool = False


class DesignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: str | None = Field(default=None, min_length=1, max_length=36)
    style: str | None = Field(default=None, max_length=100)
    image: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=4000)
    price: int | None = Field(default=None, ge=0)
    colors: list[ColorPayload] | None = None
    is_published: bool | None = None
    is_new: bool | None = None
    is_popular: bool | None = None


# ─── Mappers ────────────────────────────────────────────────────────


def _category_to_response(c: Category, designs_count: int) -> CategoryAdminResponse:
    return CategoryAdminResponse(
        id=c.id, name=c.name, slug=c.slug, image=c.image,
        designs_count=designs_count,
    )


def _design_to_response(d: Design) -> DesignAdminResponse:
    return DesignAdminResponse(
        id=d.id, name=d.name, slug=d.slug, category_id=d.category_id,
        style=d.style, image=d.image, description=d.description,
        price=d.price,
        colors=[ColorPayload(hex=c.hex, name=c.name) for c in d.colors],
        rating=d.rating, reviews_count=d.reviews_count,
        is_new=d.is_new, is_popular=d.is_popular,
        is_published=d.is_published,
        created_at=d.created_at.isoformat(),
    )


# ═══════════════════════════════════════════════════════════════════════
# Categories
# ═══════════════════════════════════════════════════════════════════════


@router.get("/categories", response_model=CategoryListResponse)
async def list_categories_admin(
    _admin_id: str = Depends(get_current_admin_id),
    category_repo=Depends(get_category_repo),
):
    rows = await ListCategoriesAdmin(category_repo).execute()
    return CategoryListResponse(
        items=[_category_to_response(c, n) for (c, n) in rows],
    )


@router.post("/categories", response_model=CategoryAdminResponse, status_code=201)
async def create_category_admin(
    body: CategoryCreate,
    _admin_id: str = Depends(get_current_admin_id),
    category_repo=Depends(get_category_repo),
):
    category = await CreateCategoryAdmin(category_repo).execute(
        name=body.name, slug=body.slug, image=body.image,
    )
    # Fresh row → 0 designs.
    return _category_to_response(category, 0)


@router.patch("/categories/{category_id}", response_model=CategoryAdminResponse)
async def update_category_admin(
    category_id: str,
    body: CategoryUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    category_repo=Depends(get_category_repo),
):
    category = await UpdateCategoryAdmin(category_repo).execute(
        category_id=category_id,
        name=body.name, slug=body.slug, image=body.image,
    )
    n = await category_repo.count_designs(category_id)
    return _category_to_response(category, n)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category_admin(
    category_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    category_repo=Depends(get_category_repo),
):
    deleted = await DeleteCategoryAdmin(category_repo).execute(category_id)
    if not deleted:
        # Defer to the global handler for the {detail, code} envelope.
        raise CategoryNotFoundError(f"Category {category_id} not found")
    return Response(status_code=204)


# ═══════════════════════════════════════════════════════════════════════
# Designs
# ═══════════════════════════════════════════════════════════════════════


@router.get("/designs", response_model=DesignListResponse)
async def list_designs_admin(
    category_id: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
    sort: str = Query("name"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
):
    """Admin design list — sees published AND unpublished rows.

    Public catalog has its own endpoint that hard-codes `is_published=True`
    so this endpoint cannot be coerced into leaking hidden designs by URL
    fiddling.
    """
    items, total = await ListDesignsAdmin(design_repo).execute(
        category_id=category_id,
        search=search,
        sort_by=sort,
        offset=offset,
        limit=limit,
    )
    return DesignListResponse(
        items=[_design_to_response(d) for d in items],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/designs/{design_id}", response_model=DesignAdminResponse)
async def get_design_admin(
    design_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
):
    design = await GetDesignDetails(design_repo).execute(design_id)
    if design is None:
        raise DesignNotFoundError(f"Design {design_id} not found")
    return _design_to_response(design)


@router.post("/designs", response_model=DesignAdminResponse, status_code=201)
async def create_design_admin(
    body: DesignCreate,
    _admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
    category_repo=Depends(get_category_repo),
):
    design = await CreateDesignAdmin(design_repo, category_repo).execute(
        name=body.name,
        slug=body.slug,
        category_id=body.category_id,
        style=body.style,
        image=body.image,
        description=body.description,
        price=body.price,
        colors=[Color(hex=c.hex, name=c.name) for c in body.colors],
        is_published=body.is_published,
        is_new=body.is_new,
        is_popular=body.is_popular,
    )
    return _design_to_response(design)


@router.patch("/designs/{design_id}", response_model=DesignAdminResponse)
async def update_design_admin(
    design_id: str,
    body: DesignUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
    category_repo=Depends(get_category_repo),
):
    colors_arg = (
        [Color(hex=c.hex, name=c.name) for c in body.colors]
        if body.colors is not None
        else None
    )
    design = await UpdateDesignAdmin(design_repo, category_repo).execute(
        design_id=design_id,
        name=body.name,
        slug=body.slug,
        category_id=body.category_id,
        style=body.style,
        image=body.image,
        description=body.description,
        price=body.price,
        colors=colors_arg,
        is_published=body.is_published,
        is_new=body.is_new,
        is_popular=body.is_popular,
    )
    return _design_to_response(design)


@router.post(
    "/designs/{design_id}/toggle-visibility",
    response_model=DesignAdminResponse,
)
async def toggle_design_visibility_admin(
    design_id: str,
    admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    # Phase 9 — audit toggles (publish/unpublish) but NOT routine
    # content edits (handled separately in `UpdateDesignAdmin` if ever
    # extended). The diff payload `{from, to, name, slug}` is built
    # inside the use case; we just hand it the recorder.
    design = await ToggleDesignVisibilityAdmin(
        design_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(design_id, actor_id=admin_id)
    return _design_to_response(design)


@router.delete("/designs/{design_id}", status_code=204)
async def delete_design_admin(
    design_id: str,
    admin_id: str = Depends(get_current_admin_id),
    design_repo=Depends(get_design_repo),
    audit_repo=Depends(get_audit_repo),
    rec_repo=Depends(get_recommendation_repo),
    ip: str | None = Depends(get_request_ip),
):
    # Phase 10 — wire the recommendation cleanup so a deleted design
    # cannot leave orphan rows in `recommendations` (as source) or
    # `recommendation_targets` (as target). The cascade report is
    # folded into the DESIGN_DELETE audit entry by the use case.
    deleted = await DeleteDesignAdmin(
        design_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        recommendation_cleanup=CleanupRecommendationsOnDelete(rec_repo),
    ).execute(design_id, actor_id=admin_id)
    if not deleted:
        raise DesignNotFoundError(f"Design {design_id} not found")
    return Response(status_code=204)
