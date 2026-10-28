"""Phase 8A — `ShopSettings` use case tests.

Covers:
  * `GetShopSettings` returns the seeded singleton.
  * `UpdateShopSettingsAdmin` PATCH semantics: `None` = don't touch,
    explicit `0` = clear (relevant for installation / min-order).
  * Negative inputs rejected as defence-in-depth even though the API
    DTO already guards (`Field(ge=0)`).
  * `updated_at` advances after a patch.
"""
from datetime import datetime, timedelta

import pytest

from app.application.shop.settings_use_cases import (
    GetShopSettings,
    UpdateShopSettingsAdmin,
)
from app.domain.shop.settings import ShopSettings
from app.infrastructure.persistence.repositories.memory import (
    InMemoryShopSettingsRepository,
)


@pytest.fixture
def repo():
    # Default-constructed settings — same defaults the migration seeds.
    return InMemoryShopSettingsRepository()


class TestGetShopSettings:
    @pytest.mark.asyncio
    async def test_returns_seeded_singleton(self, repo):
        s = await GetShopSettings(repo).execute()
        assert s.design_overlay_price == 1200


class TestUpdateShopSettingsAdmin:
    @pytest.mark.asyncio
    async def test_patch_only_overlay(self, repo):
        updated = await UpdateShopSettingsAdmin(repo).execute(
            design_overlay_price=1500,
        )
        assert updated.design_overlay_price == 1500
        # Untouched fields keep their seeded defaults.
        assert updated.installation_price == 0
        assert updated.min_order_amount == 0

    @pytest.mark.asyncio
    async def test_zero_is_a_valid_patch(self, repo):
        # Critical semantic: `0` means "set to zero", NOT "absent".
        # `None` is the absence sentinel. If the use case treated `0`
        # as "don't touch", the admin couldn't disable the installation
        # fee after enabling it.
        await UpdateShopSettingsAdmin(repo).execute(installation_price=500)
        updated = await UpdateShopSettingsAdmin(repo).execute(
            installation_price=0,
        )
        assert updated.installation_price == 0

    @pytest.mark.asyncio
    async def test_none_means_dont_touch(self, repo):
        await UpdateShopSettingsAdmin(repo).execute(
            design_overlay_price=2000, installation_price=300,
        )
        # Patch only min_order — overlay/installation must persist.
        updated = await UpdateShopSettingsAdmin(repo).execute(
            min_order_amount=5000,
        )
        assert updated.design_overlay_price == 2000
        assert updated.installation_price == 300
        assert updated.min_order_amount == 5000

    @pytest.mark.asyncio
    async def test_negative_overlay_rejected(self, repo):
        with pytest.raises(ValueError, match="design_overlay_price"):
            await UpdateShopSettingsAdmin(repo).execute(
                design_overlay_price=-1,
            )

    @pytest.mark.asyncio
    async def test_updated_at_advances_after_patch(self, repo):
        initial = await GetShopSettings(repo).execute()
        before = initial.updated_at
        # Force a measurable gap regardless of clock resolution.
        repo._settings = ShopSettings(
            design_overlay_price=initial.design_overlay_price,
            installation_price=initial.installation_price,
            min_order_amount=initial.min_order_amount,
            updated_at=before - timedelta(seconds=1),
        )
        updated = await UpdateShopSettingsAdmin(repo).execute(
            design_overlay_price=1500,
        )
        assert updated.updated_at > before - timedelta(seconds=1)
        assert isinstance(updated.updated_at, datetime)
