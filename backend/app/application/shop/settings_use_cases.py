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
from typing import Any

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
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

    def __init__(
        self,
        repo: ShopSettingsRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self,
        *,
        actor_id: str | None = None,
        design_overlay_price: int | None = None,
        installation_price: int | None = None,
        min_order_amount: int | None = None,
        recommendations_limit_per_source: int | None = None,
    ) -> ShopSettings:
        current = await self.repo.get()
        # Snapshot the before-values so the audit payload can record only
        # the fields that actually changed (PATCH semantics — `None` is
        # "don't touch", not "unchanged"; equal-but-set is "no-op write").
        before = {
            "design_overlay_price": current.design_overlay_price,
            "installation_price": current.installation_price,
            "min_order_amount": current.min_order_amount,
            "recommendations_limit_per_source": current.recommendations_limit_per_source,
        }
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
        if recommendations_limit_per_source is not None:
            if recommendations_limit_per_source < 1:
                raise ValueError(
                    "ShopSettings.recommendations_limit_per_source must be >= 1"
                )
            current.recommendations_limit_per_source = recommendations_limit_per_source
        current.updated_at = datetime.utcnow()
        updated = await self.repo.update(current)

        if self.audit_recorder is not None and actor_id is not None:
            # Diff: report only fields whose value changed so the audit
            # payload stays informative even when the admin sends the full
            # settings object back unchanged (frontend convenience).
            changes: dict[str, dict[str, Any]] = {}
            for key, old in before.items():
                new = getattr(updated, key)
                if old != new:
                    changes[key] = {"from": old, "to": new}
            if changes:
                await self.audit_recorder.execute(
                    actor_id=actor_id,
                    action=AuditAction.SETTINGS_UPDATE,
                    target_type=AuditTargetType.SETTINGS,
                    target_id=updated.id,
                    payload={"changes": changes},
                )
        return updated
