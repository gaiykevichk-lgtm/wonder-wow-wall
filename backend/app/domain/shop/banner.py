"""Phase 8B — `Banner` aggregate (homepage / catalog hero rotation).

The frontend renders a rotating hero on the main page and supplementary
spots in the catalog. Each `Banner` is a CMS record the admin manages
without a code deploy: image, headline, CTA, where it appears, and
ordering.

Modelled as a regular entity (not a singleton like ShopSettings) — the
shop has many banners and the admin reorders them via the `priority`
integer (descending; higher = earlier in the carousel).

`position` is an enum rather than a free-form string so the public
endpoint can validate `?position=` server-side and the frontend can use
literal types instead of stringly-typed comparisons.

Invariants enforced in `__post_init__`:
  * `image_path` non-empty (a banner without an image is useless)
  * `priority` >= 0 (DB index expects non-negative ordinals)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import uuid4


class BannerPosition(str, Enum):
    """Where the banner is rendered.

    Stored as a string in DB for human-readable diagnostics. Frontend
    has matching constants in `domains/shop/model/banners.ts` (Phase
    8B-frontend, deferred); the API rejects unknown positions with
    422 via Pydantic before the use case is invoked.
    """
    HOMEPAGE_HERO = "homepage_hero"
    HOMEPAGE_SECONDARY = "homepage_secondary"
    CATALOG_TOP = "catalog_top"


@dataclass
class Banner:
    """CMS-managed promotional banner.

    `cta_text` and `cta_link` are both optional — a banner can be a
    pure-image hero with no clickthrough (e.g., a seasonal mood
    visual). `cta_link` is stored verbatim; the frontend decides
    whether it's an external URL or an in-app route.
    """

    id: str = field(default_factory=lambda: str(uuid4()))
    image_path: str = ""
    title: str = ""
    cta_text: str = ""
    cta_link: str = ""
    position: BannerPosition = BannerPosition.HOMEPAGE_HERO
    is_active: bool = True
    # Higher priority renders earlier in the carousel; ties broken by
    # `created_at` (newest first) at the use-case level.
    priority: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.image_path:
            raise ValueError("Banner.image_path must not be empty")
        if self.priority < 0:
            raise ValueError("Banner.priority cannot be negative")
