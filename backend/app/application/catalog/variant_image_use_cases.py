from __future__ import annotations

from app.domain.catalog.variant_image import VariantImage, VALID_SIZE_KEYS
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

# ── DTOs ───────────────────────────────────────────────────────────────────


class VariantImageBatchItem:
    """Single entry within a batch create request."""

    def __init__(
        self,
        texture_id: str,
        color_id: str,
        image_path: str,
        size_key: str | None = None,
        hex_color: str | None = None,
    ):
        self.texture_id = texture_id
        self.color_id = color_id
        self.image_path = image_path
        self.size_key = size_key
        self.hex_color = hex_color


class VariantImageBatchResult:
    """Result of a batch create operation."""

    def __init__(
        self,
        created: list[VariantImage],
        updated: list[VariantImage],
        errors: list[dict],
    ):
        self.created = created
        self.updated = updated
        self.errors = errors

    @property
    def total_processed(self) -> int:
        return len(self.created) + len(self.updated) + len(self.errors)


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


# ── Panel Creator Wizard batch use case ───────────────────────────────────


class CreateVariantImageBatchAdmin:
    """Batch-create (or upsert) variant images for the Panel Creator Wizard.

    Validates every item in the batch before persisting any of them.
    Persists items using upsert semantics: if a variant already exists for
    the given (design_id, texture_id, color_id, size_key) combination,
    update its image_path and hex; otherwise create a new entry.

    Items that fail validation are collected into `errors` rather than
    aborting the entire batch.
    """

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
        items: list[VariantImageBatchItem],
    ) -> VariantImageBatchResult:
        created: list[VariantImage] = []
        updated: list[VariantImage] = []
        errors: list[dict] = []

        # ── Validate design upfront ──────────────────────────────────────
        design = await self.design_repo.get_by_id(design_id)
        if design is None:
            raise DesignNotFoundError(f"Design {design_id} not found")

        # ── Validate all items before persisting anything ─────────────────
        validated: list[tuple[int, VariantImageBatchItem, dict | None]] = []
        for idx, item in enumerate(items):
            item_errors: dict = {}

            if not item.image_path:
                item_errors["image_path"] = "image_path is required"

            if item.size_key is not None and item.size_key not in VALID_SIZE_KEYS:
                item_errors["size_key"] = (
                    f"size_key must be one of {sorted(VALID_SIZE_KEYS)}, "
                    f"got {item.size_key!r}"
                )

            if item.hex_color is not None:
                if not (
                    len(item.hex_color) == 7 and item.hex_color.startswith("#")
                ):
                    item_errors["hex"] = f"hex must be #RRGGBB format, got {item.hex_color!r}"

            # Check texture exists
            texture = await self.texture_repo.get_by_id(item.texture_id)
            if texture is None:
                item_errors["texture_id"] = f"Texture {item.texture_id} not found"

            # Check color exists
            color = await self.color_repo.get_by_id(item.color_id)
            if color is None:
                item_errors["color_id"] = f"TextureColor {item.color_id} not found"

            validated.append((idx, item, item_errors if item_errors else None))

        # Separate valid and invalid items
        valid_items: list[tuple[int, VariantImageBatchItem]] = []
        for idx, item, errs in validated:
            if errs:
                errors.append({"index": idx, "errors": errs})
            else:
                valid_items.append((idx, item))

        # ── Upsert valid items ────────────────────────────────────────────
        for idx, item in valid_items:
            # Check if this combination already exists BEFORE upsert
            existing = await self.repo.get_by_combination(
                design_id,
                item.texture_id,
                item.color_id,
                item.size_key,
            )
            was_existing = existing is not None

            variant = VariantImage(
                design_id=design_id,
                texture_id=item.texture_id,
                color_id=item.color_id,
                image_path=item.image_path,
                size_key=item.size_key,
                hex=item.hex_color,
            )
            persisted = await self.repo.upsert(variant)

            if was_existing:
                updated.append(persisted)
            else:
                created.append(persisted)

        return VariantImageBatchResult(
            created=created,
            updated=updated,
            errors=errors,
        )
