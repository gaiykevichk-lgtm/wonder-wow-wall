"""Phase 8A — `ShopSettings` use cases.

Two verbs only: `Get` (read; both admin and public catalog use it) and
`UpdateShopSettingsAdmin` (PATCH semantics). No `Create`/`Delete` —
the row is a singleton seeded by the migration.

PATCH semantics match Phase 4B/5/7B: `None` means "don't touch", an
explicit value (including `0`) overwrites. Note that `0` is a *valid*
price for `installation_price` and `min_order_amount` (admin disables
the feature by zeroing the knob), so we can't use the "treat 0 as
absent" shortcut some PATCH styles take.
"""
from __future__ import annotations

from datetime import datetime

from app.domain.shop.repositories import ShopSettingsRepository
from app.domain.shop.settings import ShopSettings


class GetShopSettings:
    """Public + admin read.

    Same use case for both audiences because the payload is identical
    (no admin-only fields). Splitting would be ceremony without value
    — the gate stays at the API layer (`get_current_admin_id` on the
    admin route, no auth on the public route).
    """

    def __init__(self, repo: ShopSettingsRepository):
        self.repo = repo

    async def execute(self) -> ShopSettings:
        return await self.repo.get()


class UpdateShopSettingsAdmin:
    """Patch-style update of the singleton row.

    Returns the persisted entity. `updated_at` is refreshed here (not
    in the repo) so the timestamp reflects the *use-case* moment — if
    a future caller wants to skip the refresh (e.g., a backfill
    script), they can call the repo directly.
    """

    def __init__(self, repo: ShopSettingsRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        design_overlay_price: int | None = None,
        installation_price: int | None = None,
        min_order_amount: int | None = None,
    ) -> ShopSettings:
        current = await self.repo.get()
        if design_overlay_price is not None:
            if design_overlay_price < 0:
                raise ValueError(
                    "ShopSettings.design_overlay_price cannot be negative"
                )
            current.design_overlay_price = design_overlay_price
        if installation_price is not None:
            if installation_price < 0:
                raise ValueError(
                    "ShopSettings.installation_price cannot be negative"
                )
            current.installation_price = installation_price
        if min_order_amount is not None:
            if min_order_amount < 0:
                raise ValueError(
                    "ShopSettings.min_order_amount cannot be negative"
                )
            current.min_order_amount = min_order_amount
        current.updated_at = datetime.utcnow()
        return await self.repo.update(current)
