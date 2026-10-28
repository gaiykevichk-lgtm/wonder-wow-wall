"""Phase 8B — admin Banner CRUD endpoints.

* `GET    /api/admin/shop/banners`            — list (incl. inactive), filterable by `?position=`
* `GET    /api/admin/shop/banners/{id}`       — single
* `POST   /api/admin/shop/banners`            — create (201)
* `PATCH  /api/admin/shop/banners/{id}`       — partial update
* `DELETE /api/admin/shop/banners/{id}`       — hard delete (204)

Domain → HTTP mapping (registered in `app/main.py`):
  `BannerNotFoundError` → 404 + `{detail, code: "banner_not_found"}`

Pydantic carries shape validation; domain invariants
(`Banner.__post_init__` + use-case re-checks) live in
`app/application/shop/banner_use_cases.py`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.shop.banner_use_cases import (
    CreateBannerAdmin,
    DeleteBannerAdmin,
    GetBannerAdmin,
    ListBannersAdmin,
    UpdateBannerAdmin,
)
from app.container import get_audit_repo, get_banner_repo
from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────


class BannerResponse(BaseModel):
    id: str
    title: str
    subtitle: str
    image_path: str
    cta_label: str
    cta_url: str
    position: str
    priority: int
    is_active: bool
    created_at: str
    updated_at: str


class BannerListResponse(BaseModel):
    items: list[BannerResponse] = Field(default_factory=list)


class BannerCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subtitle: str = Field(default="", max_length=500)
    image_path: str = Field(default="", max_length=500)
    cta_label: str = Field(default="", max_length=100)
    cta_url: str = Field(default="", max_length=500)
    # Mirrors `BannerPosition` — Pydantic enum-validate via `str` literal.
    position: str = Field(default="homepage_hero")
    priority: int = Field(default=0, ge=0)
    is_active: bool = True


class BannerUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=500)
    image_path: str | None = Field(default=None, max_length=500)
    cta_label: str | None = Field(default=None, max_length=100)
    cta_url: str | None = Field(default=None, max_length=500)
    position: str | None = Field(default=None)
    priority: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


def _to_response(b: Banner) -> BannerResponse:
    return BannerResponse(
        id=b.id, title=b.title, subtitle=b.subtitle,
        image_path=b.image_path, cta_label=b.cta_label, cta_url=b.cta_url,
        position=b.position.value, priority=b.priority,
        is_active=b.is_active,
        created_at=b.created_at.isoformat(),
        updated_at=b.updated_at.isoformat(),
    )


def _parse_position(raw: str) -> BannerPosition:
    try:
        return BannerPosition(raw)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown position {raw!r}; expected one of "
                f"{[p.value for p in BannerPosition]}"
            ),
        )


# ─── Endpoints ───────────────────────────────────────────────────────


@router.get("/shop/banners", response_model=BannerListResponse)
async def list_banners_admin(
    position: str | None = Query(None),
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_banner_repo),
):
    pos = _parse_position(position) if position else None
    items = await ListBannersAdmin(repo).execute(position=pos)
    return BannerListResponse(items=[_to_response(b) for b in items])


@router.get("/shop/banners/{banner_id}", response_model=BannerResponse)
async def get_banner_admin(
    banner_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_banner_repo),
):
    banner = await GetBannerAdmin(repo).execute(banner_id)
    return _to_response(banner)


@router.post("/shop/banners", response_model=BannerResponse, status_code=201)
async def create_banner_admin(
    body: BannerCreate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_banner_repo),
):
    pos = _parse_position(body.position)
    banner = await CreateBannerAdmin(repo).execute(
        title=body.title, subtitle=body.subtitle,
        image_path=body.image_path, cta_label=body.cta_label,
        cta_url=body.cta_url, position=pos, priority=body.priority,
        is_active=body.is_active,
    )
    return _to_response(banner)


@router.patch("/shop/banners/{banner_id}", response_model=BannerResponse)
async def update_banner_admin(
    banner_id: str,
    body: BannerUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_banner_repo),
):
    pos = _parse_position(body.position) if body.position is not None else None
    banner = await UpdateBannerAdmin(repo).execute(
        banner_id=banner_id,
        title=body.title, subtitle=body.subtitle,
        image_path=body.image_path, cta_label=body.cta_label,
        cta_url=body.cta_url, position=pos, priority=body.priority,
        is_active=body.is_active,
    )
    return _to_response(banner)


@router.delete("/shop/banners/{banner_id}", status_code=204)
async def delete_banner_admin(
    banner_id: str,
    admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_banner_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    deleted = await DeleteBannerAdmin(
        repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(banner_id, actor_id=admin_id)
    if not deleted:
        raise BannerNotFoundError(f"Banner {banner_id} not found")
    return Response(status_code=204)
