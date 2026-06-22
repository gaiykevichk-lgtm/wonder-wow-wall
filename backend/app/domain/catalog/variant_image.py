"""Phase 12 + Panel Creator Wizard — VariantImage entity.

A `VariantImage` links a specific combination of (Design/Form, Texture,
TextureColor, Size) to a manually-uploaded photograph. The configurator
frontend fetches the image_path for the active combination to display
the product preview.

Business invariant: the tuple (design_id, texture_id, color_id, size_key)
is unique — exactly one image per combination. `size_key` is nullable for
backward compatibility with legacy entries created before the wizard.

Phase Panel Creator Wizard additions:
  * `size_key` — panel size (30x30, 30x60, 60x60) or null for legacy
  * `hex`       — optional color override per variant (null = use TextureColor.hex)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


# Valid panel size keys — mirrors frontend PANEL_SIZES
VALID_SIZE_KEYS = frozenset({"30x30", "30x60", "60x60"})


@dataclass
class VariantImage:
    """Entity — a product photo for a specific form+texture+color+size triple."""

    id: str = field(default_factory=lambda: str(uuid4()))
    design_id: str = ""
    texture_id: str = ""
    color_id: str = ""
    image_path: str = ""
    # ── Panel Creator Wizard additions ──────────────────────────────
    size_key: str | None = None   # nullable: 30x30, 30x60, 60x60 or null (legacy)
    hex: str | None = None        # optional color override per variant
    # ─────────────────────────────────────────────────────────────────
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.design_id:
            raise ValueError("VariantImage.design_id is required")
        if not self.texture_id:
            raise ValueError("VariantImage.texture_id is required")
        if not self.color_id:
            raise ValueError("VariantImage.color_id is required")
        if self.size_key is not None and self.size_key not in VALID_SIZE_KEYS:
            raise ValueError(
                f"VariantImage.size_key must be one of {sorted(VALID_SIZE_KEYS)}, "
                f"got {self.size_key!r}"
            )
        if self.hex is not None and not (
            len(self.hex) == 7 and self.hex.startswith("#")
        ):
            raise ValueError(
                f"VariantImage.hex must be #RRGGBB format, got {self.hex!r}"
            )
