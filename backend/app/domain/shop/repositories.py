"""Phase 8 — repository ABCs for the Shop bounded context.

* `ShopSettingsRepository` (8A) — singleton-row repo (`get`/`update`).
* `BannerRepository` (8B) — homepage promo CRUD.

Note: `SubscriptionPlanRepository` lives in
`app/domain/subscription/repositories.py` (not here) because the
existing `Subscription` aggregate already references plans by `plan_id`
and the legacy `SUBSCRIPTION_PLANS` constant lived in the same module.
Keeping the plan repo next to the entity preserves the bounded-context
boundary.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .banner import Banner, BannerPosition
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


class BannerRepository(ABC):
    """Phase 8B — homepage promo banner CRUD."""

    @abstractmethod
    async def list_banners(
        self,
        *,
        position: BannerPosition | None = None,
        active_only: bool = False,
    ) -> list[Banner]:
        """Return all banners, sorted by priority asc then created_at asc.

        `position` narrows by slot (admin filter / public listing).
        `active_only=True` is the public read posture; admin defaults to
        `False` so it sees everything (drafts + scheduled banners).
        """

    @abstractmethod
    async def get_by_id(self, banner_id: str) -> Banner | None:
        ...

    @abstractmethod
    async def create(self, banner: Banner) -> Banner:
        ...

    @abstractmethod
    async def update(self, banner: Banner) -> Banner:
        ...

    @abstractmethod
    async def delete(self, banner_id: str) -> bool:
        """Returns True if a row was deleted, False if missing."""
