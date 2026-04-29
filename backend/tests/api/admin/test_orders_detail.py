"""Phase 4B — admin order detail / status / notes endpoint integration tests.

What we cover here that the use-case tests don't:
  * the global `InvalidOrderTransitionError → 409 + code: invalid_transition`
    handler registered in `app/main.py` actually fires.
  * the `Literal[...]` request-validation drops typos to 422 (not 500).
  * the detail response includes the resolved customer email/name (sidebar)
    and admin notes go through both add+read paths end-to-end.
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
def _reset_repos():
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
    email = f"admin-detail-{uuid.uuid4().hex[:8]}@test.com"
    password = "secret123"
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Detail IT",
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


async def _admin_token(client: AsyncClient) -> tuple[str, str]:
    user_id, email, password, _ = await _register(client)
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id
    )
    return user_id, await _login(client, email, password)


def _seed(*, number: str = "WW-1", status: OrderStatus = OrderStatus.PLACED, user_id: str | None = None) -> Order:
    order = Order(
        id=f"o-{uuid.uuid4().hex[:8]}",
        number=number,
        user_id=user_id or "u-seed",
        status=status,
        items=[OrderItem(design_id="d", design_name="Wall", unit_price=1500, quantity=2)],
        address=Address(city="Москва", street="Пушкина", building="1"),
        created_at=datetime.utcnow() - timedelta(days=1),
    )
    _mem_order_repo._orders.append(order)
    return order


# ─── GET /api/admin/orders/{id} ──────────────────────────────────────


class TestGetDetail:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client):
        resp = await client.get("/api/admin/orders/o-x")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_404_for_missing_order(self, client):
        _, token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/orders/ghost",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_full_detail_shape(self, client):
        admin_id, token = await _admin_token(client)
        order = _seed(number="WW-DETAIL", status=OrderStatus.CONFIRMED, user_id=admin_id)

        resp = await client.get(
            f"/api/admin/orders/{order.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == order.id
        assert body["number"] == "WW-DETAIL"
        assert body["status"] == "confirmed"
        assert body["status_label"] == "Подтверждён"
        assert body["total"] == 3000
        # Customer is resolved into the sidebar fields, including
        # phone (Phase 4A follow-up — primary contact channel for
        # moving an order forward).
        assert body["user_id"] == admin_id
        assert "@test.com" in body["user_email"]
        assert body["user_name"] == "Detail IT"
        assert body["user_phone"] == "+7 999 000 00 00"
        # Address renders both forms.
        assert body["address"].startswith("Москва")
        assert body["address_full"]["city"] == "Москва"
        # Items expanded with subtotal.
        assert len(body["items"]) == 1
        assert body["items"][0]["subtotal"] == 3000
        # Notes empty by default.
        assert body["notes"] == []
        assert body["cancel_reason"] is None


# ─── PATCH /api/admin/orders/{id}/status ─────────────────────────────


class TestUpdateStatus:
    @pytest.mark.asyncio
    async def test_legal_transition_returns_updated_detail(self, client):
        _, token = await _admin_token(client)
        order = _seed(status=OrderStatus.PLACED)

        resp = await client.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "confirmed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_illegal_transition_returns_409_with_code(self, client):
        """PLACED → DELIVERED must surface as the typed `invalid_transition`."""
        _, token = await _admin_token(client)
        order = _seed(status=OrderStatus.PLACED)

        resp = await client.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["code"] == "invalid_transition"
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_unknown_status_returns_422(self, client):
        _, token = await _admin_token(client)
        order = _seed(status=OrderStatus.PLACED)

        resp = await client.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "bogus"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_cancel_with_reason_persists(self, client):
        _, token = await _admin_token(client)
        order = _seed(status=OrderStatus.CONFIRMED)

        resp = await client.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "cancelled", "reason": "Дубликат"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "cancelled"
        assert body["cancel_reason"] == "Дубликат"

    @pytest.mark.asyncio
    async def test_cancel_without_reason_returns_422(self, client):
        """Missing-reason on cancel = caller-input bug → 422 (not 409).

        409 is reserved for "transition forbidden by current status";
        missing reason is a body-validation problem and shouldn't be
        confused with a workflow error in the UI's error toast.
        """
        _, token = await _admin_token(client)
        order = _seed(status=OrderStatus.CONFIRMED)

        resp = await client.patch(
            f"/api/admin/orders/{order.id}/status",
            json={"status": "cancelled"},  # missing reason
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_404_for_missing_order(self, client):
        _, token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/orders/ghost/status",
            json={"status": "confirmed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ─── POST /api/admin/orders/{id}/notes ───────────────────────────────


class TestAddNote:
    @pytest.mark.asyncio
    async def test_add_note_returns_201_with_author_name(self, client):
        admin_id, token = await _admin_token(client)
        order = _seed()

        resp = await client.post(
            f"/api/admin/orders/{order.id}/notes",
            json={"text": "Позвонил клиенту"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        note = resp.json()
        assert note["text"] == "Позвонил клиенту"
        assert note["author_id"] == admin_id
        assert note["author_name"] == "Detail IT"

    @pytest.mark.asyncio
    async def test_added_note_visible_on_detail(self, client):
        _, token = await _admin_token(client)
        order = _seed()

        await client.post(
            f"/api/admin/orders/{order.id}/notes",
            json={"text": "First"},
            headers={"Authorization": f"Bearer {token}"},
        )
        await client.post(
            f"/api/admin/orders/{order.id}/notes",
            json={"text": "Second"},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = await client.get(
            f"/api/admin/orders/{order.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        notes = resp.json()["notes"]
        assert [n["text"] for n in notes] == ["First", "Second"]

    @pytest.mark.asyncio
    async def test_empty_text_returns_422(self, client):
        _, token = await _admin_token(client)
        order = _seed()

        resp = await client.post(
            f"/api/admin/orders/{order.id}/notes",
            json={"text": ""},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_404_for_missing_order(self, client):
        _, token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/orders/ghost/notes",
            json={"text": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
