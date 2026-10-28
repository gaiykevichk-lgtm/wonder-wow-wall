"""Phase 7B — public `GET /api/panels` integration test.

Hard-checks that the public listing cannot be coerced into leaking
inactive SKUs (no `include_inactive` query param accepted; the use case
hard-codes `False`).
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_panel_repo
from app.domain.catalog.panel import Panel
from app.domain.catalog.value_objects import PanelSize
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    _mem_panel_repo._panels.clear()
    yield
    _mem_panel_repo._panels.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _seed(slug: str, *, is_active: bool) -> Panel:
    p = Panel(
        name=f"P-{slug}",
        slug=slug,
        size=PanelSize(300, 300, "30×30 см"),
        base_price=890,
        is_active=is_active,
    )
    _mem_panel_repo._panels.append(p)
    return p


class TestPublicListing:
    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        # Public endpoint — no Authorization header.
        _seed("a", is_active=True)
        resp = await client.get("/api/panels")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_inactive_hidden(self, client):
        _seed("active", is_active=True)
        _seed("hidden", is_active=False)
        resp = await client.get("/api/panels")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "active"

    @pytest.mark.asyncio
    async def test_include_inactive_query_string_ignored(self, client):
        # Defence-in-depth: even if a client tries the param, the active
        # filter is hard-coded in `ListPanelsPublic` so the response is
        # unchanged.
        _seed("active", is_active=True)
        _seed("hidden", is_active=False)
        resp = await client.get("/api/panels?include_inactive=true")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "active"

    @pytest.mark.asyncio
    async def test_payload_shape(self, client):
        _seed("shape", is_active=True)
        resp = await client.get("/api/panels")
        item = resp.json()["items"][0]
        # Pin the field set so a future addition is a deliberate API
        # change, not an accident.
        assert set(item.keys()) == {
            "id", "name", "slug", "width_mm", "height_mm",
            "size_label", "base_price", "description", "photo_path",
            "is_active",
        }
