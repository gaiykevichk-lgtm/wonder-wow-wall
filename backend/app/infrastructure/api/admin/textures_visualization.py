"""Admin API для TextureVisualization — блок «WWW в дизайне»."""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.routing import APIRoute
from pydantic import BaseModel

from app.application.catalog.texture_visualization_use_cases import (
    CreateTextureVisualizationAdmin,
    DeleteTextureVisualizationAdmin,
    GetTextureVisualizationAdmin,
    ListTextureVisualizationsAdmin,
    UpdateTextureVisualizationAdmin,
    TextureVisualizationNotFoundError,
    TextureVisualizationTextureNotFoundError,
    TextureVisualizationAlreadyExistsError,
)
from app.container import (
    get_texture_visualization_repo,
    get_texture_repo,
)
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class TextureVisualizationResponse(BaseModel):
    """Схема ответа для визуализации (public + admin)."""
    id: str
    texture_id: str
    media_type: str
    media_url: str
    poster_url: str
    bg_image_url: str
    title: str
    subtitle: str
    scroll_hint: str
    description: str
    is_active: bool
    sort_order: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class TextureVisualizationCreate(BaseModel):
    """Схема создания визуализации."""
    texture_id: str
    media_type: str = "image"
    media_url: str = ""
    poster_url: str = ""
    bg_image_url: str = ""
    title: str = ""
    subtitle: str = ""
    scroll_hint: str = "Листайте вверх"
    description: str = ""
    is_active: bool = True
    sort_order: int = 0


class TextureVisualizationUpdate(BaseModel):
    """Схема обновления визуализации."""
    media_type: str | None = None
    media_url: str | None = None
    poster_url: str | None = None
    bg_image_url: str | None = None
    title: str | None = None
    subtitle: str | None = None
    scroll_hint: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


# ─── Routes ─────────────────────────────────────────────────────────

@router.get(
    "/texture-visualizations",
    response_model=list[TextureVisualizationResponse],
)
async def list_texture_visualizations(
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_texture_visualization_repo),
):
    """GET /admin/texture-visualizations — список всех визуализаций."""
    use_case = ListTextureVisualizationsAdmin(repo=repo)
    vizs = await use_case.execute()
    return [
        TextureVisualizationResponse(
            id=v.id,
            texture_id=v.texture_id,
            media_type=v.media_type,
            media_url=v.media_url,
            poster_url=v.poster_url,
            bg_image_url=v.bg_image_url,
            title=v.title,
            subtitle=v.subtitle,
            scroll_hint=v.scroll_hint,
            description=v.description,
            is_active=v.is_active,
            sort_order=v.sort_order,
            created_at=v.created_at.isoformat(),
            updated_at=v.updated_at.isoformat(),
        )
        for v in vizs
    ]


@router.get(
    "/texture-visualizations/{viz_id}",
    response_model=TextureVisualizationResponse,
)
async def get_texture_visualization(
    viz_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_texture_visualization_repo),
):
    """GET /admin/texture-visualizations/{id} — одна визуализация."""
    use_case = GetTextureVisualizationAdmin(repo=repo)
    try:
        v = await use_case.execute(viz_id)
    except TextureVisualizationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return TextureVisualizationResponse(
        id=v.id,
        texture_id=v.texture_id,
        media_type=v.media_type,
        media_url=v.media_url,
        poster_url=v.poster_url,
        bg_image_url=v.bg_image_url,
        title=v.title,
        subtitle=v.subtitle,
        scroll_hint=v.scroll_hint,
        description=v.description,
        is_active=v.is_active,
        sort_order=v.sort_order,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


@router.post(
    "/texture-visualizations",
    status_code=201,
    response_model=TextureVisualizationResponse,
)
async def create_texture_visualization(
    payload: TextureVisualizationCreate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_texture_visualization_repo),
    texture_repo=Depends(get_texture_repo),
):
    """POST /admin/texture-visualizations — создать визуализацию."""
    use_case = CreateTextureVisualizationAdmin(
        repo=repo,
        texture_repo=texture_repo,
    )
    try:
        v = await use_case.execute(**payload.model_dump())
    except TextureVisualizationTextureNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TextureVisualizationAlreadyExistsError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return TextureVisualizationResponse(
        id=v.id,
        texture_id=v.texture_id,
        media_type=v.media_type,
        media_url=v.media_url,
        poster_url=v.poster_url,
        bg_image_url=v.bg_image_url,
        title=v.title,
        subtitle=v.subtitle,
        scroll_hint=v.scroll_hint,
        description=v.description,
        is_active=v.is_active,
        sort_order=v.sort_order,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


@router.patch(
    "/texture-visualizations/{viz_id}",
    response_model=TextureVisualizationResponse,
)
async def update_texture_visualization(
    viz_id: str,
    payload: TextureVisualizationUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_texture_visualization_repo),
):
    """PATCH /admin/texture-visualizations/{id} — обновить визуализацию."""
    use_case = UpdateTextureVisualizationAdmin(repo=repo)
    try:
        v = await use_case.execute(viz_id, **payload.model_dump(exclude_unset=True))
    except TextureVisualizationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return TextureVisualizationResponse(
        id=v.id,
        texture_id=v.texture_id,
        media_type=v.media_type,
        media_url=v.media_url,
        poster_url=v.poster_url,
        bg_image_url=v.bg_image_url,
        title=v.title,
        subtitle=v.subtitle,
        scroll_hint=v.scroll_hint,
        description=v.description,
        is_active=v.is_active,
        sort_order=v.sort_order,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


@router.delete(
    "/texture-visualizations/{viz_id}",
    status_code=204,
)
async def delete_texture_visualization(
    viz_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_texture_visualization_repo),
):
    """DELETE /admin/texture-visualizations/{id} — удалить визуализацию."""
    use_case = DeleteTextureVisualizationAdmin(repo=repo)
    try:
        await use_case.execute(viz_id)
    except TextureVisualizationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


# Legacy routes reuse the same endpoint callables/DI for already deployed clients.
# Hide the double-/admin paths from the contract for new clients.
legacy_router = APIRouter()
for route in router.routes:
    if isinstance(route, APIRoute):
        legacy_router.add_api_route(
            "/admin" + route.path,
            route.endpoint,
            methods=route.methods,
            response_model=route.response_model,
            status_code=route.status_code,
            include_in_schema=False,
        )
