"""Phase 8B — `Banner` aggregate (homepage promo rotation).

A `Banner` is an admin-managed image+CTA card the customer sees on the
shop landing or in the catalog hero. Lifecycle is independent of every
other entity (no FKs in/out) so an admin can rotate banners without
touching products. Designed to be cached for 5 minutes on the public
read path (TanStack Query default for the rest of Phase 8).

Why an aggregate (not a VO list inside `ShopSettings`):
  Banners need an `id` (the CMS UI must identify rows for edit/delete),
  carry per-row provenance (`created_at`, `updated_at`), and the public
  list-by-position read pattern is hot — keeping each banner addressable
  by id makes incremental admin reorder cheap.

Position is an enum (`HOMEPAGE_HERO`, `CATALOG_TOP`, `FOOTER`) so the
public GET `/api/shop/banners?position=…` filters cleanly. Free-text
positions would let an admin create a `position="homepage_hreo"` typo
that silently never renders.

Soft-hide is via `is_active`, mirroring `Panel.is_active` (Phase 7B).
Public list filters on it; admin sees everything.

`priority` is an int — lower-first ordering, with `0` as the default
"highest" slot. Two banners can share a priority; insertion order
breaks ties (stable sort in both repos).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import uuid4


class BannerPosition(str, Enum):
    """Closed set of slots a banner can occupy.

    Stored as the literal string in the DB column so the migration is
    human-readable and the JSON wire shape is stable. Adding a new
    position is additive (no data migration needed); removing one
    requires a backfill that the audit log captures.
    """

    HOMEPAGE_HERO = "homepage_hero"
    CATALOG_TOP = "catalog_top"
    FOOTER = "footer"


@dataclass
class Banner:
    """Aggregate Root for the Banner sub-context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    subtitle: str = ""
    image_path: str = ""
    cta_label: str = ""
    cta_url: str = ""
    position: BannerPosition = BannerPosition.HOMEPAGE_HERO
    priority: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        # Defensive invariants. Pydantic does shape validation at the API
        # boundary; this is the safety net for non-API callers (CLI
        # seeder, alembic backfills, future event-bus consumers).
        if self.priority < 0:
            raise ValueError("Banner.priority cannot be negative")
        if self.image_path == "":
            # An empty image_path means a card the customer would see as
            # a broken `<img>`. Allow it ONLY if `is_active=False`
            # (admin draft state). The use cases enforce this further.
            if self.is_active:
                raise ValueError(
                    "Banner.image_path is required for an active banner"
                )
