"""Phase 4A — `GET /api/admin/orders` integration tests.

Same wiring philosophy as `test_dashboard.py`: prove auth/guard/filter
parsing through the full ASGI stack, leave semantics to the use case
suite. The autouse fixture clears the in-memory order repo so each test
sees a clean slate (the repo is a module-level singleton in container.py).
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


@pytest.fixture(autouse=True)
def _reset_order_repo():
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0
    yield
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(client: AsyncClient) -> tuple[str, str, str, str]:
    email = f"admin-orders-{uuid.uuid4().hex[:8]}@test.com"
    password = "secret123"
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Orders IT",
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


async def _admin_token(client: AsyncClient) -> str:
    user_id, email, password, _ = await _register(client)
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id
    )
    return await _login(client, email, password)


def _seed(*, number: str, status: OrderStatus, days_ago: int = 1, user_id: str = "u-seed") -> None:
    _mem_order_repo._orders.append(Order(
        id=f"o-{uuid.uuid4().hex[:8]}",
        number=number,
        user_id=user_id,
        status=status,
        items=[OrderItem(design_id="d", design_name="Wall", unit_price=1500, quantity=2)],
        address=Address(city="Москва", street="Пушкина", building="1"),
        created_at=datetime.utcnow() - timedelta(days=days_ago),
    ))


class TestAuthGuard:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client):
        resp = await client.get("/api/admin/orders")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_token_returns_403(self, client):
        _, _, _, token = await _register(client)
        resp = await client.get(
            "/api/admin/orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestValidation:
    @pytest.mark.asyncio
    async def test_invalid_status_returns_422(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/orders",
            params={"status": "bogus"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_size_above_max_returns_422(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/orders",
            params={"size": 9999},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_inverted_date_window_returns_422(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/orders",
            params={"from": "2026-04-25T00:00:00", "to": "2026-04-24T00:00:00"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


class TestHappyPath:
    @pytest.mark.asyncio
    async def test_empty_repo_returns_empty_page(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["page"] == 1
        assert body["size"] == 50

    @pytest.mark.asyncio
    async def test_returns_seeded_order_with_canonical_shape(self, client):
        token = await _admin_token(client)
        _seed(number="WW-A", status=OrderStatus.DELIVERED)

        resp = await client.get(
            "/api/admin/orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 1
        item = body["items"][0]
        # Contract: every field documented in OrderListItemResponse is
        # present and typed as expected.
        assert set(item.keys()) == {
            "id", "number", "user_id", "status", "status_label",
            "total", "address", "created_at", "items_count",
        }
        assert item["number"] == "WW-A"
        assert item["status"] == "delivered"
        assert item["status_label"] == "Доставлен"
        assert item["total"] == 3000  # 1500 * 2
        assert item["items_count"] == 1

    @pytest.mark.asyncio
    async def test_status_filter_narrows(self, client):
        token = await _admin_token(client)
        _seed(number="WW-A", status=OrderStatus.PLACED)
        _seed(number="WW-B", status=OrderStatus.DELIVERED)

        resp = await client.get(
            "/api/admin/orders",
            params={"status": "placed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["number"] == "WW-A"

    @pytest.mark.asyncio
    async def test_status_filter_accepts_terminal_statuses(self, client):
        # Phase 4B regression: the list endpoint's `status` Literal must
        # include the new terminal states (`cancelled`, `refunded`),
        # otherwise the frontend's STATUS_OPTIONS dropdown sends a value
        # the backend rejects with 422 — and the admin can never list
        # cancelled/refunded orders by status.
        token = await _admin_token(client)
        _seed(number="WW-A", status=OrderStatus.PLACED)
        _seed(number="WW-X", status=OrderStatus.CANCELLED)
        _seed(number="WW-Y", status=OrderStatus.REFUNDED)

        for st, expected_number in (
            ("cancelled", "WW-X"),
            ("refunded", "WW-Y"),
        ):
            resp = await client.get(
                "/api/admin/orders",
                params={"status": st},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200, (st, resp.text)
            body = resp.json()
            assert body["total"] == 1, st
            assert body["items"][0]["number"] == expected_number, st

    @pytest.mark.asyncio
    async def test_pagination_metadata(self, client):
        token = await _admin_token(client)
        for i in range(5):
            _seed(number=f"WW-{i}", status=OrderStatus.PLACED, days_ago=i + 1)

        resp = await client.get(
            "/api/admin/orders",
            params={"page": 2, "size": 2},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 5
        assert body["page"] == 2
        assert body["size"] == 2
        assert len(body["items"]) == 2
