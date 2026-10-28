"""Phase 8A — `ShopSettings` invariant tests.

Confirms `__post_init__` rejects negative prices on construction so a
malformed seed/migration cannot enter the system.
"""
import pytest

from app.domain.shop.settings import (
    SHOP_SETTINGS_SINGLETON_ID,
    ShopSettings,
)


class TestShopSettingsDefaults:
    def test_defaults_match_legacy_constants(self):
        s = ShopSettings()
        assert s.id == SHOP_SETTINGS_SINGLETON_ID
        # Mirrors `frontend/src/shared/config/constants.ts
        # DESIGN_OVERLAY_PRICE = 1200`. Drift here would silently change
        # cart totals on rollout.
        assert s.design_overlay_price == 1200
        assert s.installation_price == 0
        assert s.min_order_amount == 0


class TestShopSettingsInvariants:
    def test_negative_overlay_rejected(self):
        with pytest.raises(ValueError, match="design_overlay_price"):
            ShopSettings(design_overlay_price=-1)

    def test_negative_installation_rejected(self):
        with pytest.raises(ValueError, match="installation_price"):
            ShopSettings(installation_price=-1)

    def test_negative_min_order_rejected(self):
        with pytest.raises(ValueError, match="min_order_amount"):
            ShopSettings(min_order_amount=-1)

    def test_zero_is_a_valid_value(self):
        # `0` semantically means "feature disabled" for installation /
        # min-order. The PATCH semantics test in the use-case suite
        # depends on this — make it explicit here.
        s = ShopSettings(
            design_overlay_price=0, installation_price=0, min_order_amount=0,
        )
        assert s.design_overlay_price == 0
