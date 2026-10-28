"""Phase 8A — `ShopSettings` aggregate (singleton row).

Holds the global business knobs the admin can change at runtime without
a code deploy. The first knob is `design_overlay_price` (the surcharge
the customer pays to apply a custom design on top of a base panel SKU)
— it has lived in `frontend/src/shared/config/constants.ts` as
`DESIGN_OVERLAY_PRICE = 1200` since the original prototype, which means
changing it required a frontend rebuild. Phase 8A migrates it to the
backend as the source of truth.

`id` is fixed to `"singleton"` because there is exactly one settings
row per shop. We model it as an entity (not a VO) anyway because:
  * it has identity in the database (the PK row never changes)
  * it carries `updated_at` for audit purposes
  * future fields may turn it into something with mutable but
    referenceable state (e.g., feature flags)

Invariants enforced in `__post_init__`:
  * all prices ≥ 0 — the admin form caps client-side too, but the
    domain refuses to construct an invalid aggregate so a malformed
    seed/migration cannot enter the system.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


# Singleton row PK. Constants here (not in a config module) so a future
# reader of the entity sees the contract without grepping.
SHOP_SETTINGS_SINGLETON_ID = "singleton"


@dataclass
class ShopSettings:
    """Singleton-row shop configuration.

    Defaults match the legacy frontend constants so a fresh install
    behaves identically to pre-Phase-8 builds:
      * `design_overlay_price = 1200` — was `DESIGN_OVERLAY_PRICE`
      * `installation_price  = 0`    — feature is admin-toggleable;
                                       disabled by default
      * `min_order_amount    = 0`    — no minimum until admin sets one
      * `recommendations_limit_per_source = 12` — Phase 10. Cap on
                                       admin-curated «с этим
                                       покупают» targets per source.
    """

    id: str = SHOP_SETTINGS_SINGLETON_ID
    design_overlay_price: int = 1200
    installation_price: int = 0
    min_order_amount: int = 0
    recommendations_limit_per_source: int = 12
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if self.design_overlay_price < 0:
            raise ValueError(
                "ShopSettings.design_overlay_price cannot be negative"
            )
        if self.installation_price < 0:
            raise ValueError(
                "ShopSettings.installation_price cannot be negative"
            )
        if self.min_order_amount < 0:
            raise ValueError(
                "ShopSettings.min_order_amount cannot be negative"
            )
        if self.recommendations_limit_per_source < 1:
            raise ValueError(
                "ShopSettings.recommendations_limit_per_source must be >= 1"
            )
