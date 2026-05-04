from __future__ import annotations

from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.repositories import (
    TextureRepository,
    TextureColorRepository,
    VariantImageRepository,
)
from app.domain.catalog.texture_exceptions import (
    TextureNotFoundError,
    TextureSlugConflictError,
    TextureColorNotFoundError,
    TextureHasVariantsError,
)


# ─── Public ─────────────────────────────────────────────────────────


class ListTexturesPublic:
    def __init__(self, repo: TextureRepository):
        self.repo = repo

    async def execute(self) -> list[Texture]:
        return await self.repo.list_all(include_inactive=False)


class ListTextureColorsPublic:
    def __init__(self, repo: TextureColorRepository):
        self.repo = repo

    async def execute(self, texture_id: str) -> list[TextureColor]:
        return await self.repo.list_by_texture(texture_id, include_inactive=False)


# ─── Admin — Textures ───────────────────────────────────────────────


class ListTexturesAdmin:
    def __init__(self, repo: TextureRepository):
        self.repo = repo

    async def execute(self) -> list[Texture]:
        return await self.repo.list_all(include_inactive=True)


class CreateTextureAdmin:
    def __init__(self, repo: TextureRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        slug: str,
        swatch_image: str = "",
        sort_order: int = 0,
        is_active: bool = True,
    ) -> Texture:
        if not name:
            raise ValueError("Texture.name must not be empty")
        if not slug:
            raise ValueError("Texture.slug must not be empty")
        existing = await self.repo.get_by_slug(slug)
        if existing is not None:
            raise TextureSlugConflictError(
                f"Texture with slug {slug!r} already exists"
            )
        texture = Texture(
            name=name,
            slug=slug,
            swatch_image=swatch_image,
            sort_order=sort_order,
            is_active=is_active,
        )
        return await self.repo.create(texture)


class UpdateTextureAdmin:
    def __init__(self, repo: TextureRepository):
        self.repo = repo

    async def execute(
        self,
        texture_id: str,
        *,
        name: str | None = None,
        slug: str | None = None,
        swatch_image: str | None = None,
        sort_order: int | None = None,
        is_active: bool | None = None,
    ) -> Texture:
        texture = await self.repo.get_by_id(texture_id)
        if texture is None:
            raise TextureNotFoundError(f"Texture {texture_id} not found")
        if slug is not None and slug != texture.slug:
            existing = await self.repo.get_by_slug(slug)
            if existing is not None:
                raise TextureSlugConflictError(
                    f"Texture with slug {slug!r} already exists"
                )
            texture.slug = slug
        if name is not None:
            texture.name = name
        if swatch_image is not None:
            texture.swatch_image = swatch_image
        if sort_order is not None:
            texture.sort_order = sort_order
        if is_active is not None:
            texture.is_active = is_active
        return await self.repo.update(texture)


class DeleteTextureAdmin:
    def __init__(
        self,
        repo: TextureRepository,
        variant_repo: VariantImageRepository,
    ):
        self.repo = repo
        self.variant_repo = variant_repo

    async def execute(self, texture_id: str) -> bool:
        texture = await self.repo.get_by_id(texture_id)
        if texture is None:
            raise TextureNotFoundError(f"Texture {texture_id} not found")
        variants = await self.variant_repo.list_by_texture(texture_id)
        if variants:
            raise TextureHasVariantsError(
                f"Cannot delete texture {texture_id}: "
                f"{len(variants)} variant image(s) still attached"
            )
        return await self.repo.delete(texture_id)


# ─── Admin — Texture Colors ────────────────────────────────────────


class ListTextureColorsAdmin:
    def __init__(self, repo: TextureColorRepository):
        self.repo = repo

    async def execute(self, texture_id: str) -> list[TextureColor]:
        return await self.repo.list_by_texture(texture_id, include_inactive=True)


class CreateTextureColorAdmin:
    def __init__(
        self,
        repo: TextureColorRepository,
        texture_repo: TextureRepository,
    ):
        self.repo = repo
        self.texture_repo = texture_repo

    async def execute(
        self,
        *,
        texture_id: str,
        name: str,
        hex: str = "",
        swatch_image: str = "",
        sort_order: int = 0,
        is_active: bool = True,
    ) -> TextureColor:
        if not name:
            raise ValueError("TextureColor.name must not be empty")
        texture = await self.texture_repo.get_by_id(texture_id)
        if texture is None:
            raise TextureNotFoundError(f"Texture {texture_id} not found")
        color = TextureColor(
            texture_id=texture_id,
            name=name,
            hex=hex,
            swatch_image=swatch_image,
            sort_order=sort_order,
            is_active=is_active,
        )
        return await self.repo.create(color)


class UpdateTextureColorAdmin:
    def __init__(self, repo: TextureColorRepository):
        self.repo = repo

    async def execute(
        self,
        color_id: str,
        *,
        name: str | None = None,
        hex: str | None = None,
        swatch_image: str | None = None,
        sort_order: int | None = None,
        is_active: bool | None = None,
    ) -> TextureColor:
        color = await self.repo.get_by_id(color_id)
        if color is None:
            raise TextureColorNotFoundError(
                f"TextureColor {color_id} not found"
            )
        if name is not None:
            color.name = name
        if hex is not None:
            color.hex = hex
        if swatch_image is not None:
            color.swatch_image = swatch_image
        if sort_order is not None:
            color.sort_order = sort_order
        if is_active is not None:
            color.is_active = is_active
        return await self.repo.update(color)


class DeleteTextureColorAdmin:
    def __init__(self, repo: TextureColorRepository):
        self.repo = repo

    async def execute(self, color_id: str) -> bool:
        color = await self.repo.get_by_id(color_id)
        if color is None:
            raise TextureColorNotFoundError(
                f"TextureColor {color_id} not found"
            )
        return await self.repo.delete(color_id)
