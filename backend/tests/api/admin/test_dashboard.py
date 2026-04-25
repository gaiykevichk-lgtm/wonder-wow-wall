"""Phase 3 — API integration for GET /api/admin/analytics/dashboard.

Covers the full chain (JWT → admin guard → router → use case → repo):
  * 401 when no token
  * 403 when token carries role=CUSTOMER
  * 422 when `days` is outside the Literal[7, 30, 90] whitelist
  * 200 with expected payload shape when admin promoted + data seeded

Shape assertions are deliberately shallow — the use-case tests already
cover metric/series semantics. This suite proves the wiring is correct.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    order_repo as _mem_order_repo,
    user_repo as _mem_user_repo,
)
from app.domain.order.entities import Order, OrderItem
from app.domain.order.value_objects import Address, OrderStatus
from app.main import app
from app.utils.cache import clear_cache


@pytest.fixture(autouse=True)
def _reset_cache_and_repos():
    # The snapshot endpoint memoises by (days,) for 60s; without this,
    # an earlier test's empty response would be served to later tests
    # even after seeding. Plus reset the order repo so the happy-path
    # assertion `revenue == 3000` is not polluted by orders seeded in
    # other test modules sharing the same module-level singletons.
    clear_cache()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0
    yield
    clear_cache()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(client: AsyncClient) -> tuple[str, str, str, str]:
    """Register a new customer. Returns (user_id, email, password, token)."""
    email = f"dash-{uuid.uuid4().hex[:8]}@test.com"
    password = "secret123"
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Dash IT",
            "email": email,
            "phone": "+7 999 000 00 00",
            "password": password,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return body["user"]["id"], email, password, body["token"]


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def _promote_and_relogin(client: AsyncClient) -> str:
    """Register → grant ADMIN → re-login so the JWT carries role=ADMIN."""
    user_id, email, password, _ = await _register(client)
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id
    )
    return await _login(client, email, password)


class TestDashboardGuard:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client):
        resp = await client.get("/api/admin/analytics/dashboard")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_token_returns_403(self, client):
        _id, _email, _pw, token = await _register(client)
        resp = await client.get(
            "/api/admin/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestDashboardValidation:
    @pytest.mark.asyncio
    async def test_invalid_days_returns_422(self, client):
        token = await _promote_and_relogin(client)
        resp = await client.get(
            "/api/admin/analytics/dashboard",
            params={"days": 500},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_days_returns_422(self, client):
        token = await _promote_and_relogin(client)
        resp = await client.get(
            "/api/admin/analytics/dashboard",
            params={"days": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_integer_days_returns_422(self, client):
        token = await _promote_and_relogin(client)
        resp = await client.get(
            "/api/admin/analytics/dashboard",
            params={"days": "abc"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


class TestDashboardHappyPath:
    @pytest.mark.asyncio
    async def test_admin_gets_full_payload(self, client):
        token = await _promote_and_relogin(client)

        # Seed a single DELIVERED order so revenue > 0 and orders_by_status
        # has a visible bucket. Repo is the same singleton the endpoint
        # reads through (InMemoryAnalyticsRepository wraps it with a lambda).
        now = datetime.utcnow()
        await _mem_order_repo.create(Order(
            id=f"o-{uuid.uuid4().hex[:8]}",
            number="WW-TEST-1",
            user_id="seed-user",
            status=OrderStatus.DELIVERED,
            items=[OrderItem(
                design_id="d-seed",
                design_name="Seed Design",
                unit_price=1500,
                quantity=2,
            )],
            address=Address(city="Москва", street="Пушкина", building="1"),
            created_at=now - timedelta(hours=1),  # inside the 7-day window
        ))

        resp = await client.get(
            "/api/admin/analytics/dashboard",
            params={"days": 7},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        # Top-level contract
        assert set(body.keys()) >= {
            "range_start", "range_end",
            "metrics", "revenue_series", "new_users_series",
            "orders_by_status", "top_designs",
        }

        # Metrics are present in the documented order and keys
        assert [m["key"] for m in body["metrics"]] == [
            "revenue", "orders", "new_users", "avg_order_value",
        ]
        revenue = next(m for m in body["metrics"] if m["key"] == "revenue")
        orders = next(m for m in body["metrics"] if m["key"] == "orders")
        # Repo cleared by `_reset_cache_and_repos` autouse fixture, so this
        # is the ONLY order in the window — exact equality is safe.
        assert revenue["value"] == 3000  # 1500 * 2
        assert orders["value"] == 1

        # Gap-filled series: 7 points for days=7
        assert len(body["revenue_series"]["points"]) == 7
        assert len(body["new_users_series"]["points"]) == 7

        # orders_by_status now contains DELIVERED (we seeded one)
        statuses = [b["status"] for b in body["orders_by_status"]]
        assert "delivered" in statuses

    @pytest.mark.asyncio
    async def test_default_days_is_30(self, client):
        token = await _promote_and_relogin(client)
        resp = await client.get(
            "/api/admin/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["revenue_series"]["points"]) == 30
