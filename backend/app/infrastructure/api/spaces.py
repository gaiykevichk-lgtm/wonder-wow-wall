"""Public spaces catalog and admin CRUD backed by PostgreSQL."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import SpaceInteriorModel, SpacesPageSettingsModel, TextureCombinationImageModel
from app.utils.dependencies import get_current_admin_id

public_router = APIRouter()
admin_router = APIRouter()


class PageSettings(BaseModel):
    heading: str = Field(min_length=1, max_length=255)
    intro: str = Field(min_length=1, max_length=5000)


class Texture(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    family: Literal['wood', 'stone', 'leather', 'metal', 'textile']
    image: str = Field(min_length=1)
    colorHex: str | None = None


class Panel(BaseModel):
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)


class SpaceRender(BaseModel):
    sceneId: str = Field(min_length=1)
    panelSlug: str = Field(min_length=1)
    textureIds: list[str] = Field(default_factory=list, max_length=2)
    # Deprecated single-texture pointer, kept for old payloads.
    textureId: str | None = None
    mode: Literal['mono', 'combined']
    image: str = Field(min_length=1)

    @model_validator(mode='after')
    def check_textures(self):
        ids = list(self.textureIds or [])
        if self.textureId and self.textureId not in ids:
            ids.append(self.textureId)
        object.__setattr__(self, 'textureIds', ids[:2])
        if self.mode == 'mono' and len(self.textureIds) != 1:
            raise ValueError('Моно-изображение привязывается ровно к одной текстуре')
        if self.mode == 'combined' and len(self.textureIds) != 2:
            raise ValueError('Комбо-изображение привязывается ровно к двум текстурам')
        if len(set(self.textureIds)) != len(self.textureIds):
            raise ValueError('Текстуры на изображении не должны повторяться')
        return self


class CatalogBinding(BaseModel):
    panelSlug: str = Field(min_length=1)
    textureId: str = Field(min_length=1)
    groupId: str = Field(min_length=1)
    finishImage: str = Field(min_length=1)


class Space(BaseModel):
    id: str = Field(min_length=1, max_length=128, pattern=r'^[a-z0-9-]+$')
    title: str = Field(min_length=1)
    category: Literal['home', 'business', 'social']
    categoryLabel: str = Field(min_length=1)
    roomType: str = Field(min_length=1)
    roomTypeLabel: str = Field(min_length=1)
    zone: str = Field(min_length=1)
    zoneLabel: str = Field(min_length=1)
    style: str = Field(min_length=1)
    styleLabel: str = Field(min_length=1)
    texture: str = Field(min_length=1)
    textureLabel: str = Field(min_length=1)
    image: str = Field(min_length=1)
    description: str = Field(min_length=1)
    mode: Literal['mono', 'combined']
    areaM2: float = Field(gt=0)
    panelSize: Literal['300x300', '300x600', '600x600']
    defaultPanelSlug: str | None = None
    defaultPanelName: str | None = None
    relatedPanels: list[Panel] = Field(min_length=1)
    textures: list[Texture] = Field(min_length=1)
    renders: list[SpaceRender] = Field(default_factory=list)
    catalogBindings: list[CatalogBinding] = Field(default_factory=list)

    @model_validator(mode='after')
    def check_scene(self):
        if self.mode == 'combined' and len(self.textures) < 2:
            raise ValueError('Комбинированному интерьеру нужны минимум две фактуры')
        if any(texture.image != self.image for texture in self.textures):
            raise ValueError('Фактура должна ссылаться на изображение этого интерьера')
        if len({texture.id for texture in self.textures}) != len(self.textures):
            raise ValueError('Повторяющиеся ID фактур')
        panel_slugs = {panel.slug for panel in self.relatedPanels}
        texture_ids = {texture.id for texture in self.textures}
        if any(r.sceneId != self.id or r.panelSlug not in panel_slugs or any(t not in texture_ids for t in r.textureIds) for r in self.renders):
            raise ValueError('Визуализация должна ссылаться на интерьер, связанную панель и фактуру')
        if any(b.panelSlug not in panel_slugs or b.textureId not in texture_ids for b in self.catalogBindings):
            raise ValueError('Связь с каталогом должна ссылаться на связанную панель и фактуру')
        return self


def require_db(db: AsyncSession | None = Depends(get_db)) -> AsyncSession:
    if db is None:
        raise HTTPException(503, 'Для управления пространствами требуется PostgreSQL')
    return db


async def ordered(db):
    result = await db.execute(select(SpaceInteriorModel).order_by(SpaceInteriorModel.position, SpaceInteriorModel.id))
    return list(result.scalars().all())


@public_router.get('/spaces/page', response_model=PageSettings)
async def get_page_settings(db: AsyncSession = Depends(require_db)):
    row = await db.get(SpacesPageSettingsModel, 'main')
    if row is None:
        raise HTTPException(503, 'Настройки страницы не инициализированы')
    return PageSettings(heading=row.heading, intro=row.intro)


@admin_router.put('/spaces/page', response_model=PageSettings, dependencies=[Depends(get_current_admin_id)])
async def update_page_settings(settings: PageSettings, db: AsyncSession = Depends(require_db)):
    row = await db.get(SpacesPageSettingsModel, 'main')
    if row is None:
        raise HTTPException(503, 'Настройки страницы не инициализированы')
    row.heading = settings.heading.strip()
    row.intro = settings.intro.strip()
    if not row.heading or not row.intro:
        raise HTTPException(422, 'Заголовок и описание обязательны')
    await db.commit()
    return PageSettings(heading=row.heading, intro=row.intro)


@public_router.get('/spaces', response_model=list[Space])
async def list_spaces(db: AsyncSession = Depends(require_db)):
    return [row.content for row in await ordered(db)]


class SpaceCard(BaseModel):
    """Карточка публичной страницы «Пространства», управляемая из вкладки «Изображения».

    Одна строка texture_combination_images — один вариант внутри
    объекта: строки с одинаковым project_id объединяются в одну карточку,
    все их фото и исполнения показываются внутри карточки объекта.
    Название, детали, цена и площадь вводятся в админке на той же строке;
    отдельные записи space_interiors для этого пути не требуются.
    """

    id: str = Field(min_length=1)
    projectId: str = ""
    projectAddress: str = ""
    executionVariantId: str = ""
    mode: Literal['mono', 'combined']
    title: str = Field(min_length=1)
    subtitle: str = ""
    price: str = ""
    area: str = ""
    category: Literal['home', 'business', 'social'] = 'home'
    image: str = Field(min_length=1)
    images: list[str] = Field(default_factory=list)
    textureId1: str = Field(min_length=1)
    textureId2: str = Field(min_length=1)
    # Семейства базовых форм (slug без суффикса размера). Пустые — строка
    # создана до привязки к панелям.
    panelFamily1: str = ""
    panelFamily2: str = ""


def card_payload(row: TextureCombinationImageModel) -> dict:
    card = dict(getattr(row, 'card', None) or {})
    return {
        'id': row.id,
        'projectId': str(card.get('project_id') or row.id),
        'projectAddress': str(card.get('project_address') or ''),
        'executionVariantId': str(card.get('execution_variant_id') or ''),
        'mode': 'mono' if row.texture_id_1 == row.texture_id_2 else 'combined',
        'title': str(card.get('title') or '').strip(),
        'subtitle': str(card.get('subtitle') or '').strip(),
        'price': str(card.get('price') or '').strip(),
        'area': str(card.get('area') or '').strip(),
        'category': str(card.get('category') or 'home').strip() or 'home',
        'image': row.image_path,
        'images': list(getattr(row, 'image_paths', None) or [row.image_path]),
        'textureId1': row.texture_id_1,
        'textureId2': row.texture_id_2,
        'panelFamily1': str(getattr(row, 'panel_family_1', '') or ''),
        'panelFamily2': str(getattr(row, 'panel_family_2', '') or ''),
    }


@public_router.get('/spaces/cards', response_model=list[SpaceCard])
async def list_space_cards(db: AsyncSession = Depends(require_db)):
    rows = (await db.execute(select(TextureCombinationImageModel))).scalars().all()
    cards = [card_payload(row) for row in rows]
    # В production может оставаться несколько строк с разными project_id,
    # но одним названием объекта. Сводим их к одному ID проекта: фронтенд
    # собирает фото, семейства панелей и исполнения в общую карточку.
    project_by_title: dict[str, str] = {}
    for payload in cards:
        title = ' '.join(payload['title'].split()).casefold().replace('ё', 'е')
        if title:
            project_by_title.setdefault(title, payload['projectId'])
            payload['projectId'] = project_by_title[title]
    # Публикуются только оформленные карточки: строка вкладки становится
    # вариантом объекта, когда у неё задано название.
    return [SpaceCard(**payload) for payload in cards if payload['title']]


class SpaceTextureImage(BaseModel):
    """Фото стены из админской вкладки «Изображения» (совместимость старого клиента)."""

    id: str = Field(min_length=1)
    textureId1: str = Field(min_length=1)
    textureId2: str = Field(min_length=1)
    image: str = Field(min_length=1)


@public_router.get('/spaces/texture-images', response_model=list[SpaceTextureImage])
async def list_space_texture_images(db: AsyncSession = Depends(require_db)):
    rows = (await db.execute(select(TextureCombinationImageModel))).scalars().all()
    return [
        SpaceTextureImage(id=row.id, textureId1=row.texture_id_1, textureId2=row.texture_id_2, image=row.image_path)
        for row in rows
    ]


@admin_router.get('/spaces', response_model=list[Space], dependencies=[Depends(get_current_admin_id)])
async def list_admin_spaces(db: AsyncSession = Depends(require_db)):
    return [row.content for row in await ordered(db)]


@admin_router.post('/spaces', response_model=Space, status_code=201, dependencies=[Depends(get_current_admin_id)])
async def create_space(space: Space, db: AsyncSession = Depends(require_db)):
    if await db.get(SpaceInteriorModel, space.id):
        raise HTTPException(409, 'ID уже существует')
    rows = await ordered(db)
    if any(row.content['roomType'] == space.roomType and row.content['image'] == space.image for row in rows):
        raise HTTPException(409, 'Сцена уже используется для этого типа помещения')
    db.add(SpaceInteriorModel(id=space.id, position=max((row.position for row in rows), default=-1) + 1, content=space.model_dump(exclude_none=True)))
    await db.commit()
    return space


@admin_router.put('/spaces/{space_id}', response_model=Space, dependencies=[Depends(get_current_admin_id)])
async def update_space(space_id: str, space: Space, db: AsyncSession = Depends(require_db)):
    row = await db.get(SpaceInteriorModel, space_id)
    if row is None:
        raise HTTPException(404, 'Интерьер не найден')
    if space.id != space_id:
        raise HTTPException(422, 'ID интерьера нельзя изменить')
    rows = await ordered(db)
    if any(other.id != space_id and other.content['roomType'] == space.roomType and other.content['image'] == space.image for other in rows):
        raise HTTPException(409, 'Сцена уже используется для этого типа помещения')
    row.content = space.model_dump(exclude_none=True)
    await db.commit()
    return space


@admin_router.delete('/spaces/{space_id}', status_code=204, dependencies=[Depends(get_current_admin_id)])
async def delete_space(space_id: str, db: AsyncSession = Depends(require_db)):
    row = await db.get(SpaceInteriorModel, space_id)
    if row is None:
        raise HTTPException(404, 'Интерьер не найден')
    await db.delete(row)
    await db.commit()
    return Response(status_code=204)
