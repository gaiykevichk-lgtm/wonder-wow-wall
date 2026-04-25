"""Phase 8 — repository ABCs for the Shop bounded context.

`ShopSettingsRepository` (8A) is a singleton-row repo with a slim
interface (`get`/`update`). `BannerRepository` (8B) is a regular CRUD
repo; the `list_banners` signature accepts an optional position filter
+ `include_inactive` flag (the public endpoint hard-codes `False`).
`SubscriptionPlanRepository` lands here in Phase 8C.
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
    @abstractmethod
    async def list_banners(
        self,
        *,
        position: BannerPosition | None = None,
        include_inactive: bool = False,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Banner], int]:
        """List banners filtered by position + activity.

        Sort order is `(priority desc, created_at desc)` — admin's
        explicit `priority` wins, ties broken by recency. Same posture
        as `InMemoryPanelRepository.list_panels` (newest-first).
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
        """Returns True on success, False if the id was unknown."""
