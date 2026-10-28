"""Phase 12 — PanelVariant use cases."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence
    from app.domain.catalog.repositories import (
        PanelRepository,
        PanelVariantRepository,
        TextureRepository,
    )

from app.domain.catalog.panel_variant import PanelVariant
from app.domain.catalog.panel import Panel
from app.domain.catalog.texture import Texture


class ListPanelVariantsAdmin:
    """List panel variants with optional filters."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(
        self,
        panel_id: str | None = None,
        is_active: bool | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[PanelVariant], int]:
        list_page = getattr(self._repo, "list_admin_page", None)
        if list_page is not None:
            return await list_page(panel_id, is_active, offset, limit)
        if panel_id:
            results = await self._repo.list_by_panel(panel_id, is_active)
            return list(results)[offset:offset + limit], len(results)
        return await self._repo.list_all(is_active, offset, limit)


class GetPanelVariantAdmin:
    """Get a single panel variant by ID."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(self, variant_id: str) -> PanelVariant:
        variant = await self._repo.get_by_id(variant_id)
        if not variant:
            raise PanelVariantNotFoundError(variant_id)
        return variant


class CreatePanelVariantAdmin:
    """Create a single panel variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(
        self,
        panel_id: str,
        texture_id: str,
        color_id: str | None = None,
        color_hex: str | None = None,
        image_paths: list[str] | None = None,
        design_image_paths: list[str] | None = None,
        recommendation_image_paths: list[str] | None = None,
        is_active: bool = True,
        name: str = "",
        slug: str = "",
    ) -> PanelVariant:
        next_order = getattr(self._repo, "next_sort_order", None)
        sort_order = await next_order(panel_id, texture_id) if next_order else 0
        variant = PanelVariant(
            name=name,
            slug=slug,
            panel_id=panel_id,
            texture_id=texture_id,
            color_id=color_id,
            color_hex=color_hex,
            image_paths=image_paths or [],
            design_image_paths=design_image_paths or [],
            recommendation_image_paths=recommendation_image_paths or [],
            sort_order=sort_order,
            is_active=is_active,
        )
        return await self._repo.create(variant)


class CreatePanelVariantBatch:
    """Create multiple panel variants at once (from wizard)."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(
        self,
        panel_id: str,
        variants: list[dict],
    ) -> tuple[Sequence[PanelVariant], int]:
        """Create batch of variants.
        
        Each variant dict:
            texture_id: str
            color_id: str | None
            color_hex: str | None
            image_paths: list[str]
        """
        created = []
        errors = 0
        
        for v_data in variants:
            try:
                variant = PanelVariant(
                    panel_id=panel_id,
                    texture_id=v_data['texture_id'],
                    color_id=v_data.get('color_id'),
                    color_hex=v_data.get('color_hex'),
                    image_paths=v_data.get('image_paths', []),
                    design_image_paths=v_data.get('design_image_paths', []),
                    recommendation_image_paths=v_data.get('recommendation_image_paths', []),
                    is_active=True,
                )
                result = await self._repo.create(variant)
                created.append(result)
            except (ValueError, Exception):
                errors += 1
        
        return created, len(created)


class UpdatePanelVariantAdmin:
    """Update an existing panel variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(
        self,
        variant_id: str,
        texture_id: str | None = None,
        color_id: str | None = None,
        color_hex: str | None = None,
        image_paths: list[str] | None = None,
        design_image_paths: list[str] | None = None,
        recommendation_image_paths: list[str] | None = None,
        is_active: bool | None = None,
        name: str | None = None,
        slug: str | None = None,
    ) -> PanelVariant:
        variant = await self._repo.get_by_id(variant_id)
        if not variant:
            raise PanelVariantNotFoundError(variant_id)

        # Re-assigning the texture is what makes an existing variant
        # editable rather than delete-and-recreate. `panel_id` stays fixed
        # on purpose: moving a photo set to a different panel size would
        # invalidate the images themselves, so that is a new variant.
        if name is not None:
            variant.name = name
        if slug is not None:
            variant.slug = slug
        if texture_id is not None:
            if not texture_id:
                raise ValueError("PanelVariant.texture_id must not be empty")
            variant.texture_id = texture_id
        if color_id is not None:
            variant.color_id = color_id
        if color_hex is not None:
            variant.color_hex = color_hex
        if design_image_paths is not None:
            variant.design_image_paths = design_image_paths
        if recommendation_image_paths is not None:
            variant.recommendation_image_paths = recommendation_image_paths
        if image_paths is not None:
            variant.image_paths = image_paths
        if is_active is not None:
            variant.is_active = is_active
        
        from datetime import datetime
        variant.updated_at = datetime.utcnow()
        
        return await self._repo.update(variant)


class AddVariantImageAdmin:
    """Add an image to an existing variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(self, variant_id: str, image_path: str) -> PanelVariant:
        variant = await self._repo.get_by_id(variant_id)
        if not variant:
            raise PanelVariantNotFoundError(variant_id)
        
        variant.add_image(image_path)
        return await self._repo.update(variant)


class RemoveVariantImageAdmin:
    """Remove an image from an existing variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(self, variant_id: str, image_path: str) -> PanelVariant:
        variant = await self._repo.get_by_id(variant_id)
        if not variant:
            raise PanelVariantNotFoundError(variant_id)
        
        variant.remove_image(image_path)
        return await self._repo.update(variant)


class ReorderVariantImagesAdmin:
    """Reorder images in a variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(self, variant_id: str, new_order: list[str]) -> PanelVariant:
        variant = await self._repo.get_by_id(variant_id)
        if not variant:
            raise PanelVariantNotFoundError(variant_id)
        
        variant.reorder_images(new_order)
        return await self._repo.update(variant)


class ReorderPanelVariantsAdmin:
    """Persist the order of complete panel+texture execution groups."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(
        self, panel_id: str, texture_id: str, ordered_ids: list[str],
    ) -> list[PanelVariant]:
        if len(ordered_ids) != len(set(ordered_ids)):
            raise ValueError("ordered_ids contains duplicates")
        return await self._repo.reorder_group(panel_id, texture_id, ordered_ids)


class DeletePanelVariantAdmin:
    """Delete a panel variant."""

    def __init__(self, repo: 'PanelVariantRepository'):
        self._repo = repo

    async def execute(self, variant_id: str) -> bool:
        deleted = await self._repo.delete(variant_id)
        if not deleted:
            raise PanelVariantNotFoundError(variant_id)
        return True


class PanelVariantNotFoundError(Exception):
    """Raised when panel variant is not found."""
    
    def __init__(self, variant_id: str):
        self.variant_id = variant_id
        super().__init__(f"PanelVariant {variant_id} not found")


class ListPanelVariantsPublic:
    """List active panel variants for public catalog.
    
    Returns variants with joined panel and texture data.
    """

    def __init__(
        self,
        variant_repo: 'PanelVariantRepository',
        panel_repo: 'PanelRepository',
        texture_repo: 'TextureRepository',
    ):
        self._variant_repo = variant_repo
        self._panel_repo = panel_repo
        self._texture_repo = texture_repo

    async def execute(
        self,
        panel_id: str | None = None,
        texture_id: str | None = None,
        limit: int = 100,
    ) -> tuple[list[dict], int]:
        """Execute and return enriched variant data.
        
        Each variant dict contains:
            - id, panel_id, texture_id, color_id, color_hex, image_paths
            - panel_name, panel_size (from panel)
            - texture_name (from texture)
            - image_urls (full URLs)
        """
        # Get variants
        if panel_id:
            variants = await self._variant_repo.list_by_panel(panel_id, is_active=True)
        else:
            # The public endpoint returns a complete array, not a paginated
            # response. Fetch every repository page before applying visibility
            # filters so panels beyond the first page retain their materials.
            variants = []
            offset = 0
            page_size = max(1, limit)
            while True:
                page, total = await self._variant_repo.list_all(
                    is_active=True, offset=offset, limit=page_size,
                )
                variants.extend(page)
                offset += len(page)
                if not page or offset >= total:
                    break

        # SQL persistence applies explicit moderator assignments only to the
        # public projection; admin editing must still see disabled products.
        filter_allowed = getattr(self._variant_repo, "filter_allowed_variants", None)
        if filter_allowed is not None:
            variants = await filter_allowed(variants)

        # Filter by texture if specified
        if texture_id:
            variants = [v for v in variants if v.texture_id == texture_id]

        # Enrich with panel and texture data
        result = []
        for v in variants:
            panel = await self._panel_repo.get_by_id(v.panel_id)
            texture = await self._texture_repo.get_by_id(v.texture_id)
            
            if not panel or not texture or not panel.is_active or not texture.is_active:
                continue

            # Handle Panel size - can be PanelSize object or string
            panel_size = ""
            if panel:
                if hasattr(panel.size, 'label'):
                    panel_size = panel.size.label
                else:
                    # Fallback for stored data
                    panel_size = f"{panel.size.width_mm}×{panel.size.height_mm} см" if hasattr(panel.size, 'width_mm') else str(panel.size)
            
            result.append({
                "id": v.id,
                "name": v.name or "",
                "slug": v.slug or "",
                "panel_id": v.panel_id,
                "panel_name": panel.name if panel else "",
                "panel_size": panel_size,
                "texture_id": v.texture_id,
                "texture_name": texture.name if texture else "",
                "color_id": v.color_id,
                "color_hex": v.color_hex,
                "image_paths": v.image_paths,
                "design_image_paths": v.design_image_paths,
                "recommendation_image_paths": v.recommendation_image_paths,
                "sort_order": v.sort_order,
                "is_active": v.is_active,
            })

        return result, len(result)
