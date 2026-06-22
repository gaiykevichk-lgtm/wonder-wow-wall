"""
Phase Panel Creator Wizard — unit tests for batch variant image use case.
"""

import pytest
from datetime import datetime
from uuid import uuid4

from app.application.catalog.variant_image_use_cases import (
    CreateVariantImageBatchAdmin,
    VariantImageBatchItem,
    VariantImageBatchResult,
)
from app.domain.catalog.variant_image import VariantImage, VALID_SIZE_KEYS
from app.domain.catalog.catalog_exceptions import DesignNotFoundError


# ─── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def mock_design_repo():
    """Design repository that always returns a design."""
    class MockDesignRepo:
        async def get_by_id(self, design_id):
            class FakeDesign:
                id = design_id
                name = "Test Design"
                slug = "test-design"
            return FakeDesign()
    return MockDesignRepo()


@pytest.fixture
def mock_texture_repo():
    """Texture repository that returns a texture for known IDs."""
    class MockTextureRepo:
        def __init__(self):
            self.textures = {}
        async def get_by_id(self, texture_id):
            if texture_id in self.textures:
                class FakeTexture:
                    id = texture_id
                    name = self.textures[texture_id]
                    slug = f"texture-{texture_id}"
                return FakeTexture()
            return None
        def add_texture(self, texture_id, name):
            self.textures[texture_id] = name
    repo = MockTextureRepo()
    repo.add_texture("tex-1", "Concrete")
    repo.add_texture("tex-2", "Wood")
    return repo


@pytest.fixture
def mock_color_repo():
    """Color repository that returns a color for known IDs."""
    class MockColorRepo:
        def __init__(self):
            self.colors = {}
        async def get_by_id(self, color_id):
            if color_id in self.colors:
                class FakeColor:
                    id = color_id
                    name = self.colors[color_id]
                    hex = "#808080"
                return FakeColor()
            return None
        def add_color(self, color_id, name):
            self.colors[color_id] = name
    repo = MockColorRepo()
    repo.add_color("color-1", "Gray")
    repo.add_color("color-2", "White")
    return repo


@pytest.fixture
def mock_variant_repo():
    """In-memory variant repository for testing."""
    class MockVariantRepo:
        def __init__(self):
            self._variants = []
            self._id_counter = 0

        async def get_by_combination(self, design_id, texture_id, color_id, size_key=None):
            for v in self._variants:
                if (v.design_id == design_id
                        and v.texture_id == texture_id
                        and v.color_id == color_id
                        and v.size_key == size_key):
                    return v
            return None

        async def upsert(self, variant):
            existing = await self.get_by_combination(
                variant.design_id,
                variant.texture_id,
                variant.color_id,
                variant.size_key,
            )
            if existing:
                existing.image_path = variant.image_path
                existing.hex = variant.hex
                return existing
            variant.id = f"variant-{self._id_counter}"
            self._id_counter += 1
            self._variants.append(variant)
            return variant

        @property
        def _variants_list(self):
            return self._variants

    return MockVariantRepo()


@pytest.fixture
def batch_use_case(mock_variant_repo, mock_design_repo, mock_texture_repo, mock_color_repo):
    return CreateVariantImageBatchAdmin(
        repo=mock_variant_repo,
        design_repo=mock_design_repo,
        texture_repo=mock_texture_repo,
        color_repo=mock_color_repo,
    )


# ─── Tests ─────────────────────────────────────────────────────────────────

class TestVariantImageBatchItem:
    """Tests for VariantImageBatchItem DTO."""

    def test_create_batch_item(self):
        item = VariantImageBatchItem(
            texture_id="tex-1",
            color_id="color-1",
            image_path="/images/test.jpg",
            size_key="30x30",
            hex_color="#FF0000",
        )
        assert item.texture_id == "tex-1"
        assert item.color_id == "color-1"
        assert item.image_path == "/images/test.jpg"
        assert item.size_key == "30x30"
        assert item.hex_color == "#FF0000"

    def test_create_batch_item_optional_fields(self):
        item = VariantImageBatchItem(
            texture_id="tex-1",
            color_id="color-1",
            image_path="/images/test.jpg",
        )
        assert item.size_key is None
        assert item.hex_color is None


class TestVariantImageBatchResult:
    """Tests for VariantImageBatchResult DTO."""

    def test_create_batch_result(self):
        created = [VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="/a.jpg")]
        updated = [VariantImage(design_id="d1", texture_id="t2", color_id="c1", image_path="/b.jpg")]
        errors = [{"index": 0, "errors": {"image_path": "required"}}]

        result = VariantImageBatchResult(
            created=created,
            updated=updated,
            errors=errors,
        )

        assert len(result.created) == 1
        assert len(result.updated) == 1
        assert len(result.errors) == 1
        assert result.total_processed == 3


class TestCreateVariantImageBatchAdmin:
    """Tests for CreateVariantImageBatchAdmin use case."""

    @pytest.mark.asyncio
    async def test_batch_create_success(self, batch_use_case):
        """Test successful batch creation of new variants."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/concrete-gray-30.jpg",
                size_key="30x30",
                hex_color="#808080",
            ),
            VariantImageBatchItem(
                texture_id="tex-2",
                color_id="color-2",
                image_path="/images/wood-white-30.jpg",
                size_key="30x30",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 0
        assert len(result.created) == 2
        assert len(result.updated) == 0
        assert result.total_processed == 2

    @pytest.mark.asyncio
    async def test_batch_upsert_updates_existing(self, batch_use_case, mock_variant_repo):
        """Test that upsert updates existing variants."""
        # First create
        items1 = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/original.jpg",
                size_key="30x30",
            ),
        ]
        result1 = await batch_use_case.execute(design_id="design-1", items=items1)
        assert len(result1.created) == 1

        # Update with new image
        items2 = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/updated.jpg",
                size_key="30x30",
            ),
        ]
        result2 = await batch_use_case.execute(design_id="design-1", items=items2)
        assert len(result2.updated) == 1
        assert len(result2.created) == 0

    @pytest.mark.asyncio
    async def test_batch_validates_missing_image(self, batch_use_case):
        """Test validation error for missing image_path."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="",  # Empty - should fail
                size_key="30x30",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert result.errors[0]["index"] == 0
        assert "image_path" in result.errors[0]["errors"]

    @pytest.mark.asyncio
    async def test_batch_validates_invalid_size_key(self, batch_use_case):
        """Test validation error for invalid size_key."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/test.jpg",
                size_key="invalid-size",  # Invalid
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert "size_key" in result.errors[0]["errors"]

    @pytest.mark.asyncio
    async def test_batch_validates_invalid_hex(self, batch_use_case):
        """Test validation error for invalid hex format."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/test.jpg",
                hex_color="red",  # Invalid - should be #RRGGBB
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert "hex" in result.errors[0]["errors"]

    @pytest.mark.asyncio
    async def test_batch_validates_missing_texture(self, batch_use_case):
        """Test validation error for non-existent texture."""
        items = [
            VariantImageBatchItem(
                texture_id="nonexistent-tex",
                color_id="color-1",
                image_path="/images/test.jpg",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert "texture_id" in result.errors[0]["errors"]

    @pytest.mark.asyncio
    async def test_batch_validates_missing_color(self, batch_use_case):
        """Test validation error for non-existent color."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="nonexistent-color",
                image_path="/images/test.jpg",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert "color_id" in result.errors[0]["errors"]

    @pytest.mark.asyncio
    async def test_batch_rejects_nonexistent_design(self, batch_use_case, mock_design_repo):
        """Test that non-existent design raises error."""
        class EmptyDesignRepo:
            async def get_by_id(self, design_id):
                return None

        batch_use_case.design_repo = EmptyDesignRepo()

        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/test.jpg",
            ),
        ]

        with pytest.raises(DesignNotFoundError):
            await batch_use_case.execute(design_id="nonexistent", items=items)

    @pytest.mark.asyncio
    async def test_batch_partial_success(self, batch_use_case):
        """Test batch with mixed valid and invalid items."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/valid1.jpg",
            ),
            VariantImageBatchItem(
                texture_id="nonexistent",
                color_id="color-1",
                image_path="/images/invalid.jpg",
            ),
            VariantImageBatchItem(
                texture_id="tex-2",
                color_id="color-2",
                image_path="/images/valid2.jpg",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 1
        assert result.errors[0]["index"] == 1
        assert len(result.created) == 2

    @pytest.mark.asyncio
    async def test_batch_with_multiple_sizes(self, batch_use_case):
        """Test batch creation with different size keys."""
        items = [
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/small.jpg",
                size_key="30x30",
            ),
            VariantImageBatchItem(
                texture_id="tex-1",
                color_id="color-1",
                image_path="/images/large.jpg",
                size_key="60x60",
            ),
        ]

        result = await batch_use_case.execute(
            design_id="design-1",
            items=items,
        )

        assert len(result.errors) == 0
        assert len(result.created) == 2


class TestVariantImageEntity:
    """Tests for VariantImage entity with new size_key and hex fields."""

    def test_create_variant_with_size_key(self):
        """Test creating variant with size_key."""
        variant = VariantImage(
            design_id="d1",
            texture_id="t1",
            color_id="c1",
            image_path="/images/test.jpg",
            size_key="30x30",
        )
        assert variant.size_key == "30x30"
        assert variant.hex is None

    def test_create_variant_with_hex(self):
        """Test creating variant with hex color override."""
        variant = VariantImage(
            design_id="d1",
            texture_id="t1",
            color_id="c1",
            image_path="/images/test.jpg",
            hex="#FF5500",
        )
        assert variant.hex == "#FF5500"

    def test_create_variant_with_all_fields(self):
        """Test creating variant with all new fields."""
        variant = VariantImage(
            design_id="d1",
            texture_id="t1",
            color_id="c1",
            image_path="/images/test.jpg",
            size_key="60x60",
            hex="#00FF00",
        )
        assert variant.size_key == "60x60"
        assert variant.hex == "#00FF00"

    def test_invalid_size_key_raises(self):
        """Test that invalid size_key raises ValueError."""
        with pytest.raises(ValueError, match="size_key must be one of"):
            VariantImage(
                design_id="d1",
                texture_id="t1",
                color_id="c1",
                image_path="/images/test.jpg",
                size_key="invalid",
            )

    def test_invalid_hex_raises(self):
        """Test that invalid hex raises ValueError."""
        with pytest.raises(ValueError, match="hex must be #RRGGBB format"):
            VariantImage(
                design_id="d1",
                texture_id="t1",
                color_id="c1",
                image_path="/images/test.jpg",
                hex="red",  # Invalid
            )

    def test_valid_size_keys_constant(self):
        """Test that VALID_SIZE_KEYS contains expected values."""
        assert "30x30" in VALID_SIZE_KEYS
        assert "30x60" in VALID_SIZE_KEYS
        assert "60x60" in VALID_SIZE_KEYS
        assert len(VALID_SIZE_KEYS) == 3
