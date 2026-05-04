import pytest
from httpx import ASGITransport, AsyncClient

from app.container import (
    _mem_design_repo,
    _mem_texture_repo,
    _mem_texture_color_repo,
    _mem_variant_image_repo,
)
from app.domain.catalog.entities import Design
from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.variant_image import VariantImage
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_texture_repo._textures.clear()
    _mem_texture_color_repo._colors.clear()
    _mem_variant_image_repo._variants.clear()
    old_designs = _mem_design_repo._designs[:]
    yield
    _mem_texture_repo._textures.clear()
    _mem_texture_color_repo._colors.clear()
    _mem_variant_image_repo._variants.clear()
    _mem_design_repo._designs[:] = old_designs


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _seed_texture(slug="concrete", name="Concrete", active=True):
    t = Texture(name=name, slug=slug, swatch_image="/swatch.jpg", is_active=active)
    _mem_texture_repo._textures.append(t)
    return t


def _seed_color(texture_id, name="Gray", hex="#888888", active=True):
    c = TextureColor(
        texture_id=texture_id, name=name, hex=hex,
        swatch_image="/color.jpg", is_active=active,
    )
    _mem_texture_color_repo._colors.append(c)
    return c


def _seed_variant(design_id, texture_id, color_id, path="/img.jpg"):
    vi = VariantImage(
        design_id=design_id, texture_id=texture_id,
        color_id=color_id, image_path=path,
    )
    _mem_variant_image_repo._variants.append(vi)
    return vi


def _ensure_design(design_id="d-pub", slug="wave", name="Wave"):
    existing = [d for d in _mem_design_repo._designs if d.id == design_id]
    if existing:
        return existing[0]
    d = Design(
        id=design_id, name=name, slug=slug,
        category_id="cat1", price=100, is_published=True,
        preview_image="/preview.png",
    )
    _mem_design_repo._designs.append(d)
    return d


# ─── GET /api/textures ──────────────────────────────────────────────


class TestListTexturesPublic:
    @pytest.mark.asyncio
    async def test_returns_active_only(self, client):
        _seed_texture("concrete", "Concrete", active=True)
        _seed_texture("wood", "Wood", active=False)
        resp = await client.get("/api/textures")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["slug"] == "concrete"

    @pytest.mark.asyncio
    async def test_includes_active_colors(self, client):
        t = _seed_texture()
        _seed_color(t.id, "Gray", "#888888", active=True)
        _seed_color(t.id, "Hidden", "#000000", active=False)
        resp = await client.get("/api/textures")
        assert resp.status_code == 200
        colors = resp.json()[0]["colors"]
        assert len(colors) == 1
        assert colors[0]["name"] == "Gray"

    @pytest.mark.asyncio
    async def test_empty_list(self, client):
        resp = await client.get("/api/textures")
        assert resp.status_code == 200
        assert resp.json() == []


# ─── GET /api/textures/{id}/colors ──────────────────────────────────


class TestListTextureColorsPublic:
    @pytest.mark.asyncio
    async def test_returns_active_colors(self, client):
        t = _seed_texture()
        _seed_color(t.id, "A", "#111111", active=True)
        _seed_color(t.id, "B", "#222222", active=False)
        resp = await client.get(f"/api/textures/{t.id}/colors")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "A"


# ─── GET /api/designs/{id}/textures ─────────────────────────────────


class TestListDesignTextures:
    @pytest.mark.asyncio
    async def test_returns_textures_with_variants(self, client):
        d = _ensure_design()
        t1 = _seed_texture("concrete", "Concrete")
        t2 = _seed_texture("wood", "Wood")
        c1 = _seed_color(t1.id, "Gray")
        _seed_color(t2.id, "Oak")
        _seed_variant(d.id, t1.id, c1.id)
        resp = await client.get(f"/api/designs/{d.id}/textures")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["slug"] == "concrete"

    @pytest.mark.asyncio
    async def test_unpublished_design_404(self, client):
        d = Design(
            id="d-unpub", name="Hidden", slug="hidden",
            category_id="c1", price=100, is_published=False,
        )
        _mem_design_repo._designs.append(d)
        resp = await client.get(f"/api/designs/{d.id}/textures")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_missing_design_404(self, client):
        resp = await client.get("/api/designs/no-such/textures")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_texture_without_colors_excluded(self, client):
        d = _ensure_design()
        t = _seed_texture()
        _seed_variant(d.id, t.id, "fake-color")
        resp = await client.get(f"/api/designs/{d.id}/textures")
        assert resp.status_code == 200
        assert resp.json() == []


# ─── GET /api/designs/{id}/variant-image ────────────────────────────


class TestGetVariantImage:
    @pytest.mark.asyncio
    async def test_found(self, client):
        d = _ensure_design()
        t = _seed_texture()
        c = _seed_color(t.id)
        _seed_variant(d.id, t.id, c.id, "/wave-concrete-gray.jpg")
        resp = await client.get(
            f"/api/designs/{d.id}/variant-image",
            params={"texture_id": t.id, "color_id": c.id},
        )
        assert resp.status_code == 200
        assert resp.json()["image_path"] == "/wave-concrete-gray.jpg"

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        d = _ensure_design()
        resp = await client.get(
            f"/api/designs/{d.id}/variant-image",
            params={"texture_id": "x", "color_id": "y"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_missing_params_422(self, client):
        resp = await client.get("/api/designs/d1/variant-image")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unpublished_design_404(self, client):
        d = Design(
            id="d-unpub-vi", name="Hidden", slug="hidden-vi",
            category_id="c1", price=100, is_published=False,
        )
        _mem_design_repo._designs.append(d)
        t = _seed_texture()
        c = _seed_color(t.id)
        _seed_variant(d.id, t.id, c.id)
        resp = await client.get(
            f"/api/designs/{d.id}/variant-image",
            params={"texture_id": t.id, "color_id": c.id},
        )
        assert resp.status_code == 404


# ─── GET /api/designs/{id}/full-config ──────────────────────────────


class TestFullConfig:
    @pytest.mark.asyncio
    async def test_happy(self, client):
        d = _ensure_design()
        t = _seed_texture()
        c = _seed_color(t.id, "Gray", "#888888")
        _seed_variant(d.id, t.id, c.id, "/img.jpg")
        resp = await client.get(f"/api/designs/{d.id}/full-config")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == d.id
        assert body["name"] == d.name
        assert body["preview_image"] == "/preview.png"
        assert len(body["textures"]) == 1
        assert len(body["textures"][0]["colors"]) == 1
        assert len(body["variant_images"]) == 1
        assert body["variant_images"][0]["image_path"] == "/img.jpg"

    @pytest.mark.asyncio
    async def test_unpublished_404(self, client):
        d = Design(
            id="d-hidden", name="Hidden", slug="hidden2",
            category_id="c1", price=100, is_published=False,
        )
        _mem_design_repo._designs.append(d)
        resp = await client.get(f"/api/designs/{d.id}/full-config")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_no_textures_empty(self, client):
        d = _ensure_design()
        resp = await client.get(f"/api/designs/{d.id}/full-config")
        assert resp.status_code == 200
        body = resp.json()
        assert body["textures"] == []
        assert body["variant_images"] == []


# ─── GET /api/designs — preview_image field ─────────────────────────


class TestDesignListPreviewImage:
    @pytest.mark.asyncio
    async def test_includes_preview_image(self, client):
        d = _ensure_design()
        resp = await client.get("/api/designs")
        assert resp.status_code == 200
        items = resp.json()["items"]
        match = [i for i in items if i["id"] == d.id]
        assert len(match) == 1
        assert match[0]["preview_image"] == "/preview.png"

    @pytest.mark.asyncio
    async def test_detail_includes_preview_image(self, client):
        d = _ensure_design()
        resp = await client.get(f"/api/designs/{d.id}")
        assert resp.status_code == 200
        assert resp.json()["preview_image"] == "/preview.png"
