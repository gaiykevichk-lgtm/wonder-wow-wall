"""Phase 8A — `/api/shop/settings` public endpoint tests.

No auth required. Confirms the response shape stays stable for the
frontend's TanStack Query consumer and matches the admin endpoint's
field set (so a single TypeScript type can be shared on the frontend).
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_shop_settings_repo
from app.domain.shop.settings import ShopSettings
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_shop_settings_repo._settings = ShopSettings()
    yield
    _mem_shop_settings_repo._settings = ShopSettings()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestPublicShopSettings:
    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        # Public endpoint — must work without a token.
        resp = await client.get("/api/shop/settings")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_payload_shape_pin(self, client):
        # Shape is consumed by the frontend; pin the field set so a
        # silent rename here doesn't produce a runtime null on the page.
        resp = await client.get("/api/shop/settings")
        body = resp.json()
        assert set(body.keys()) == {
            "id",
            "design_overlay_price",
            "installation_price",
            "min_order_amount",
            "recommendations_limit_per_source",
            "updated_at",
        }
        # Phase 10 — default cap surfaces on the public read so the
        # frontend can size pagination without hitting the admin endpoint.
        assert body["recommendations_limit_per_source"] == 12

    @pytest.mark.asyncio
    async def test_reflects_admin_patch(self, client):
        # Mutate via the in-memory repo (simulating an admin patch) and
        # confirm the public endpoint reads from the same singleton.
        _mem_shop_settings_repo._settings = ShopSettings(
            design_overlay_price=2500, installation_price=999,
        )
        resp = await client.get("/api/shop/settings")
        assert resp.json()["design_overlay_price"] == 2500
        assert resp.json()["installation_price"] == 999
