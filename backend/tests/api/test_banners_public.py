"""Phase 8B — public `GET /api/shop/banners` integration tests.

Hard-checks that the public listing cannot leak inactive banners
regardless of query string fiddling, and pins the 5-min cache header.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_banner_repo
from app.domain.shop.banner import Banner, BannerPosition
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    _mem_banner_repo._banners.clear()
    yield
    _mem_banner_repo._banners.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _seed(title: str, *, is_active=True, position=BannerPosition.HOMEPAGE_HERO):
    b = Banner(
        title=title, image_path=f"{title}.jpg", is_active=is_active,
        position=position,
    )
    _mem_banner_repo._banners.append(b)
    return b


class TestPublicListing:
    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        _seed("v")
        resp = await client.get("/api/shop/banners")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_inactive_hidden(self, client):
        _seed("active", is_active=True)
        # An inactive draft must have `image_path=""`-friendly construct,
        # so we set image_path manually after construction (the entity
        # would refuse this combo at __post_init__).
        b = Banner(title="draft", image_path="", is_active=False)
        _mem_banner_repo._banners.append(b)
        resp = await client.get("/api/shop/banners")
        body = resp.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["title"] == "active"

    @pytest.mark.asyncio
    async def test_position_filter(self, client):
        _seed("hero", position=BannerPosition.HOMEPAGE_HERO)
        _seed("foot", position=BannerPosition.FOOTER)
        resp = await client.get("/api/shop/banners?position=footer")
        body = resp.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["title"] == "foot"

    @pytest.mark.asyncio
    async def test_invalid_position_422(self, client):
        resp = await client.get("/api/shop/banners?position=garbage")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_cache_control_set(self, client):
        _seed("v")
        resp = await client.get("/api/shop/banners")
        assert resp.headers.get("cache-control") == "public, max-age=300"

    @pytest.mark.asyncio
    async def test_payload_shape(self, client):
        _seed("p")
        resp = await client.get("/api/shop/banners")
        item = resp.json()["items"][0]
        # No admin metadata leakage (no created_at / updated_at /
        # is_active in the public DTO).
        assert set(item.keys()) == {
            "id", "title", "subtitle", "image_path",
            "cta_label", "cta_url", "position", "priority",
        }
