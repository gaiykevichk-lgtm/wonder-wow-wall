from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field

from app.application.catalog.texture_use_cases import (
    CreateTextureAdmin,
    CreateTextureColorAdmin,
    DeleteTextureAdmin,
    DeleteTextureColorAdmin,
    ListTextureColorsAdmin,
    ListTexturesAdmin,
    UpdateTextureAdmin,
    UpdateTextureColorAdmin,
)
from app.application.catalog.variant_image_use_cases import (
    CreateVariantImageAdmin,
    DeleteVariantImageAdmin,
    ListVariantImagesAdmin,
)
from app.container import (
    get_design_repo,
    get_texture_color_repo,
    get_texture_repo,
    get_variant_image_repo,
)
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────


class TextureResponse(BaseModel):
    id: str
    name: str
    slug: str
    swatch_image: str
    sort_order: int
    is_active: bool
    created_at: str


class TextureCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=120)
    swatch_image: str = Field(default="", max_length=500)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class TextureUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    swatch_image: str | None = Field(default=None, max_length=500)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class TextureColorResponse(BaseModel):
    id: str
    texture_id: str
    name: str
    hex: str
    swatch_image: str
    sort_order: int
    is_active: bool
    created_at: str


class TextureColorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    hex: str = Field(default="", max_length=7)
    swatch_image: str = Field(default="", max_length=500)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class TextureColorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    hex: str | None = Field(default=None, max_length=7)
    swatch_image: str | None = Field(default=None, max_length=500)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class VariantImageResponse(BaseModel):
    id: str
    design_id: str
    texture_id: str
    color_id: str
    image_path: str
    created_at: str


class VariantImageCreate(BaseModel):
    design_id: str = Field(min_length=1, max_length=36)
    texture_id: str = Field(min_length=1, max_length=36)
    color_id: str = Field(min_length=1, max_length=36)
    image_path: str = Field(min_length=1, max_length=500)


# ─── Helpers ─────────────────────────────────────────────────────────


def _texture_to_response(t) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "swatch_image": t.swatch_image,
        "sort_order": t.sort_order,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat(),
    }


def _color_to_response(c) -> dict:
    return {
        "id": c.id,
        "texture_id": c.texture_id,
        "name": c.name,
        "hex": c.hex,
        "swatch_image": c.swatch_image,
        "sort_order": c.sort_order,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat(),
    }


def _variant_to_response(v) -> dict:
    return {
        "id": v.id,
        "design_id": v.design_id,
        "texture_id": v.texture_id,
        "color_id": v.color_id,
        "image_path": v.image_path,
        "created_at": v.created_at.isoformat(),
    }


# ─── Texture CRUD ───────────────────────────────────────────────────


@router.get("/textures", response_model=list[TextureResponse])
async def list_textures_admin(
    _admin_id: str = Depends(get_current_admin_id),
    texture_repo=Depends(get_texture_repo),
):
    items = await ListTexturesAdmin(texture_repo).execute()
    return [_texture_to_response(t) for t in items]


@router.post("/textures", response_model=TextureResponse, status_code=201)
async def create_texture_admin(
    body: TextureCreate,
    _admin_id: str = Depends(get_current_admin_id),
    texture_repo=Depends(get_texture_repo),
):
    texture = await CreateTextureAdmin(texture_repo).execute(
        name=body.name,
        slug=body.slug,
        swatch_image=body.swatch_image,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    return _texture_to_response(texture)


@router.patch("/textures/{texture_id}", response_model=TextureResponse)
async def update_texture_admin(
    texture_id: str,
    body: TextureUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    texture_repo=Depends(get_texture_repo),
):
    texture = await UpdateTextureAdmin(texture_repo).execute(
        texture_id,
        name=body.name,
        slug=body.slug,
        swatch_image=body.swatch_image,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    return _texture_to_response(texture)


@router.delete("/textures/{texture_id}", status_code=204)
async def delete_texture_admin(
    texture_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    texture_repo=Depends(get_texture_repo),
    variant_repo=Depends(get_variant_image_repo),
):
    await DeleteTextureAdmin(texture_repo, variant_repo).execute(texture_id)
    return Response(status_code=204)


# ─── Texture Color CRUD ─────────────────────────────────────────────


@router.get(
    "/textures/{texture_id}/colors",
    response_model=list[TextureColorResponse],
)
async def list_texture_colors_admin(
    texture_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    color_repo=Depends(get_texture_color_repo),
):
    items = await ListTextureColorsAdmin(color_repo).execute(texture_id)
    return [_color_to_response(c) for c in items]


@router.post(
    "/textures/{texture_id}/colors",
    response_model=TextureColorResponse,
    status_code=201,
)
async def create_texture_color_admin(
    texture_id: str,
    body: TextureColorCreate,
    _admin_id: str = Depends(get_current_admin_id),
    color_repo=Depends(get_texture_color_repo),
    texture_repo=Depends(get_texture_repo),
):
    color = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
        texture_id=texture_id,
        name=body.name,
        hex=body.hex,
        swatch_image=body.swatch_image,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    return _color_to_response(color)


@router.patch(
    "/texture-colors/{color_id}",
    response_model=TextureColorResponse,
)
async def update_texture_color_admin(
    color_id: str,
    body: TextureColorUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    color_repo=Depends(get_texture_color_repo),
):
    color = await UpdateTextureColorAdmin(color_repo).execute(
        color_id,
        name=body.name,
        hex=body.hex,
        swatch_image=body.swatch_image,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    return _color_to_response(color)


@router.delete("/texture-colors/{color_id}", status_code=204)
async def delete_texture_color_admin(
    color_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    color_repo=Depends(get_texture_color_repo),
):
    await DeleteTextureColorAdmin(color_repo).execute(color_id)
    return Response(status_code=204)


# ─── Variant Image CRUD ─────────────────────────────────────────────


@router.get("/variant-images", response_model=list[VariantImageResponse])
async def list_variant_images_admin(
    design_id: str | None = Query(None),
    texture_id: str | None = Query(None),
    _admin_id: str = Depends(get_current_admin_id),
    variant_repo=Depends(get_variant_image_repo),
):
    items = await ListVariantImagesAdmin(variant_repo).execute(
        design_id=design_id,
        texture_id=texture_id,
    )
    return [_variant_to_response(v) for v in items]


@router.post(
    "/variant-images",
    response_model=VariantImageResponse,
    status_code=201,
)
async def create_variant_image_admin(
    body: VariantImageCreate,
    _admin_id: str = Depends(get_current_admin_id),
    variant_repo=Depends(get_variant_image_repo),
    design_repo=Depends(get_design_repo),
    texture_repo=Depends(get_texture_repo),
    color_repo=Depends(get_texture_color_repo),
):
    vi = await CreateVariantImageAdmin(
        variant_repo, design_repo, texture_repo, color_repo,
    ).execute(
        design_id=body.design_id,
        texture_id=body.texture_id,
        color_id=body.color_id,
        image_path=body.image_path,
    )
    return _variant_to_response(vi)


@router.delete("/variant-images/{variant_id}", status_code=204)
async def delete_variant_image_admin(
    variant_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    variant_repo=Depends(get_variant_image_repo),
):
    await DeleteVariantImageAdmin(variant_repo).execute(variant_id)
    return Response(status_code=204)
