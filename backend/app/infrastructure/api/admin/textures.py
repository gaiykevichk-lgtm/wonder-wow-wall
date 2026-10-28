from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    get_db_session,
    get_design_repo,
    get_texture_color_repo,
    get_texture_repo,
    get_variant_image_repo,
)
from app.infrastructure.persistence.models import PanelModel, TextureCombinationImageModel, TextureModel, PanelVariantModel
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
    hex: str = Field(default="", max_length=7, pattern=r"^(#[0-9A-Fa-f]{6})?$")
    swatch_image: str = Field(default="", max_length=500)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class TextureColorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    hex: str | None = Field(default=None, max_length=7, pattern=r"^(#[0-9A-Fa-f]{6})?$")
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


SPACE_CARD_CATEGORIES = ('home', 'business', 'social')


class SpaceCardFields(BaseModel):
    """Тексты карточки «Пространств»: название, детали, цена, площадь, назначение."""

    title: str = Field(default='', max_length=255)
    project_id: str = Field(default='', max_length=36)
    project_address: str = Field(default='', max_length=255)
    execution_variant_id: str = Field(default='', max_length=36)
    subtitle: str = Field(default='', max_length=255)
    price: str = Field(default='', max_length=64)
    area: str = Field(default='', max_length=64)
    category: str = Field(default='home', max_length=16)


class TextureCombinationImageResponse(BaseModel):
    id: str
    texture_id_1: str
    texture_id_2: str
    # Семейства базовых форм (slug без суффикса размера). Пустые — строка
    # создана до привязки к панелям.
    panel_family_1: str = ""
    panel_family_2: str = ""
    image_path: str
    image_paths: list[str] = Field(default_factory=list)
    created_at: str
    card: SpaceCardFields = SpaceCardFields()


# Суффиксы размеров в slug панелей: семейство формы — slug без суффикса.
PANEL_FAMILY_SIZE_SUFFIXES = ("-300x300", "-300x600", "-600x600")


def _panel_family_from_slug(slug: str) -> str:
    value = (slug or "").strip()
    for suffix in PANEL_FAMILY_SIZE_SUFFIXES:
        if value.endswith(suffix):
            return value[: -len(suffix)]
    return value


def _normalize_panel_families(first: str, second: str) -> tuple[str, str]:
    ordered = sorted(((first or "").strip(), (second or "").strip()))
    return (ordered[0], ordered[1])


async def _validate_panel_families(session: AsyncSession, first: str, second: str) -> None:
    families = {family for family in (first, second) if family}
    if not families:
        return
    rows = (await session.execute(
        select(PanelModel.slug).where(PanelModel.is_active.is_(True))
    )).scalars().all()
    known = {_panel_family_from_slug(str(slug)) for slug in rows}
    missing = sorted(family for family in families if family not in known)
    if missing:
        raise HTTPException(status_code=404, detail="Одна из базовых панелей не найдена")


class TextureCombinationImageCreate(BaseModel):
    texture_id_1: str = Field(min_length=1, max_length=36)
    texture_id_2: str = Field(min_length=1, max_length=36)
    # Семейства базовых форм. Моно — одно семейство в обоих полях,
    # комбо — два разных. Пустые — привязки к панелям нет.
    panel_family_1: str = Field(default="", max_length=120)
    panel_family_2: str = Field(default="", max_length=120)
    image_path: str = Field(default="", max_length=500)
    image_paths: list[str] = Field(default_factory=list, max_length=50)
    # Карточка публикуется на /spaces только с названием и исполнением:
    # без них строка не должна сохраняться и для новых, и для правок.
    card: SpaceCardFields = Field(default_factory=SpaceCardFields)

    @model_validator(mode='after')
    def check_card_binding(self):
        if not (self.card.title or '').strip():
            raise ValueError('Заполните название карточки')
        if not (self.card.execution_variant_id or '').strip():
            raise ValueError('Выберите исполнение для карточки')
        return self


class TextureCombinationImageUpdate(BaseModel):
    texture_id_1: str = Field(min_length=1, max_length=36)
    texture_id_2: str = Field(min_length=1, max_length=36)
    panel_family_1: str = Field(default="", max_length=120)
    panel_family_2: str = Field(default="", max_length=120)
    image_path: str = Field(default="", max_length=500)
    image_paths: list[str] | None = Field(default=None, max_length=50)
    card: SpaceCardFields = Field(default_factory=SpaceCardFields)

    @model_validator(mode='after')
    def check_card_binding(self):
        if not (self.card.title or '').strip():
            raise ValueError('Заполните название карточки')
        if not (self.card.execution_variant_id or '').strip():
            raise ValueError('Выберите исполнение для карточки')
        return self


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


# ─── Texture combination image CRUD ────────────────────────────────


def _card_fields(row: TextureCombinationImageModel) -> SpaceCardFields:
    card = getattr(row, 'card', None) or {}
    category = str(card.get('category') or 'home')
    if category not in SPACE_CARD_CATEGORIES:
        category = 'home'
    return SpaceCardFields(
        title=str(card.get('title') or ''),
        project_id=str(card.get('project_id') or row.id),
        project_address=str(card.get('project_address') or ''),
        execution_variant_id=str(card.get('execution_variant_id') or ''),
        subtitle=str(card.get('subtitle') or ''),
        price=str(card.get('price') or ''),
        area=str(card.get('area') or ''),
        category=category,
    )


def _gallery_paths(row: TextureCombinationImageModel) -> list[str]:
    stored = getattr(row, 'image_paths', None) or []
    paths = [str(path) for path in stored if str(path or '').strip()]
    # Обратная совместимость со строками до миграции 037: галерея пуста,
    # есть только одиночное image_path.
    if not paths and str(getattr(row, 'image_path', '') or '').strip():
        paths = [str(row.image_path)]
    return paths


def _combination_to_response(row: TextureCombinationImageModel) -> TextureCombinationImageResponse:
    paths = _gallery_paths(row)
    return TextureCombinationImageResponse(
        id=row.id,
        texture_id_1=row.texture_id_1,
        texture_id_2=row.texture_id_2,
        panel_family_1=str(getattr(row, 'panel_family_1', '') or ''),
        panel_family_2=str(getattr(row, 'panel_family_2', '') or ''),
        image_path=paths[0] if paths else row.image_path,
        image_paths=paths,
        created_at=row.created_at.isoformat(),
        card=_card_fields(row),
    )


@router.get("/texture-combination-images", response_model=list[TextureCombinationImageResponse])
async def list_texture_combination_images_admin(
    texture_id: str | None = Query(None),
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    stmt = select(TextureCombinationImageModel).order_by(TextureCombinationImageModel.created_at.desc())
    if texture_id:
        stmt = stmt.where(or_(
            TextureCombinationImageModel.texture_id_1 == texture_id,
            TextureCombinationImageModel.texture_id_2 == texture_id,
        ))
    rows = (await session.execute(stmt)).scalars().all()
    return [_combination_to_response(row) for row in rows]


@router.post("/texture-combination-images", response_model=TextureCombinationImageResponse, status_code=201)
async def create_texture_combination_image_admin(
    body: TextureCombinationImageCreate,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    # Equal ids are the mono mode. Different ids are normalized so the pair
    # remains unordered. Одна пара текстур — одна карточка: если строка для
    # выбора уже есть, новые фото дописываются в её галерею, а не плодят
    # дублирующиеся карточки.
    first_id, second_id = sorted((body.texture_id_1, body.texture_id_2))
    panel_first, panel_second = _normalize_panel_families(body.panel_family_1, body.panel_family_2)
    await _validate_panel_families(session, panel_first, panel_second)
    incoming = [path.strip() for path in (body.image_paths or []) if str(path or '').strip()]
    if body.image_path and body.image_path.strip():
        incoming.insert(0, body.image_path.strip())
    if not incoming:
        raise HTTPException(status_code=422, detail="Нужно хотя бы одно фото")
    execution_variant_id = (body.card.execution_variant_id or '').strip()
    if not execution_variant_id:
        raise HTTPException(status_code=422, detail="Выберите вариант исполнения для карточки")
    execution_exists = await session.get(PanelVariantModel, execution_variant_id)
    if execution_exists is None or execution_exists.is_active is not True:
        raise HTTPException(status_code=422, detail="Выбранное исполнение недоступно")
    card_payload = body.card.model_dump()
    if not card_payload.get('project_id'):
        card_payload['project_id'] = str(uuid4())
    requested_ids = {first_id, second_id}
    existing_textures = set((await session.execute(
        select(TextureModel.id).where(TextureModel.id.in_(requested_ids))
    )).scalars().all())
    if existing_textures != requested_ids:
        raise HTTPException(status_code=404, detail="Одна из текстур не найдена")
    existing = (await session.execute(
        select(TextureCombinationImageModel).where(
            TextureCombinationImageModel.texture_id_1 == first_id,
            TextureCombinationImageModel.texture_id_2 == second_id,
            TextureCombinationImageModel.panel_family_1 == panel_first,
            TextureCombinationImageModel.panel_family_2 == panel_second,
        )
    )).scalars().first()
    if existing is not None:
        gallery = _gallery_paths(existing)
        for path in incoming:
            if path not in gallery:
                gallery.append(path)
        existing.image_paths = gallery
        existing.image_path = gallery[0]
        if body.card and (body.card.title or '').strip():
            existing.card = card_payload
        await session.flush()
        return _combination_to_response(existing)
    row = TextureCombinationImageModel(
        id=str(uuid4()),
        texture_id_1=first_id,
        texture_id_2=second_id,
        panel_family_1=panel_first,
        panel_family_2=panel_second,
        image_path=incoming[0],
        image_paths=incoming,
        card=card_payload,
        created_at=datetime.utcnow(),
    )
    session.add(row)
    await session.flush()
    return _combination_to_response(row)


@router.patch(
    "/texture-combination-images/{combination_id}",
    response_model=TextureCombinationImageResponse,
)
async def update_texture_combination_image_admin(
    combination_id: str,
    body: TextureCombinationImageUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    row = await session.get(TextureCombinationImageModel, combination_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Изображение текстуры не найдено")

    first_id, second_id = sorted((body.texture_id_1, body.texture_id_2))
    panel_first, panel_second = _normalize_panel_families(body.panel_family_1, body.panel_family_2)
    await _validate_panel_families(session, panel_first, panel_second)
    requested_ids = {first_id, second_id}
    existing_textures = set((await session.execute(
        select(TextureModel.id).where(TextureModel.id.in_(requested_ids))
    )).scalars().all())
    if existing_textures != requested_ids:
        raise HTTPException(status_code=404, detail="Одна из текстур не найдена")

    # Редактор строки: image_paths задан явно — это полная замена галереи
    # (удаление фото, смена обложки); задан только image_path — замена
    # одиночного фото с сохранением остальной галереи.
    if body.image_paths is not None:
        gallery = [path.strip() for path in body.image_paths if str(path or '').strip()]
        if not gallery:
            raise HTTPException(status_code=422, detail="В галерее должно остаться хотя бы одно фото")
    else:
        gallery = _gallery_paths(row)
        replacement = (body.image_path or '').strip()
        if replacement:
            if replacement in gallery:
                gallery.remove(replacement)
            gallery.insert(0, replacement)
        if not gallery:
            raise HTTPException(status_code=422, detail="Нужно хотя бы одно фото")
    row.texture_id_1 = first_id
    row.texture_id_2 = second_id
    row.panel_family_1 = panel_first
    row.panel_family_2 = panel_second
    execution_variant_id = (body.card.execution_variant_id or '').strip()
    if not execution_variant_id:
        raise HTTPException(status_code=422, detail="Выберите вариант исполнения для карточки")
    execution_exists = await session.get(PanelVariantModel, execution_variant_id)
    if execution_exists is None or execution_exists.is_active is not True:
        raise HTTPException(status_code=422, detail="Выбранное исполнение недоступно")
    card_payload = body.card.model_dump()
    if not card_payload.get('project_id'):
        card_payload['project_id'] = str(getattr(row, 'card', {}).get('project_id') or row.id)
    row.image_paths = gallery
    row.image_path = gallery[0]
    row.card = card_payload
    await session.flush()
    return _combination_to_response(row)


@router.delete("/texture-combination-images/{combination_id}", status_code=204)
async def delete_texture_combination_image_admin(
    combination_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    row = await session.get(TextureCombinationImageModel, combination_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Комбинация не найдена")
    await session.delete(row)
    await session.flush()
    return Response(status_code=204)


# ─── Legacy variant image CRUD ──────────────────────────────────────


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
