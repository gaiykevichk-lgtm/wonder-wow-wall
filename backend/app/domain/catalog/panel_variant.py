"""PanelVariant entity (catalog/panel_variants).

Links a base Panel (size) to a Texture with images.
This is the product combination shown in the catalog.

Colour is intentionally NOT part of the product identity anymore: the
photos themselves communicate the finish, so `color_id` / `color_hex`
are legacy nullable fields kept only so historical rows keep loading.
New variants are created without any colour at all.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass
class PanelVariant:
    """Entity — a panel variant with texture, color and images."""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    panel_id: str = ""
    texture_id: str = ""
    color_id: str | None = None
    color_hex: str | None = None  # For custom colors (#RRGGBB)
    image_paths: list[str] = field(default_factory=list)  # S3 paths, first = main
    design_image_paths: list[str] = field(default_factory=list)
    recommendation_image_paths: list[str] = field(default_factory=list)
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.panel_id:
            raise ValueError("PanelVariant.panel_id is required")
        if not self.texture_id:
            raise ValueError("PanelVariant.texture_id is required")
        # Colour is no longer part of the variant identity. A variant is
        # fully described by panel size + texture + its photos, so no
        # colour invariant is enforced here.

    def add_image(self, path: str) -> None:
        """Add an image path. First added becomes the main image."""
        if path not in self.image_paths:
            if not self.image_paths:
                self.image_paths.insert(0, path)
            else:
                self.image_paths.append(path)
            self.updated_at = datetime.utcnow()

    def remove_image(self, path: str) -> None:
        """Remove an image path."""
        if path in self.image_paths:
            self.image_paths.remove(path)
            self.updated_at = datetime.utcnow()

    def reorder_images(self, new_order: list[str]) -> None:
        """Reorder image paths."""
        if set(new_order) == set(self.image_paths):
            self.image_paths = new_order
            self.updated_at = datetime.utcnow()

    @property
    def main_image(self) -> str | None:
        """Return the main (first) image path."""
        return self.image_paths[0] if self.image_paths else None
