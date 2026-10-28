"""Phase 12 — VariantImage entity (catalog/variant_images).

A `VariantImage` links a specific combination of (Design/Form, Texture,
TextureColor) to a manually-uploaded photograph. The configurator frontend
fetches the image_path for the active combination to display the product
preview.

Business invariant: the triple (design_id, texture_id, color_id) is unique —
exactly one image per combination. Enforced by UNIQUE constraint in SQL
and explicit check in the in-memory repo.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass
class VariantImage:
    """Entity — a product photo for a specific form+texture+color triple."""

    id: str = field(default_factory=lambda: str(uuid4()))
    design_id: str = ""
    texture_id: str = ""
    color_id: str = ""
    image_path: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.design_id:
            raise ValueError("VariantImage.design_id is required")
        if not self.texture_id:
            raise ValueError("VariantImage.texture_id is required")
        if not self.color_id:
            raise ValueError("VariantImage.color_id is required")
