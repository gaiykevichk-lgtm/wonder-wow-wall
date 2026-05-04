"""Phase 12 — unit tests for Texture, TextureColor, VariantImage entities."""
import pytest

from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.variant_image import VariantImage


class TestTexture:
    def test_create_valid(self):
        t = Texture(name="Бетон", slug="concrete", sort_order=0)
        assert t.name == "Бетон"
        assert t.slug == "concrete"
        assert t.is_active is True
        assert t.id  # UUID generated

    def test_negative_sort_order_raises(self):
        with pytest.raises(ValueError, match="sort_order"):
            Texture(name="X", slug="x", sort_order=-1)

    def test_default_swatch_image_empty(self):
        t = Texture(name="Wood", slug="wood")
        assert t.swatch_image == ""


class TestTextureColor:
    def test_create_valid(self):
        c = TextureColor(
            texture_id="tex-1", name="Серый", hex="#8C8C8C", sort_order=0,
        )
        assert c.texture_id == "tex-1"
        assert c.hex == "#8C8C8C"
        assert c.is_active is True

    def test_invalid_hex_raises(self):
        with pytest.raises(ValueError, match="hex"):
            TextureColor(texture_id="t1", name="Bad", hex="not-a-hex")

    def test_short_hex_raises(self):
        with pytest.raises(ValueError, match="hex"):
            TextureColor(texture_id="t1", name="Short", hex="#FFF")

    def test_empty_hex_allowed(self):
        c = TextureColor(texture_id="t1", name="NoHex", hex="")
        assert c.hex == ""

    def test_negative_sort_order_raises(self):
        with pytest.raises(ValueError, match="sort_order"):
            TextureColor(texture_id="t1", name="X", hex="#000000", sort_order=-1)


class TestVariantImage:
    def test_create_valid(self):
        v = VariantImage(
            design_id="d1", texture_id="t1", color_id="c1",
            image_path="variants/wave-concrete-gray.jpg",
        )
        assert v.design_id == "d1"
        assert v.texture_id == "t1"
        assert v.color_id == "c1"
        assert v.image_path == "variants/wave-concrete-gray.jpg"

    def test_missing_design_id_raises(self):
        with pytest.raises(ValueError, match="design_id"):
            VariantImage(design_id="", texture_id="t1", color_id="c1")

    def test_missing_texture_id_raises(self):
        with pytest.raises(ValueError, match="texture_id"):
            VariantImage(design_id="d1", texture_id="", color_id="c1")

    def test_missing_color_id_raises(self):
        with pytest.raises(ValueError, match="color_id"):
            VariantImage(design_id="d1", texture_id="t1", color_id="")
