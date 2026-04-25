from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.application.catalog.use_cases import ListDesigns, GetDesignDetails, ListCategories, AddReview, ListReviews
from app.application.catalog.panel_use_cases import ListPanelsPublic
from app.container import get_design_repo, get_category_repo, get_review_repo, get_panel_repo
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
    description: str
    price: int
    colors: list[ColorSchema]
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
):
    uc = ListDesigns(design_repo)
    designs, total = await uc.execute(
        category, search, sort, offset, limit,
        color=color, style=style, is_new=is_new,
    )
    return {
        "items": [
            {
                "id": d.id, "name": d.name, "slug": d.slug, "category_id": d.category_id,
                "style": d.style, "image": d.image, "description": d.description,
                "price": d.price, "colors": [{"hex": c.hex, "name": c.name} for c in d.colors],
                "rating": d.rating, "reviews_count": d.reviews_count,
                "is_new": d.is_new, "is_popular": d.is_popular,
            }
            for d in designs
        ],
        "total": total,
    }


@router.get("/designs/{design_id}", response_model=DesignSchema)
async def get_design(request: Request, design_id: str, design_repo=Depends(get_design_repo)):
    uc = GetDesignDetails(design_repo)
    d = await uc.execute(design_id)
    if not d:
        raise HTTPException(status_code=404, detail="Design not found")
    return {
        "id": d.id, "name": d.name, "slug": d.slug, "category_id": d.category_id,
        "style": d.style, "image": d.image, "description": d.description,
        "price": d.price, "colors": [{"hex": c.hex, "name": c.name} for c in d.colors],
        "rating": d.rating, "reviews_count": d.reviews_count,
        "is_new": d.is_new, "is_popular": d.is_popular,
    }


@router.get("/categories", response_model=list[CategorySchema])
async def list_categories(request: Request, category_repo=Depends(get_category_repo)):
    uc = ListCategories(category_repo)
    cats = await uc.execute()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "image": c.image, "count": c.count} for c in cats]


@router.get("/designs/{design_id}/reviews", response_model=list[ReviewSchema])
async def get_reviews(request: Request, design_id: str, offset: int = 0, limit: int = 20, review_repo=Depends(get_review_repo)):
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
                "photo_path": p.photo_path,
                "is_active": p.is_active,
            }
            for p in items
        ],
        "total": total,
    }


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
