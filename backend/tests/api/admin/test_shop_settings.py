"""Phase 8A — `/api/admin/shop/settings` integration tests.

Same fixture pattern as `test_panels.py`: in-memory repos via
`USE_MEMORY_REPOS=true`, full ASGI stack via httpx ASGITransport.

Note: the ShopSettings repo is a singleton row, not a list — the
fixture restores defaults by replacing `_mem_shop_settings_repo
._settings`, not by clearing a list.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import _mem_shop_settings_repo
from app.container import user_repo as _mem_user_repo
from app.domain.shop.settings import ShopSettings
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_shop_settings_repo._settings = ShopSettings()
    yield
    _mem_user_repo._users.clear()
    _mem_shop_settings_repo._settings = ShopSettings()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Auth helpers (same shape as test_panels) ───────────────────────


async def _admin_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Admin",
            "email": "admin@test.com",
            "phone": "+7 999 000 00 00",
            "password": "secret123",
        },
    )
    assert resp.status_code == 201, resp.text
    user_id = resp.json()["user"]["id"]
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id,
    )
    login = await client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "secret123"},
    )
    return login.json()["token"]


async def _customer_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "User",
            "email": "user@test.com",
            "phone": "+7 999 111 11 11",
            "password": "secret123",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["token"]


# ─── Auth gates ──────────────────────────────────────────────────────


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_get_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/shop/settings")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"design_overlay_price": 5000},
        )
        assert resp.status_code == 403


# ─── Read ────────────────────────────────────────────────────────────


class TestGet:
    @pytest.mark.asyncio
    async def test_returns_seeded_defaults(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "singleton"
        assert body["design_overlay_price"] == 1200
        assert body["installation_price"] == 0
        assert body["min_order_amount"] == 0
        # Phase 10 — the cap on the admin-curated «с этим покупают» rail
        # must surface in the admin payload so the editor can render it.
        assert body["recommendations_limit_per_source"] == 12
        assert "updated_at" in body


# ─── Patch ───────────────────────────────────────────────────────────


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_one_field(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"design_overlay_price": 1500},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["design_overlay_price"] == 1500
        # Other fields untouched.
        assert body["installation_price"] == 0
        assert body["min_order_amount"] == 0

    @pytest.mark.asyncio
    async def test_patch_multiple_fields(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_overlay_price": 1500,
                "installation_price": 2000,
                "min_order_amount": 5000,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["design_overlay_price"] == 1500
        assert body["installation_price"] == 2000
        assert body["min_order_amount"] == 5000

    @pytest.mark.asyncio
    async def test_patch_zero_disables_installation(self, client):
        # `0` is a valid value (means "feature off"), not "absent".
        token = await _admin_token(client)
        # First enable the fee.
        await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"installation_price": 1000},
        )
        # Then disable it by setting to 0.
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"installation_price": 0},
        )
        assert resp.status_code == 200
        assert resp.json()["installation_price"] == 0

    @pytest.mark.asyncio
    async def test_patch_negative_rejected_422(self, client):
        # Pydantic `ge=0` bounces before the use case runs.
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"design_overlay_price": -1},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_recommendations_limit(self, client):
        # Phase 10 — admin can resize the «с этим покупают» rail cap.
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"recommendations_limit_per_source": 8},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendations_limit_per_source"] == 8
        # Other fields untouched.
        assert body["design_overlay_price"] == 1200

    @pytest.mark.asyncio
    async def test_patch_recommendations_limit_zero_rejected_422(self, client):
        # `ge=1` — 0 would silently disable the rail; that's a feature
        # toggle decision, not a knob value.
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"recommendations_limit_per_source": 0},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_recommendations_limit_persisted_in_get(self, client):
        # PATCH→GET round-trip — the new value must survive a re-read so
        # the public endpoint and the admin editor both see it.
        token = await _admin_token(client)
        await client.patch(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"recommendations_limit_per_source": 6},
        )
        resp = await client.get(
            "/api/admin/shop/settings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.json()["recommendations_limit_per_source"] == 6
