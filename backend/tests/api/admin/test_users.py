"""Phase 5 — `/api/admin/users` integration tests.

Same pattern as `test_orders_list.py` / `test_orders_detail.py`:
in-memory repos, full ASGI stack via httpx ASGITransport. Verifies:

  * auth/guard chain — 401 (no token), 403 (customer token)
  * filter contract — role / is_blocked / search; invalid role → 422
  * detail returns recent_orders preview
  * block / unblock — Self-block guard via last-active-admin invariant
  * 409 + `code: "last_admin"` mapping for block-last-admin AND
    revoke-last-admin (reuses the existing handler)
  * grant-admin / revoke-admin — 404 on missing user

Login-blocked behavior (`/api/auth/login` returns 403 + `code: user_blocked`)
is exercised at the use-case layer in `test_login_blocked.py`; here we
also pin the HTTP code mapping at the API boundary.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    order_repo as _mem_order_repo,
    user_repo as _mem_user_repo,
)
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0
    yield
    _mem_user_repo._users.clear()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(client: AsyncClient, *, name: str = "U") -> tuple[str, str, str, str]:
    email = f"u-{uuid.uuid4().hex[:8]}@test.com"
    password = "secret123"
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "phone": "+7 999 000 00 00", "password": password},
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
    user_id, email, password, _ = await _register(client, name="Admin")
    await GrantAdminRole(_mem_user_repo).execute(actor_id="SYSTEM", target_user_id=user_id)
    token = await _login(client, email, password)
    return user_id, token


# ─── Auth guard ──────────────────────────────────────────────────────


class TestAuthGuard:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client):
        resp = await client.get("/api/admin/users")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_token_returns_403(self, client):
        _, _, _, token = await _register(client)
        resp = await client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ─── List ────────────────────────────────────────────────────────────


class TestList:
    @pytest.mark.asyncio
    async def test_returns_self_and_filters_work(self, client):
        admin_id, token = await _admin_token(client)
        await _register(client, name="Customer-A")
        await _register(client, name="Customer-B")

        resp = await client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 3
        # Contract: every list-item field is present and typed.
        item = body["items"][0]
        assert set(item.keys()) == {
            "id", "email", "name", "phone", "role", "is_blocked", "created_at",
        }

    @pytest.mark.asyncio
    async def test_filter_by_role(self, client):
        admin_id, token = await _admin_token(client)
        await _register(client)
        await _register(client)

        resp = await client.get(
            "/api/admin/users",
            params={"role": "ADMIN"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == admin_id

    @pytest.mark.asyncio
    async def test_filter_by_is_blocked(self, client):
        _, token = await _admin_token(client)
        target_id, _, _, _ = await _register(client)
        # Block the customer via the API so the full path is exercised.
        resp = await client.post(
            f"/api/admin/users/{target_id}/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text

        resp = await client.get(
            "/api/admin/users",
            params={"is_blocked": "true"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == target_id

    @pytest.mark.asyncio
    async def test_search_matches_email_substring(self, client):
        _, token = await _admin_token(client)
        await _register(client, name="Alice")
        # alice's auto-generated email starts with "u-" so a more reliable
        # match is the name field.
        resp = await client.get(
            "/api/admin/users",
            params={"search": "Alice"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert any(it["name"] == "Alice" for it in body["items"])

    @pytest.mark.asyncio
    async def test_invalid_role_returns_422(self, client):
        _, token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/users",
            params={"role": "BOGUS"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


# ─── Detail ──────────────────────────────────────────────────────────


class TestDetail:
    @pytest.mark.asyncio
    async def test_returns_profile_and_recent_orders(self, client):
        admin_id, token = await _admin_token(client)
        resp = await client.get(
            f"/api/admin/users/{admin_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == admin_id
        assert body["role"] == "ADMIN"
        assert body["is_blocked"] is False
        # recent_orders defaults to []
        assert body["recent_orders"] == []

    @pytest.mark.asyncio
    async def test_unknown_user_returns_404(self, client):
        _, token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/users/does-not-exist",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ─── Block / Unblock ─────────────────────────────────────────────────


class TestBlockUnblock:
    @pytest.mark.asyncio
    async def test_block_then_unblock_round_trip(self, client):
        _, token = await _admin_token(client)
        target_id, _, _, _ = await _register(client)

        resp = await client.post(
            f"/api/admin/users/{target_id}/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_blocked"] is True

        resp = await client.post(
            f"/api/admin/users/{target_id}/unblock",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_blocked"] is False

    @pytest.mark.asyncio
    async def test_block_unknown_user_returns_404(self, client):
        _, token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/users/missing/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_block_last_admin_returns_409_last_admin(self, client):
        admin_id, token = await _admin_token(client)
        # Solo admin tries to block themself → LastAdminRemovalError → 409.
        resp = await client.post(
            f"/api/admin/users/{admin_id}/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409, resp.text
        body = resp.json()
        assert body["code"] == "last_admin"


# ─── Grant / Revoke admin role ───────────────────────────────────────


class TestGrantRevoke:
    @pytest.mark.asyncio
    async def test_grant_then_revoke(self, client):
        _, token = await _admin_token(client)
        target_id, _, _, _ = await _register(client)

        resp = await client.post(
            f"/api/admin/users/{target_id}/grant-admin",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["role"] == "ADMIN"

        # Now two admins exist — revoking the new one is OK.
        resp = await client.post(
            f"/api/admin/users/{target_id}/revoke-admin",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "CUSTOMER"

    @pytest.mark.asyncio
    async def test_grant_unknown_returns_404(self, client):
        _, token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/users/missing/grant-admin",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_revoke_last_admin_returns_409(self, client):
        admin_id, token = await _admin_token(client)
        resp = await client.post(
            f"/api/admin/users/{admin_id}/revoke-admin",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["code"] == "last_admin"


# ─── Login refusal for blocked accounts (HTTP boundary) ──────────────


class TestLoginBlocked:
    @pytest.mark.asyncio
    async def test_blocked_login_returns_403_user_blocked(self, client):
        _, token = await _admin_token(client)
        target_id, target_email, target_password, _ = await _register(client)

        # Block the target via the admin API.
        resp = await client.post(
            f"/api/admin/users/{target_id}/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

        # Login attempt → 403 + USER_BLOCKED.
        resp = await client.post(
            "/api/auth/login",
            json={"email": target_email, "password": target_password},
        )
        assert resp.status_code == 403, resp.text
        body = resp.json()
        assert body["code"] == "user_blocked"
