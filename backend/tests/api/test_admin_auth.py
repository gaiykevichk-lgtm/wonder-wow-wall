"""API-layer tests for Phase 1 admin guard chain.

Covers `/api/admin/me` end-to-end:
    * 401 when no token
    * 401 when token is malformed
    * 403 when token belongs to a CUSTOMER (role claim blocks)
    * 200 when token belongs to an ADMIN

This is the single integration test that proves the full chain
(JWT decode → role claim check → `get_current_admin_id` → router → DB).
"""

import uuid

import pytest
from httpx import AsyncClient, ASGITransport

from app.application.user.use_cases import GrantAdminRole
from app.container import user_repo as _mem_user_repo
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(client: AsyncClient) -> tuple[str, str]:
    """Register a new customer and return (user_id, token)."""
    email = f"admin-it-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Admin IT",
            "email": email,
            "phone": "+7 999 000 00 00",
            "password": "secret123",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["user"]["id"], data["token"]


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


class TestAdminMeGuard:
    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/api/admin/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_token_returns_401(self, client):
        resp = await client.get(
            "/api/admin/me", headers={"Authorization": "Bearer not-a-real-token"}
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_token_returns_403(self, client):
        _user_id, token = await _register(client)

        resp = await client.get(
            "/api/admin/me", headers={"Authorization": f"Bearer {token}"}
        )

        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_token_returns_200_with_profile(self, client):
        # Register → promote via use case → re-login to get a token that
        # carries the freshly-updated `role` claim.
        email = f"admin-ok-{uuid.uuid4().hex[:8]}@test.com"
        password = "secret123"
        reg = await client.post(
            "/api/auth/register",
            json={
                "name": "Boss",
                "email": email,
                "phone": "+7 000 000 00 00",
                "password": password,
            },
        )
        assert reg.status_code == 201
        user_id = reg.json()["user"]["id"]

        await GrantAdminRole(_mem_user_repo).execute(
            actor_id="SYSTEM", target_user_id=user_id
        )

        token = await _login(client, email, password)

        resp = await client.get(
            "/api/admin/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == user_id
        assert body["email"] == email
        assert body["role"] == "ADMIN"

    @pytest.mark.asyncio
    async def test_stale_customer_token_still_403_after_promotion(self, client):
        """A user promoted to admin after their token was issued still gets
        403 on /api/admin/me — because the `role` claim is baked into the
        JWT at login time. They must re-login. This documents the current
        behavior (acceptable trade-off for Phase 1; revocation list is
        out of scope)."""
        email = f"stale-{uuid.uuid4().hex[:8]}@test.com"
        password = "secret123"
        reg = await client.post(
            "/api/auth/register",
            json={
                "name": "Later Admin",
                "email": email,
                "phone": "+7 000 000 00 00",
                "password": password,
            },
        )
        assert reg.status_code == 201
        user_id = reg.json()["user"]["id"]
        stale_token = reg.json()["token"]  # role=CUSTOMER in this JWT

        # Promote AFTER the token was minted
        await GrantAdminRole(_mem_user_repo).execute(
            actor_id="SYSTEM", target_user_id=user_id
        )

        resp = await client.get(
            "/api/admin/me", headers={"Authorization": f"Bearer {stale_token}"}
        )
        assert resp.status_code == 403

        # After re-login the new token carries role=ADMIN
        fresh_token = await _login(client, email, password)
        resp2 = await client.get(
            "/api/admin/me", headers={"Authorization": f"Bearer {fresh_token}"}
        )
        assert resp2.status_code == 200
