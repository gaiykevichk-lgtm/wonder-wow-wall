from __future__ import annotations

from app.domain.catalog.variant_image import VariantImage
from app.domain.catalog.repositories import (
    DesignRepository,
    TextureRepository,
    TextureColorRepository,
    VariantImageRepository,
)
from app.domain.catalog.texture_exceptions import (
    TextureNotFoundError,
    TextureColorNotFoundError,
    VariantImageNotFoundError,
    VariantImageCombinationConflictError,
)
from app.domain.catalog.catalog_exceptions import DesignNotFoundError


class GetVariantImage:
    def __init__(self, repo: VariantImageRepository):
        self.repo = repo

    async def execute(
        self, design_id: str, texture_id: str, color_id: str,
    ) -> VariantImage | None:
        return await self.repo.get_by_combination(design_id, texture_id, color_id)


class ListVariantImagesByDesign:
    def __init__(self, repo: VariantImageRepository):
        self.repo = repo

    async def execute(self, design_id: str) -> list[VariantImage]:
        return await self.repo.list_by_design(design_id)


class ListVariantImagesAdmin:
    def __init__(self, repo: VariantImageRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        design_id: str | None = None,
        texture_id: str | None = None,
    ) -> list[VariantImage]:
        if design_id:
            return await self.repo.list_by_design(design_id)
        if texture_id:
            return await self.repo.list_by_texture(texture_id)
        return []


class CreateVariantImageAdmin:
    def __init__(
        self,
        repo: VariantImageRepository,
        design_repo: DesignRepository,
        texture_repo: TextureRepository,
        color_repo: TextureColorRepository,
    ):
        self.repo = repo
        self.design_repo = design_repo
        self.texture_repo = texture_repo
        self.color_repo = color_repo

    async def execute(
        self,
        *,
        design_id: str,
        texture_id: str,
        color_id: str,
        image_path: str,
    ) -> VariantImage:
        if not image_path:
            raise ValueError("VariantImage.image_path must not be empty")
        design = await self.design_repo.get_by_id(design_id)
        if design is None:
            raise DesignNotFoundError(f"Design {design_id} not found")
        texture = await self.texture_repo.get_by_id(texture_id)
        if texture is None:
            raise TextureNotFoundError(f"Texture {texture_id} not found")
        color = await self.color_repo.get_by_id(color_id)
        if color is None:
            raise TextureColorNotFoundError(
                f"TextureColor {color_id} not found"
            )
        existing = await self.repo.get_by_combination(design_id, texture_id, color_id)
        if existing is not None:
            raise VariantImageCombinationConflictError(
                f"VariantImage for combination "
                f"({design_id}, {texture_id}, {color_id}) already exists"
            )
        variant = VariantImage(
            design_id=design_id,
            texture_id=texture_id,
            color_id=color_id,
            image_path=image_path,
        )
        return await self.repo.create(variant)


class DeleteVariantImageAdmin:
    def __init__(self, repo: VariantImageRepository):
        self.repo = repo

    async def execute(self, variant_id: str) -> bool:
        deleted = await self.repo.delete(variant_id)
        if not deleted:
            raise VariantImageNotFoundError(
                f"VariantImage {variant_id} not found"
            )
        return True
