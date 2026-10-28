"""In-memory repository for PanelVariant (catalog/panel_variants).

Mirrors the pattern of texture_repo.py / variant_image_repo.py.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.domain.catalog.panel_variant import PanelVariant

if TYPE_CHECKING:
    from collections.abc import Sequence


class InMemoryPanelVariantRepository:
    """In-memory store for PanelVariant entities."""

    def __init__(self) -> None:
        self._variants: list[PanelVariant] = []

    async def create(self, variant: PanelVariant) -> PanelVariant:
        """Create a new panel variant."""
        # Check for duplicate combination (panel_id + texture_id + color_id)
        for existing in self._variants:
            if (
                existing.panel_id == variant.panel_id
                and existing.texture_id == variant.texture_id
                and self._color_match(existing, variant)
            ):
                raise ValueError(
                    f"Panel variant already exists for "
                    f"panel={variant.panel_id}, texture={variant.texture_id}, "
                    f"color={variant.color_id or variant.color_hex}"
                )
        self._variants.append(variant)
        return variant

    async def get_by_id(self, variant_id: str) -> PanelVariant | None:
        """Get a variant by ID."""
        for v in self._variants:
            if v.id == variant_id:
                return v
        return None

    async def list_by_panel(
        self,
        panel_id: str,
        is_active: bool | None = None,
    ) -> Sequence[PanelVariant]:
        """List all variants for a specific panel."""
        results = [v for v in self._variants if v.panel_id == panel_id]
        if is_active is not None:
            results = [v for v in results if v.is_active == is_active]
        return results

    async def list_all(
        self,
        is_active: bool | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[PanelVariant], int]:
        """List all variants with pagination."""
        results = list(self._variants)
        if is_active is not None:
            results = [v for v in results if v.is_active == is_active]
        total = len(results)
        return results[offset : offset + limit], total

    async def update(self, variant: PanelVariant) -> PanelVariant:
        """Update an existing variant."""
        for i, existing in enumerate(self._variants):
            if existing.id == variant.id:
                self._variants[i] = variant
                return variant
        raise ValueError(f"PanelVariant {variant.id} not found")

    async def delete(self, variant_id: str) -> bool:
        """Delete a variant by ID."""
        for i, v in enumerate(self._variants):
            if v.id == variant_id:
                self._variants.pop(i)
                return True
        return False

    async def delete_by_panel(self, panel_id: str) -> int:
        """Delete all variants for a panel. Returns count deleted."""
        original_count = len(self._variants)
        self._variants = [v for v in self._variants if v.panel_id != panel_id]
        return original_count - len(self._variants)

    def _color_match(self, a: PanelVariant, b: PanelVariant) -> bool:
        """Check if two variants have matching colors."""
        # Both use DB color_id
        if a.color_id and b.color_id:
            return a.color_id == b.color_id
        # Both use custom hex
        if a.color_hex and b.color_hex:
            return a.color_hex.lower() == b.color_hex.lower()
        # One uses DB, one uses custom - no match
        return False
