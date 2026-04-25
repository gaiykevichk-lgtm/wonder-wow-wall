"""Phase 8A — repository ABC for `ShopSettings`.

Singleton repo, hence the slim interface:
  * `get()` always returns the row (the migration seeds it; the repo
    must never need to "create" it at runtime). If a deployment ever
    finds the row missing, that is a configuration error, not a domain
    state — the SQL implementation raises rather than synthesizing.
  * `update(settings)` writes the row back. Returns the persisted entity
    so the caller can rely on `updated_at` being refreshed by the repo.

`Banner` and `SubscriptionPlanRepository` will land in this module in
Phase 8B / 8C.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .settings import ShopSettings


class ShopSettingsRepository(ABC):
    @abstractmethod
    async def get(self) -> ShopSettings:
        """Return the singleton settings row.

        Raises if the row is missing — a missing seed is a deploy error,
        not a domain state we should silently paper over with defaults
        (otherwise an admin's saved config could be undone by a transient
        DB error and never noticed).
        """

    @abstractmethod
    async def update(self, settings: ShopSettings) -> ShopSettings:
        """Persist the patched settings, refresh `updated_at`."""
