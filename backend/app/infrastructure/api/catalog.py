from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.application.catalog.use_cases import ListDesigns, GetDesignDetails, ListCategories, AddReview, ListReviews
from app.container import design_repo, category_repo, review_repo
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
    rating: int
    text: str


# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("/designs", response_model=DesignListResponse)
async def list_designs(
    category: str | None = None,
    search: str | None = None,
    sort: str = "name",
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    uc = ListDesigns(design_repo)
    designs, total = await uc.execute(category, search, sort, offset, limit)
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
async def get_design(design_id: str):
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
async def list_categories():
    uc = ListCategories(category_repo)
    cats = await uc.execute()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "image": c.image, "count": c.count} for c in cats]


@router.get("/designs/{design_id}/reviews", response_model=list[ReviewSchema])
async def get_reviews(design_id: str, offset: int = 0, limit: int = 20):
    uc = ListReviews(review_repo)
    reviews = await uc.execute(design_id, offset, limit)
    return [
        {"id": r.id, "design_id": r.design_id, "user_name": r.user_name,
         "rating": r.rating, "text": r.text, "created_at": r.created_at.isoformat()}
        for r in reviews
    ]


@router.post("/designs/{design_id}/reviews", response_model=ReviewSchema, status_code=201)
async def add_review(design_id: str, body: AddReviewRequest, user_id: str = Depends(get_current_user_id)):
    uc = AddReview(design_repo, review_repo)
    try:
        r = await uc.execute(design_id, user_id, "Пользователь", body.rating, body.text)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": r.id, "design_id": r.design_id, "user_name": r.user_name,
        "rating": r.rating, "text": r.text, "created_at": r.created_at.isoformat(),
    }
