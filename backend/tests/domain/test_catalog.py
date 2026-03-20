import pytest
from app.domain.catalog.entities import Design, DesignReview, Category
from app.domain.catalog.value_objects import (
    PanelSize, PanelSizeKey, PANEL_SIZES, BASE_PANEL_PRICES,
    DESIGN_OVERLAY_PRICE, Color, Price,
)


class TestPanelSize:
    def test_panel_sizes_count(self):
        assert len(PANEL_SIZES) == 3

    def test_keys(self):
        assert PanelSizeKey.S_30x30 in PANEL_SIZES
        assert PanelSizeKey.S_30x60 in PANEL_SIZES
        assert PanelSizeKey.S_60x60 in PANEL_SIZES

    def test_panel_size_key_property(self):
        ps = PanelSize(300, 300, "30×30 см")
        assert ps.key == "300x300"

    def test_panel_size_is_frozen(self):
        ps = PanelSize(300, 300, "test")
        with pytest.raises(AttributeError):
            ps.width_mm = 600


class TestBasePanelPrices:
    def test_prices_exist_for_all_sizes(self):
        assert len(BASE_PANEL_PRICES) == 3

    def test_30x30_price(self):
        assert BASE_PANEL_PRICES["300x300"] == 890

    def test_30x60_price(self):
        assert BASE_PANEL_PRICES["300x600"] == 1490

    def test_60x60_price(self):
        assert BASE_PANEL_PRICES["600x600"] == 2490

    def test_prices_increase_with_size(self):
        assert BASE_PANEL_PRICES["300x300"] < BASE_PANEL_PRICES["300x600"] < BASE_PANEL_PRICES["600x600"]


class TestDesignOverlayPrice:
    def test_value(self):
        assert DESIGN_OVERLAY_PRICE == 1200


class TestColor:
    def test_create(self):
        c = Color("#4CAF50", "Зелёный")
        assert c.hex == "#4CAF50"
        assert c.name == "Зелёный"

    def test_frozen(self):
        c = Color("#000", "Black")
        with pytest.raises(AttributeError):
            c.hex = "#fff"


class TestPrice:
    def test_create(self):
        p = Price(1200)
        assert p.amount == 1200
        assert p.currency == "RUB"

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            Price(-100)


class TestDesign:
    def test_create(self):
        d = Design(name="Test", slug="test", price=1200)
        assert d.name == "Test"
        assert d.price == 1200
        assert d.rating == 0.0
        assert d.reviews_count == 0

    def test_add_review_updates_rating(self):
        d = Design(name="Test", slug="test")
        r1 = DesignReview(rating=5, text="Great")
        d.add_review(r1)
        assert d.reviews_count == 1
        assert d.rating == 5.0

        r2 = DesignReview(rating=3, text="OK")
        d.add_review(r2)
        assert d.reviews_count == 2
        assert d.rating == 4.0  # (5+3)/2


class TestDesignReview:
    def test_create(self):
        r = DesignReview(rating=4, text="Nice")
        assert r.rating == 4
        assert r.text == "Nice"

    def test_invalid_rating(self):
        with pytest.raises(ValueError):
            DesignReview(rating=0)
        with pytest.raises(ValueError):
            DesignReview(rating=6)


class TestCategory:
    def test_create(self):
        c = Category(name="Природа", slug="nature", count=5)
        assert c.name == "Природа"
        assert c.slug == "nature"
