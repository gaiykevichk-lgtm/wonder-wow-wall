"""Phase 7B — `Panel` aggregate root (catalog/panels).

A `Panel` is the *physical* SKU the customer mounts on their wall: it
carries a name, a fixed `PanelSize` VO (300x300, 300x600, 600x600, …), a
base price, a marketing description, an optional photo (path into the
Phase 6 `MediaAsset` storage), and an `is_active` flag the admin uses to
hide a SKU from the public constructor without a hard delete.

Why a new aggregate (separate from `Design`):
  Panels and Designs have orthogonal lifecycles. A panel is a hardware
  item with a price and stock signal; a design is the printed overlay
  the customer chooses. The order line records both as text (`size_key`
  + `design_name`), so neither table FKs into the other — deleting a
  panel does not break old order rows.

Why the `size` is a VO and not a free-text column:
  The constructor relies on a small enumerated set of grid cells (1x1,
  1x2, 2x2). Storing arbitrary mm pairs would let the admin create a
  `347x891` panel that the constructor cannot place. The VO at
  `value_objects.PanelSize` enumerates the supported geometry; the
  admin form picks from it (we lift the dict at startup into the form's
  Select options). On the persistence side we still store width/height
  as plain ints so a future sizing rollout doesn't need a schema change.

`slug` is the public, URL-friendly identifier the constructor + catalog
URL use (e.g., `/catalog/panels/small-square`). Required + unique;
duplication raises at the repository layer in BOTH SQL (UNIQUE
constraint) and InMemory (explicit check) — same defence-in-depth as
`MediaAsset.path` in Phase 6.

`photo_path` mirrors the `Design.image` convention — a *path* string
that `FileStorage.url_for(...)` turns into a public URL. Empty string
means "no photo yet" (not None — keeps the column NOT NULL and the
domain field type pure `str`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import PanelSize


@dataclass
class Panel:
    """Aggregate Root for the Panel bounded sub-context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    size: PanelSize = field(default_factory=lambda: PanelSize(300, 300, "30×30 см"))
    base_price: int = 0
    description: str = ""
    photo_path: str = ""
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        # Defensive invariants — caught here once instead of being smeared
        # across every use case. Use cases are still free to add extra
        # business rules (e.g., name uniqueness across categories) on top.
        if self.base_price < 0:
            raise ValueError("Panel.base_price cannot be negative")
        if self.size.width_mm <= 0 or self.size.height_mm <= 0:
            raise ValueError("Panel.size dimensions must be positive")
