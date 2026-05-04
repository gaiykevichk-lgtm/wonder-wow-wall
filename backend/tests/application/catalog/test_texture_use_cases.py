import pytest

from app.application.catalog.texture_use_cases import (
    CreateTextureAdmin,
    CreateTextureColorAdmin,
    DeleteTextureAdmin,
    DeleteTextureColorAdmin,
    ListTextureColorsAdmin,
    ListTextureColorsPublic,
    ListTexturesAdmin,
    ListTexturesPublic,
    UpdateTextureAdmin,
    UpdateTextureColorAdmin,
)
from app.application.catalog.variant_image_use_cases import (
    CreateVariantImageAdmin,
    DeleteVariantImageAdmin,
    GetVariantImage,
    ListVariantImagesByDesign,
    ListVariantImagesAdmin,
)
from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.texture_exceptions import (
    TextureColorNotFoundError,
    TextureHasVariantsError,
    TextureNotFoundError,
    TextureSlugConflictError,
    VariantImageCombinationConflictError,
    VariantImageNotFoundError,
)
from app.domain.catalog.catalog_exceptions import DesignNotFoundError
from app.domain.catalog.variant_image import VariantImage
from app.infrastructure.persistence.repositories.memory import (
    InMemoryDesignRepository,
    InMemoryTextureColorRepository,
    InMemoryTextureRepository,
    InMemoryVariantImageRepository,
)
from app.domain.catalog.entities import Design


@pytest.fixture
def texture_repo():
    return InMemoryTextureRepository()


@pytest.fixture
def color_repo():
    return InMemoryTextureColorRepository()


@pytest.fixture
def variant_repo():
    return InMemoryVariantImageRepository()


@pytest.fixture
def design_repo():
    return InMemoryDesignRepository([
        Design(id="d1", name="Wave", slug="wave", category_id="c1", price=100),
    ])


# ─── Texture CRUD ───────────────────────────────────────────────────


class TestCreateTexture:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="Concrete", slug="concrete",
        )
        assert t.name == "Concrete"
        assert t.slug == "concrete"
        assert t.is_active is True
        assert t.id

    @pytest.mark.asyncio
    async def test_slug_conflict(self, texture_repo):
        await CreateTextureAdmin(texture_repo).execute(
            name="Concrete", slug="concrete",
        )
        with pytest.raises(TextureSlugConflictError):
            await CreateTextureAdmin(texture_repo).execute(
                name="Concrete 2", slug="concrete",
            )

    @pytest.mark.asyncio
    async def test_empty_name_rejected(self, texture_repo):
        with pytest.raises(ValueError, match="name"):
            await CreateTextureAdmin(texture_repo).execute(name="", slug="x")

    @pytest.mark.asyncio
    async def test_empty_slug_rejected(self, texture_repo):
        with pytest.raises(ValueError, match="slug"):
            await CreateTextureAdmin(texture_repo).execute(name="X", slug="")


class TestUpdateTexture:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="Old", slug="old",
        )
        updated = await UpdateTextureAdmin(texture_repo).execute(
            t.id, name="New", slug="new",
        )
        assert updated.name == "New"
        assert updated.slug == "new"

    @pytest.mark.asyncio
    async def test_not_found(self, texture_repo):
        with pytest.raises(TextureNotFoundError):
            await UpdateTextureAdmin(texture_repo).execute("nope", name="X")

    @pytest.mark.asyncio
    async def test_slug_conflict_on_update(self, texture_repo):
        await CreateTextureAdmin(texture_repo).execute(name="A", slug="a")
        b = await CreateTextureAdmin(texture_repo).execute(name="B", slug="b")
        with pytest.raises(TextureSlugConflictError):
            await UpdateTextureAdmin(texture_repo).execute(b.id, slug="a")


class TestDeleteTexture:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="X", slug="x",
        )
        result = await DeleteTextureAdmin(texture_repo, variant_repo).execute(t.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_not_found(self, texture_repo, variant_repo):
        with pytest.raises(TextureNotFoundError):
            await DeleteTextureAdmin(texture_repo, variant_repo).execute("nope")

    @pytest.mark.asyncio
    async def test_has_variants_blocked(self, texture_repo, variant_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = TextureColor(texture_id=t.id, name="Gray", hex="#888888")
        await color_repo.create(c)
        vi = VariantImage(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        await variant_repo.create(vi)
        with pytest.raises(TextureHasVariantsError):
            await DeleteTextureAdmin(texture_repo, variant_repo).execute(t.id)


class TestListTextures:
    @pytest.mark.asyncio
    async def test_public_hides_inactive(self, texture_repo):
        await CreateTextureAdmin(texture_repo).execute(
            name="A", slug="a", is_active=True,
        )
        await CreateTextureAdmin(texture_repo).execute(
            name="B", slug="b", is_active=False,
        )
        public = await ListTexturesPublic(texture_repo).execute()
        assert len(public) == 1
        assert public[0].name == "A"

    @pytest.mark.asyncio
    async def test_admin_shows_all(self, texture_repo):
        await CreateTextureAdmin(texture_repo).execute(
            name="A", slug="a", is_active=True,
        )
        await CreateTextureAdmin(texture_repo).execute(
            name="B", slug="b", is_active=False,
        )
        admin = await ListTexturesAdmin(texture_repo).execute()
        assert len(admin) == 2


# ─── TextureColor CRUD ──────────────────────────────────────────────


class TestCreateTextureColor:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="Concrete", slug="concrete",
        )
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Gray", hex="#888888",
        )
        assert c.texture_id == t.id
        assert c.name == "Gray"
        assert c.hex == "#888888"

    @pytest.mark.asyncio
    async def test_texture_not_found(self, texture_repo, color_repo):
        with pytest.raises(TextureNotFoundError):
            await CreateTextureColorAdmin(color_repo, texture_repo).execute(
                texture_id="nope", name="Gray",
            )

    @pytest.mark.asyncio
    async def test_empty_name_rejected(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="Concrete", slug="concrete",
        )
        with pytest.raises(ValueError, match="name"):
            await CreateTextureColorAdmin(color_repo, texture_repo).execute(
                texture_id=t.id, name="",
            )


class TestUpdateTextureColor:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="X", slug="x",
        )
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Old", hex="#000000",
        )
        updated = await UpdateTextureColorAdmin(color_repo).execute(
            c.id, name="New", hex="#FFFFFF",
        )
        assert updated.name == "New"
        assert updated.hex == "#FFFFFF"

    @pytest.mark.asyncio
    async def test_not_found(self, color_repo):
        with pytest.raises(TextureColorNotFoundError):
            await UpdateTextureColorAdmin(color_repo).execute("nope", name="X")


class TestDeleteTextureColor:
    @pytest.mark.asyncio
    async def test_happy(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="X", slug="x",
        )
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Gray",
        )
        result = await DeleteTextureColorAdmin(color_repo).execute(c.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_not_found(self, color_repo):
        with pytest.raises(TextureColorNotFoundError):
            await DeleteTextureColorAdmin(color_repo).execute("nope")


class TestListTextureColors:
    @pytest.mark.asyncio
    async def test_public_hides_inactive(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="X", slug="x",
        )
        await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="A", is_active=True,
        )
        await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="B", is_active=False,
        )
        public = await ListTextureColorsPublic(color_repo).execute(t.id)
        assert len(public) == 1

    @pytest.mark.asyncio
    async def test_admin_shows_all(self, texture_repo, color_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="X", slug="x",
        )
        await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="A", is_active=True,
        )
        await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="B", is_active=False,
        )
        admin = await ListTextureColorsAdmin(color_repo).execute(t.id)
        assert len(admin) == 2


# ─── Variant Image ──────────────────────────────────────────────────


class TestCreateVariantImage:
    @pytest.mark.asyncio
    async def test_happy(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(
            name="Concrete", slug="concrete",
        )
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Gray", hex="#888888",
        )
        vi = await CreateVariantImageAdmin(
            variant_repo, design_repo, texture_repo, color_repo,
        ).execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        assert vi.design_id == "d1"
        assert vi.image_path == "/img.jpg"

    @pytest.mark.asyncio
    async def test_design_not_found(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        with pytest.raises(DesignNotFoundError):
            await CreateVariantImageAdmin(
                variant_repo, design_repo, texture_repo, color_repo,
            ).execute(
                design_id="no-such", texture_id=t.id, color_id=c.id,
                image_path="/img.jpg",
            )

    @pytest.mark.asyncio
    async def test_combination_conflict(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        uc = CreateVariantImageAdmin(variant_repo, design_repo, texture_repo, color_repo)
        await uc.execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        with pytest.raises(VariantImageCombinationConflictError):
            await uc.execute(
                design_id="d1", texture_id=t.id, color_id=c.id,
                image_path="/img2.jpg",
            )

    @pytest.mark.asyncio
    async def test_empty_path_rejected(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        with pytest.raises(ValueError, match="image_path"):
            await CreateVariantImageAdmin(
                variant_repo, design_repo, texture_repo, color_repo,
            ).execute(
                design_id="d1", texture_id=t.id, color_id=c.id,
                image_path="",
            )


class TestGetVariantImage:
    @pytest.mark.asyncio
    async def test_found(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        await CreateVariantImageAdmin(
            variant_repo, design_repo, texture_repo, color_repo,
        ).execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        vi = await GetVariantImage(variant_repo).execute("d1", t.id, c.id)
        assert vi is not None
        assert vi.image_path == "/img.jpg"

    @pytest.mark.asyncio
    async def test_not_found(self, variant_repo):
        vi = await GetVariantImage(variant_repo).execute("x", "y", "z")
        assert vi is None


class TestDeleteVariantImage:
    @pytest.mark.asyncio
    async def test_happy(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        vi = await CreateVariantImageAdmin(
            variant_repo, design_repo, texture_repo, color_repo,
        ).execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        result = await DeleteVariantImageAdmin(variant_repo).execute(vi.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_not_found(self, variant_repo):
        with pytest.raises(VariantImageNotFoundError):
            await DeleteVariantImageAdmin(variant_repo).execute("nope")


class TestListVariantImages:
    @pytest.mark.asyncio
    async def test_by_design(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        await CreateVariantImageAdmin(
            variant_repo, design_repo, texture_repo, color_repo,
        ).execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        items = await ListVariantImagesByDesign(variant_repo).execute("d1")
        assert len(items) == 1

    @pytest.mark.asyncio
    async def test_admin_filter_by_texture(self, design_repo, texture_repo, color_repo, variant_repo):
        t = await CreateTextureAdmin(texture_repo).execute(name="X", slug="x")
        c = await CreateTextureColorAdmin(color_repo, texture_repo).execute(
            texture_id=t.id, name="Y",
        )
        await CreateVariantImageAdmin(
            variant_repo, design_repo, texture_repo, color_repo,
        ).execute(
            design_id="d1", texture_id=t.id, color_id=c.id,
            image_path="/img.jpg",
        )
        items = await ListVariantImagesAdmin(variant_repo).execute(texture_id=t.id)
        assert len(items) == 1

    @pytest.mark.asyncio
    async def test_admin_no_filter_empty(self, variant_repo):
        items = await ListVariantImagesAdmin(variant_repo).execute()
        assert items == []
