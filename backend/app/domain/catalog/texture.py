"""Phase 12 — Texture aggregate (catalog/textures).

A `Texture` represents a material/finish available for panels: concrete,
wood, marble, etc. Each texture carries a set of `TextureColor` children
that define which colourways are available in that material.

The constructor/configurator UI presents textures as swatches; the admin
manages them via CRUD in the textures admin page.

`slug` is URL-friendly, unique across all textures.
`swatch_image` is a path into FileStorage (same convention as Panel.photo_path).
`sort_order` controls display order in the configurator (lower = first).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass
class Texture:
    """Aggregate Root for a panel material/texture."""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    swatch_image: str = ""
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if self.sort_order < 0:
            raise ValueError("Texture.sort_order cannot be negative")
