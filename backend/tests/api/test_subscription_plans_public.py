"""Phase 8C — public `GET /api/subscription-plans` integration tests.

Hard-checks:
  * inactive plans hidden from public,
  * Cache-Control header pinned at 5 min,
  * payload shape pinned (no admin metadata leakage).
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_subscription_plan_repo
from app.domain.subscription.entities import SubscriptionPlan
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    saved = list(_mem_subscription_plan_repo._plans)
    yield
    _mem_subscription_plan_repo._plans.clear()
    _mem_subscription_plan_repo._plans.extend(saved)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestPublicListing:
    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        resp = await client.get("/api/subscription-plans")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_seed_plans(self, client):
        resp = await client.get("/api/subscription-plans")
        ids = {p["id"] for p in resp.json()["items"]}
        assert {"starter", "popular", "business"}.issubset(ids)

    @pytest.mark.asyncio
    async def test_inactive_hidden(self, client):
        # Add an extra retired plan; public listing must skip it.
        _mem_subscription_plan_repo._plans.append(
            SubscriptionPlan(
                id="retired", name="Retired", price=0,
                is_active=False, sort_order=99,
            ),
        )
        resp = await client.get("/api/subscription-plans")
        ids = {p["id"] for p in resp.json()["items"]}
        assert "retired" not in ids

    @pytest.mark.asyncio
    async def test_cache_control_set(self, client):
        resp = await client.get("/api/subscription-plans")
        assert resp.headers.get("cache-control") == "public, max-age=300"

    @pytest.mark.asyncio
    async def test_payload_shape(self, client):
        resp = await client.get("/api/subscription-plans")
        item = resp.json()["items"][0]
        # Public DTO omits admin-only fields.
        assert set(item.keys()) == {
            "id", "name", "price", "period",
            "area_limit_m2", "popular", "features",
        }
