"""Phase 8 — repository ABCs for the Shop bounded context.

`ShopSettingsRepository` (8A) is a singleton-row repo with a slim
interface (`get`/`update`). `BannerRepository` (8B) and
`SubscriptionPlanRepository` (8C) land here when those phases ship.
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
