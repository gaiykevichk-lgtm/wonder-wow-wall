"""Phase 8B — Banner domain invariants."""
import pytest

from app.domain.shop.banner import Banner, BannerPosition


class TestBannerInvariants:
    def test_default_construction(self):
        b = Banner(title="x", image_path="img.jpg")
        assert b.id
        assert b.position == BannerPosition.HOMEPAGE_HERO
        assert b.priority == 0
        assert b.is_active is True

    def test_negative_priority_rejected(self):
        with pytest.raises(ValueError, match="priority"):
            Banner(title="x", image_path="img.jpg", priority=-1)

    def test_active_requires_image_path(self):
        with pytest.raises(ValueError, match="image_path"):
            Banner(title="x", image_path="", is_active=True)

    def test_inactive_allows_empty_image(self):
        # Draft state — admin can save without image then upload later.
        b = Banner(title="x", image_path="", is_active=False)
        assert b.image_path == ""
        assert b.is_active is False

    def test_position_enum_values(self):
        assert BannerPosition("homepage_hero") == BannerPosition.HOMEPAGE_HERO
        assert BannerPosition("catalog_top") == BannerPosition.CATALOG_TOP
        assert BannerPosition("footer") == BannerPosition.FOOTER
