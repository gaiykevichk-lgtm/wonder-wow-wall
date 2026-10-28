"""Use cases for TextureVisualization — блок «WWW в дизайне»."""
from __future__ import annotations

from datetime import datetime
from app.domain.catalog.texture_visualization import TextureVisualization
from app.domain.catalog.repositories import (
    TextureVisualizationRepository,
    TextureRepository,
)


# ─── Public ─────────────────────────────────────────────────────────

class GetTextureVisualizationPublic:
    """Получить визуализацию для конкретной фактуры (public API)."""

    def __init__(self, repo: TextureVisualizationRepository):
        self.repo = repo

    async def execute(self, texture_id: str) -> TextureVisualization | None:
        return await self.repo.get_by_texture(texture_id)


# ─── Admin ────────────────────────────────────────────────────────────

class ListTextureVisualizationsAdmin:
    """Список всех визуализаций (admin)."""

    def __init__(self, repo: TextureVisualizationRepository):
        self.repo = repo

    async def execute(self) -> list[TextureVisualization]:
        return list(await self.repo.list_all())


class GetTextureVisualizationAdmin:
    """Получить одну визуализацию по ID (admin)."""

    def __init__(self, repo: TextureVisualizationRepository):
        self.repo = repo

    async def execute(self, viz_id: str) -> TextureVisualization:
        result = await self.repo.get_by_id(viz_id)
        if result is None:
            raise TextureVisualizationNotFoundError(viz_id)
        return result


class CreateTextureVisualizationAdmin:
    """Создать визуализацию для фактуры (admin)."""

    def __init__(
        self,
        repo: TextureVisualizationRepository,
        texture_repo: TextureRepository,
    ):
        self.repo = repo
        self.texture_repo = texture_repo

    async def execute(
        self,
        *,
        texture_id: str,
        media_type: str = "image",
        media_url: str = "",
        poster_url: str = "",
        bg_image_url: str = "",
        title: str = "",
        subtitle: str = "",
        scroll_hint: str = "Листайте вверх",
        description: str = "",
        is_active: bool = True,
        sort_order: int = 0,
    ) -> TextureVisualization:
        # Проверяем, что фактура существует
        texture = await self.texture_repo.get_by_id(texture_id)
        if texture is None:
            raise TextureVisualizationTextureNotFoundError(texture_id)

        # Проверяем, что визуализация для этой фактуры ещё не создана
        existing = await self.repo.get_by_texture(texture_id)
        if existing is not None:
            raise TextureVisualizationAlreadyExistsError(texture_id)

        viz = TextureVisualization(
            texture_id=texture_id,
            media_type=media_type,
            media_url=media_url,
            poster_url=poster_url,
            bg_image_url=bg_image_url,
            title=title,
            subtitle=subtitle,
            scroll_hint=scroll_hint,
            description=description,
            is_active=is_active,
            sort_order=sort_order,
        )
        await self.repo.create(viz)
        return viz


class UpdateTextureVisualizationAdmin:
    """Обновить визуализацию (admin)."""

    def __init__(self, repo: TextureVisualizationRepository):
        self.repo = repo

    async def execute(
        self,
        viz_id: str,
        *,
        media_type: str | None = None,
        media_url: str | None = None,
        poster_url: str | None = None,
        bg_image_url: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        scroll_hint: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        sort_order: int | None = None,
    ) -> TextureVisualization:
        viz = await self.repo.get_by_id(viz_id)
        if viz is None:
            raise TextureVisualizationNotFoundError(viz_id)

        if media_type is not None:
            viz.media_type = media_type
        if media_url is not None:
            viz.media_url = media_url
        if poster_url is not None:
            viz.poster_url = poster_url
        if bg_image_url is not None:
            viz.bg_image_url = bg_image_url
        if title is not None:
            viz.title = title
        if subtitle is not None:
            viz.subtitle = subtitle
        if scroll_hint is not None:
            viz.scroll_hint = scroll_hint
        if description is not None:
            viz.description = description
        if is_active is not None:
            viz.is_active = is_active
        if sort_order is not None:
            viz.sort_order = sort_order

        viz.updated_at = datetime.utcnow()
        return await self.repo.update(viz)


class DeleteTextureVisualizationAdmin:
    """Удалить визуализацию (admin)."""

    def __init__(self, repo: TextureVisualizationRepository):
        self.repo = repo

    async def execute(self, viz_id: str) -> None:
        viz = await self.repo.get_by_id(viz_id)
        if viz is None:
            raise TextureVisualizationNotFoundError(viz_id)
        await self.repo.delete(viz_id)


# ─── Exceptions ────────────────────────────────────────────────────────

class TextureVisualizationNotFoundError(LookupError):
    """Визуализация не найдена."""

    def __init__(self, viz_id: str):
        self.viz_id = viz_id
        super().__init__(f"TextureVisualization {viz_id!r} not found")


class TextureVisualizationTextureNotFoundError(LookupError):
    """Фактура для визуализации не найдена."""

    def __init__(self, texture_id: str):
        self.texture_id = texture_id
        super().__init__(f"Texture {texture_id!r} not found for visualization")


class TextureVisualizationAlreadyExistsError(ValueError):
    """Визуализация для этой фактуры уже существует."""

    def __init__(self, texture_id: str):
        self.texture_id = texture_id
        super().__init__(
            f"TextureVisualization for texture {texture_id!r} already exists. "
            "Use update instead."
        )
