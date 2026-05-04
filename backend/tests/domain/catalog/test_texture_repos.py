"""Phase 12 — unit tests for in-memory Texture/TextureColor/VariantImage repositories."""
import pytest

from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.variant_image import VariantImage
from app.infrastructure.persistence.repositories.memory import (
    InMemoryTextureRepository,
    InMemoryTextureColorRepository,
    InMemoryVariantImageRepository,
)


class TestInMemoryTextureRepository:
    @pytest.fixture
    def repo(self):
        return InMemoryTextureRepository()

    @pytest.mark.asyncio
    async def test_create_and_get_by_id(self, repo):
        t = Texture(name="Бетон", slug="concrete")
        created = await repo.create(t)
        assert created.id == t.id
        found = await repo.get_by_id(t.id)
        assert found is not None
        assert found.name == "Бетон"

    @pytest.mark.asyncio
    async def test_get_by_slug(self, repo):
        t = Texture(name="Дерево", slug="wood")
        await repo.create(t)
        found = await repo.get_by_slug("wood")
        assert found is not None
        assert found.name == "Дерево"

    @pytest.mark.asyncio
    async def test_slug_collision_raises(self, repo):
        await repo.create(Texture(name="A", slug="same"))
        with pytest.raises(ValueError, match="slug collision"):
            await repo.create(Texture(name="B", slug="same"))

    @pytest.mark.asyncio
    async def test_list_all_filters_inactive(self, repo):
        await repo.create(Texture(name="Active", slug="active", is_active=True))
        await repo.create(Texture(name="Hidden", slug="hidden", is_active=False))
        active = await repo.list_all(include_inactive=False)
        assert len(active) == 1
        assert active[0].slug == "active"
        all_items = await repo.list_all(include_inactive=True)
        assert len(all_items) == 2

    @pytest.mark.asyncio
    async def test_list_all_sorted_by_sort_order(self, repo):
        await repo.create(Texture(name="B", slug="b", sort_order=2))
        await repo.create(Texture(name="A", slug="a", sort_order=1))
        items = await repo.list_all()
        assert items[0].slug == "a"
        assert items[1].slug == "b"

    @pytest.mark.asyncio
    async def test_update(self, repo):
        t = Texture(name="Old", slug="marble")
        await repo.create(t)
        t.name = "New"
        updated = await repo.update(t)
        assert updated.name == "New"

    @pytest.mark.asyncio
    async def test_delete(self, repo):
        t = Texture(name="Del", slug="del")
        await repo.create(t)
        assert await repo.delete(t.id) is True
        assert await repo.get_by_id(t.id) is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self, repo):
        assert await repo.delete("no-such-id") is False


class TestInMemoryTextureColorRepository:
    @pytest.fixture
    def repo(self):
        return InMemoryTextureColorRepository()

    @pytest.mark.asyncio
    async def test_create_and_list_by_texture(self, repo):
        c1 = TextureColor(texture_id="t1", name="Grey", hex="#888888")
        c2 = TextureColor(texture_id="t1", name="White", hex="#FFFFFF")
        c3 = TextureColor(texture_id="t2", name="Oak", hex="#A0522D")
        await repo.create(c1)
        await repo.create(c2)
        await repo.create(c3)
        t1_colors = await repo.list_by_texture("t1")
        assert len(t1_colors) == 2

    @pytest.mark.asyncio
    async def test_list_by_texture_filters_inactive(self, repo):
        await repo.create(TextureColor(texture_id="t1", name="A", hex="#000000", is_active=True))
        await repo.create(TextureColor(texture_id="t1", name="B", hex="#111111", is_active=False))
        active = await repo.list_by_texture("t1", include_inactive=False)
        assert len(active) == 1
        all_items = await repo.list_by_texture("t1", include_inactive=True)
        assert len(all_items) == 2

    @pytest.mark.asyncio
    async def test_update(self, repo):
        c = TextureColor(texture_id="t1", name="Old", hex="#000000")
        await repo.create(c)
        c.name = "New"
        updated = await repo.update(c)
        assert updated.name == "New"

    @pytest.mark.asyncio
    async def test_delete(self, repo):
        c = TextureColor(texture_id="t1", name="Del", hex="#AAAAAA")
        await repo.create(c)
        assert await repo.delete(c.id) is True
        assert await repo.get_by_id(c.id) is None


class TestInMemoryVariantImageRepository:
    @pytest.fixture
    def repo(self):
        return InMemoryVariantImageRepository()

    @pytest.mark.asyncio
    async def test_create_and_get_by_combination(self, repo):
        v = VariantImage(
            design_id="d1", texture_id="t1", color_id="c1",
            image_path="img.jpg",
        )
        await repo.create(v)
        found = await repo.get_by_combination("d1", "t1", "c1")
        assert found is not None
        assert found.image_path == "img.jpg"

    @pytest.mark.asyncio
    async def test_combination_collision_raises(self, repo):
        v1 = VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="a.jpg")
        await repo.create(v1)
        v2 = VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="b.jpg")
        with pytest.raises(ValueError, match="combination collision"):
            await repo.create(v2)

    @pytest.mark.asyncio
    async def test_different_combinations_allowed(self, repo):
        v1 = VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="a.jpg")
        v2 = VariantImage(design_id="d1", texture_id="t1", color_id="c2", image_path="b.jpg")
        await repo.create(v1)
        await repo.create(v2)
        assert await repo.get_by_combination("d1", "t1", "c1") is not None
        assert await repo.get_by_combination("d1", "t1", "c2") is not None

    @pytest.mark.asyncio
    async def test_list_by_design(self, repo):
        await repo.create(VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="1.jpg"))
        await repo.create(VariantImage(design_id="d1", texture_id="t2", color_id="c2", image_path="2.jpg"))
        await repo.create(VariantImage(design_id="d2", texture_id="t1", color_id="c1", image_path="3.jpg"))
        result = await repo.list_by_design("d1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_by_texture(self, repo):
        await repo.create(VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="1.jpg"))
        await repo.create(VariantImage(design_id="d2", texture_id="t1", color_id="c2", image_path="2.jpg"))
        await repo.create(VariantImage(design_id="d1", texture_id="t2", color_id="c1", image_path="3.jpg"))
        result = await repo.list_by_texture("t1")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_delete(self, repo):
        v = VariantImage(design_id="d1", texture_id="t1", color_id="c1", image_path="x.jpg")
        await repo.create(v)
        assert await repo.delete(v.id) is True
        assert await repo.get_by_combination("d1", "t1", "c1") is None

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_none(self, repo):
        result = await repo.get_by_combination("none", "none", "none")
        assert result is None
