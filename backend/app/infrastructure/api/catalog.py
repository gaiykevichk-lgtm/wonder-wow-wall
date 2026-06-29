from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from app.application.catalog.use_cases import ListDesigns, GetDesignDetails, ListCategories, AddReview, ListReviews
from app.application.catalog.panel_use_cases import ListPanelsPublic
from app.application.catalog.recommendation_fallback import (
    DesignSimilarityFallback,
)
from app.application.catalog.recommendation_use_cases import (
    GetPublicRecommendations,
)
from app.application.catalog.texture_use_cases import (
    ListTexturesPublic,
    ListTextureColorsPublic,
)
from app.application.catalog.variant_image_use_cases import (
    GetVariantImage,
    ListVariantImagesByDesign,
)
from app.container import (
    get_design_repo,
    get_category_repo,
    get_review_repo,
    get_panel_repo,
    get_recommendation_repo,
    get_texture_repo,
    get_texture_color_repo,
    get_variant_image_repo,
    get_file_storage,
)
from app.domain.media.services import FileStorage
from app.domain.catalog.recommendation import (
    DEFAULT_RECOMMENDATIONS_LIMIT,
    RecommendationSourceType,
)
from app.utils.dependencies import get_current_user_id, get_optional_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class ColorSchema(BaseModel):
    hex: str
    name: str


class DesignSchema(BaseModel):
    id: str
    name: str
    slug: str
    category_id: str
    style: str
    image: str
    preview_image: str = ""
    description: str
    price: int
    colors: list[ColorSchema]
    default_colors: list[ColorSchema] = Field(default_factory=list)
    rating: float
    reviews_count: int
    is_new: bool
    is_popular: bool


class DesignListResponse(BaseModel):
    items: list[DesignSchema]
    total: int


class CategorySchema(BaseModel):
    id: str
    name: str
    slug: str
    image: str
    count: int


class ReviewSchema(BaseModel):
    id: str
    design_id: str
    user_name: str
    rating: int
    text: str
    created_at: str


class AddReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=500)


class PanelSchema(BaseModel):
    """Phase 7B — public catalog panel SKU.

    Mirrors `PanelResponse` in `admin/panels.py` so the frontend can
    share the type. The two endpoints differ only in scope (admin sees
    inactive panels too) — same payload shape.
    """
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


class PanelListResponse(BaseModel):
    items: list[PanelSchema] = Field(default_factory=list)
    total: int


class RecommendationTargetSchema(BaseModel):
    """Phase 10 — public recommendation target.

    Flat shape (`target_type`/`target_id`) so the frontend can map
    directly to its existing `Design`/`Panel` query keys without
    re-derivation. The catalog UI does the lookup against its already
    cached entities (TanStack Query) — the API stays minimal.
    """
    target_type: str
    target_id: str


class RecommendationListResponse(BaseModel):
    """Always returns `items` — possibly empty, never null.

    The consumer renders the rail unconditionally; an empty list means
    "show nothing" rather than triggering a hard error in the UI.
    """
    items: list[RecommendationTargetSchema] = Field(default_factory=list)


class TextureColorPublicSchema(BaseModel):
    id: str
    name: str
    hex: str
    swatch_image: str


class TextureWithColorsSchema(BaseModel):
    id: str
    name: str
    slug: str
    swatch_image: str
    colors: list[TextureColorPublicSchema] = Field(default_factory=list)


class VariantImageSchema(BaseModel):
    image_path: str


class FullConfigTextureSchema(BaseModel):
    id: str
    name: str
    slug: str
    swatch_image: str
    colors: list[TextureColorPublicSchema] = Field(default_factory=list)


class FullConfigResponse(BaseModel):
    id: str
    name: str
    slug: str
    preview_image: str
    description: str
    price: int
    textures: list[FullConfigTextureSchema] = Field(default_factory=list)
    variant_images: list[dict] = Field(default_factory=list)


# ─── Helpers ─────────────────────────────────────────────────────────


async def _compute_default_colors_batch(
    design_ids: list[str],
    texture_repo,
    color_repo,
    variant_repo,
) -> dict[str, list[dict]]:
    """Return {design_id: [{hex, name}, ...]} from the first texture per design."""
    all_textures = await ListTexturesPublic(texture_repo).execute()
    if not all_textures:
        return {}

    texture_by_id = {t.id: t for t in all_textures}
    texture_order = {t.id: i for i, t in enumerate(all_textures)}

    result: dict[str, list[dict]] = {}
    for design_id in design_ids:
        variants = await ListVariantImagesByDesign(variant_repo).execute(design_id)
        if not variants:
            continue
        texture_ids_for_design = {v.texture_id for v in variants if v.texture_id in texture_by_id}
        if not texture_ids_for_design:
            continue
        first_texture_id = min(texture_ids_for_design, key=lambda tid: texture_order.get(tid, 9999))
        colors = await ListTextureColorsPublic(color_repo).execute(first_texture_id)
        if colors:
            result[design_id] = [{"hex": c.hex, "name": c.name} for c in colors]

    return result


def _serialize_design(d, default_colors: list[dict] | None = None, storage: FileStorage | None = None) -> dict:
    def _url(path: str) -> str:
        return storage.url_for(path) if (storage and path) else path
    return {
        "id": d.id, "name": d.name, "slug": d.slug, "category_id": d.category_id,
        "style": d.style, "image": d.image,
        "preview_image": _url(d.preview_image),
        "description": d.description,
        "price": d.price, "colors": [{"hex": c.hex, "name": c.name} for c in d.colors],
        "default_colors": default_colors or [],
        "rating": d.rating, "reviews_count": d.reviews_count,
        "is_new": d.is_new, "is_popular": d.is_popular,
    }


# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("/designs", response_model=DesignListResponse)
async def list_designs(
    request: Request,
    category: str | None = None,
    search: str | None = None,
    sort: str = "name",
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    color: str | None = None,
    style: str | None = None,
    is_new: bool | None = None,
    design_repo=Depends(get_design_repo),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    variant_repo=Depends(get_variant_image_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    uc = ListDesigns(design_repo)
    designs, total = await uc.execute(
        category, search, sort, offset, limit,
        color=color, style=style, is_new=is_new,
    )
    dc_map = await _compute_default_colors_batch(
        [d.id for d in designs], texture_repo, color_repo, variant_repo,
    )
    return {
        "items": [_serialize_design(d, dc_map.get(d.id), storage) for d in designs],
        "total": total,
    }


@router.get("/designs/{design_id}", response_model=DesignSchema)
async def get_design(
    request: Request,
    design_id: str,
    design_repo=Depends(get_design_repo),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    variant_repo=Depends(get_variant_image_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    uc = GetDesignDetails(design_repo)
    d = await uc.execute(design_id)
    if not d or not d.is_published:
        raise HTTPException(status_code=404, detail="Design not found")
    dc_map = await _compute_default_colors_batch(
        [d.id], texture_repo, color_repo, variant_repo,
    )
    return _serialize_design(d, dc_map.get(d.id), storage)


@router.get("/categories", response_model=list[CategorySchema])
async def list_categories(request: Request, category_repo=Depends(get_category_repo)):
    uc = ListCategories(category_repo)
    cats = await uc.execute()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "image": c.image, "count": c.count} for c in cats]


@router.get("/designs/{design_id}/reviews", response_model=list[ReviewSchema])
async def get_reviews(
    request: Request,
    design_id: str,
    offset: int = 0,
    limit: int = 20,
    design_repo=Depends(get_design_repo),
    review_repo=Depends(get_review_repo),
):
    # Phase 7A C2 — reviews of an unpublished design must not leak
    # either. Same 404-on-hidden posture as `get_design` so the
    # existence of the parent row is not disclosed via a 200 with an
    # empty list. Cheap pre-check (one indexed PK lookup); the admin
    # has dedicated endpoints if it needs unpublished review access.
    parent = await design_repo.get_by_id(design_id)
    if parent is None or not parent.is_published:
        raise HTTPException(status_code=404, detail="Design not found")
    uc = ListReviews(review_repo)
    reviews = await uc.execute(design_id, offset, limit)
    return [
        {"id": r.id, "design_id": r.design_id, "user_name": r.user_name,
         "rating": r.rating, "text": r.text, "created_at": r.created_at.isoformat()}
        for r in reviews
    ]


@router.get("/panels", response_model=PanelListResponse)
async def list_panels_public(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    panel_repo=Depends(get_panel_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    """Public catalog — active panels only.

    Use case hard-codes `include_inactive=False`; no `include_inactive`
    query param is accepted so this endpoint cannot be coerced into
    leaking hidden SKUs.
    """
    items, total = await ListPanelsPublic(panel_repo).execute(
        offset=offset, limit=limit,
    )
    return {
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "slug": p.slug,
                "width_mm": p.size.width_mm,
                "height_mm": p.size.height_mm,
                "size_label": p.size.label,
                "base_price": p.base_price,
                "description": p.description,
                "photo_path": storage.url_for(p.photo_path) if p.photo_path else "",
                "is_active": p.is_active,
            }
            for p in items
        ],
        "total": total,
    }


@router.get(
    "/recommendations/{source_type}/{source_id}",
    response_model=RecommendationListResponse,
)
async def get_public_recommendations(
    source_type: str,
    source_id: str,
    response: Response,
    limit: int = Query(
        DEFAULT_RECOMMENDATIONS_LIMIT, ge=1, le=50,
        description="Cap on returned items; clamped against the admin "
                    "limit by the use case as well.",
    ),
    rec_repo=Depends(get_recommendation_repo),
    design_repo=Depends(get_design_repo),
):
    """Public read for the «с этим покупают» rail on a product page.

    Composition: admin curated targets first (in admin order), then the
    `DesignSimilarityFallback` heuristic tops the list up to `limit`.
    Always returns 200 + a list — a missing source returns the
    fallback-only list rather than 404 so the catalog UI renders the
    rail uniformly.

    `source_type` validation maps a bad value to a uniform 422 via the
    same `_parse_source_type` pattern used by the admin route.
    """
    try:
        st = RecommendationSourceType(source_type)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown source_type {source_type!r}; "
                f"expected one of "
                f"{[s.value for s in RecommendationSourceType]}"
            ),
        )

    fallback = DesignSimilarityFallback(design_repo)
    targets = await GetPublicRecommendations(rec_repo, fallback).execute(
        source_type=st,
        source_id=source_id,
        limit=limit,
    )
    # Cache for 5 minutes — admin curation changes are rare and the
    # fallback heuristic is deterministic against the design catalog.
    # `public` lets shared caches (CDN, nginx) serve hits; an admin
    # who just edited the rail can hard-refresh the product page.
    response.headers["Cache-Control"] = "public, max-age=300"
    return RecommendationListResponse(
        items=[
            RecommendationTargetSchema(
                target_type=t.target_type.value,
                target_id=t.target_id,
            )
            for t in targets
        ],
    )


@router.post("/designs/{design_id}/reviews", response_model=ReviewSchema, status_code=201)
async def add_review(
    request: Request, design_id: str, body: AddReviewRequest,
    user_id: str = Depends(get_current_user_id),
    design_repo=Depends(get_design_repo),
    review_repo=Depends(get_review_repo),
):
    uc = AddReview(design_repo, review_repo)
    try:
        r = await uc.execute(design_id, user_id, "Пользователь", body.rating, body.text)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": r.id, "design_id": r.design_id, "user_name": r.user_name,
        "rating": r.rating, "text": r.text, "created_at": r.created_at.isoformat(),
    }


# ─── Phase 2 — Texture / Variant Image endpoints ───────────────────


@router.get("/textures", response_model=list[TextureWithColorsSchema])
async def list_textures_public(
    request: Request,
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    textures = await ListTexturesPublic(texture_repo).execute()
    result = []
    for t in textures:
        colors = await ListTextureColorsPublic(color_repo).execute(t.id)
        result.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "swatch_image": storage.url_for(t.swatch_image) if t.swatch_image else "",
            "colors": [
                {"id": c.id, "name": c.name, "hex": c.hex,
                 "swatch_image": storage.url_for(c.swatch_image) if c.swatch_image else ""}
                for c in colors
            ],
        })
    return result


@router.get("/textures/{texture_id}/colors", response_model=list[TextureColorPublicSchema])
async def list_texture_colors_public(
    request: Request,
    texture_id: str,
    color_repo=Depends(get_texture_color_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    colors = await ListTextureColorsPublic(color_repo).execute(texture_id)
    return [
        {"id": c.id, "name": c.name, "hex": c.hex,
         "swatch_image": storage.url_for(c.swatch_image) if c.swatch_image else ""}
        for c in colors
    ]


@router.get("/designs/{design_id}/textures", response_model=list[TextureWithColorsSchema])
async def list_design_textures(
    request: Request,
    design_id: str,
    design_repo=Depends(get_design_repo),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    variant_repo=Depends(get_variant_image_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    design = await design_repo.get_by_id(design_id)
    if not design or not design.is_published:
        raise HTTPException(status_code=404, detail="Design not found")
    textures = await ListTexturesPublic(texture_repo).execute()
    variants = await ListVariantImagesByDesign(variant_repo).execute(design_id)
    texture_ids_with_variants = {v.texture_id for v in variants}
    result = []
    for t in textures:
        if t.id not in texture_ids_with_variants:
            continue
        colors = await ListTextureColorsPublic(color_repo).execute(t.id)
        if not colors:
            continue
        result.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "swatch_image": storage.url_for(t.swatch_image) if t.swatch_image else "",
            "colors": [
                {"id": c.id, "name": c.name, "hex": c.hex,
                 "swatch_image": storage.url_for(c.swatch_image) if c.swatch_image else ""}
                for c in colors
            ],
        })
    return result


@router.get("/designs/{design_id}/variant-image", response_model=VariantImageSchema)
async def get_variant_image(
    request: Request,
    design_id: str,
    texture_id: str = Query(...),
    color_id: str = Query(...),
    design_repo=Depends(get_design_repo),
    variant_repo=Depends(get_variant_image_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    design = await design_repo.get_by_id(design_id)
    if not design or not design.is_published:
        raise HTTPException(status_code=404, detail="Design not found")
    vi = await GetVariantImage(variant_repo).execute(design_id, texture_id, color_id)
    if vi is None:
        raise HTTPException(status_code=404, detail="Variant image not found")
    return {"image_path": storage.url_for(vi.image_path) if vi.image_path else ""}


@router.get("/designs/{design_id}/full-config", response_model=FullConfigResponse)
async def get_full_config(
    request: Request,
    design_id: str,
    design_repo=Depends(get_design_repo),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
    variant_repo=Depends(get_variant_image_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    design = await design_repo.get_by_id(design_id)
    if not design or not design.is_published:
        raise HTTPException(status_code=404, detail="Design not found")
    all_textures = await ListTexturesPublic(texture_repo).execute()
    all_variants = await ListVariantImagesByDesign(variant_repo).execute(design_id)
    texture_ids_with_variants = {v.texture_id for v in all_variants}
    textures_out = []
    for t in all_textures:
        if t.id not in texture_ids_with_variants:
            continue
        colors = await ListTextureColorsPublic(color_repo).execute(t.id)
        if not colors:
            continue
        swatch = storage.url_for(t.swatch_image) if t.swatch_image else ""
        textures_out.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "swatch_image": swatch,
            "colors": [
                {"id": c.id, "name": c.name, "hex": c.hex,
                 "swatch_image": storage.url_for(c.swatch_image) if c.swatch_image else ""}
                for c in colors
            ],
        })
    variant_images_out = [
        {
            "design_id": v.design_id,
            "texture_id": v.texture_id,
            "color_id": v.color_id,
            "image_path": storage.url_for(v.image_path) if v.image_path else "",
        }
        for v in all_variants
    ]
    return {
        "id": design.id,
        "name": design.name,
        "slug": design.slug,
        "preview_image": storage.url_for(design.preview_image) if design.preview_image else "",
        "description": design.description,
        "price": design.price,
        "textures": textures_out,
        "variant_images": variant_images_out,
    }
