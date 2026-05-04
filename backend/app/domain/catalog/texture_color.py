"""Phase 12 — TextureColor entity (catalog/texture_colors).

A `TextureColor` is a colourway within a specific `Texture` (material).
For example, texture "Бетон" (concrete) may offer colours "Серый", "Белый",
"Антрацит". Each colour can optionally carry a swatch_image for richer UI.

`hex` stores the representative hex code (e.g., "#8C8C8C") used for the
colour dot in the configurator when no swatch_image is provided.

`sort_order` controls display order within the parent texture.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


@dataclass
class TextureColor:
    """Entity — a colour option belonging to a Texture aggregate."""

    id: str = field(default_factory=lambda: str(uuid4()))
    texture_id: str = ""
    name: str = ""
    hex: str = ""
    swatch_image: str = ""
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if self.hex and not _HEX_RE.match(self.hex):
            raise ValueError(f"TextureColor.hex must be #RRGGBB, got: {self.hex!r}")
        if self.sort_order < 0:
            raise ValueError("TextureColor.sort_order cannot be negative")
