"""Phase 8B — `/api/admin/shop/banners` integration tests."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import _mem_audit_repo, _mem_banner_repo
from app.container import user_repo as _mem_user_repo
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    _mem_user_repo._users.clear()
    _mem_banner_repo._banners.clear()
    _mem_audit_repo._entries.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_banner_repo._banners.clear()
    _mem_audit_repo._entries.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _admin_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Admin", "email": "admin@test.com",
            "phone": "+7 999 000 00 00", "password": "secret123",
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
            "name": "User", "email": "user@test.com",
            "phone": "+7 999 111 11 11", "password": "secret123",
        },
    )
    return resp.json()["token"]


def _payload(slug_title="Hero", **over):
    base = {
        "title": slug_title, "subtitle": "",
        "image_path": "hero.jpg", "cta_label": "Купить",
        "cta_url": "/catalog", "position": "homepage_hero",
        "priority": 0, "is_active": True,
    }
    base.update(over)
    return base


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_list_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/shop/banners")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_create_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(),
        )
        assert resp.status_code == 403


class TestCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["title"] == "Hero"
        assert body["position"] == "homepage_hero"

    @pytest.mark.asyncio
    async def test_invalid_position_422(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(position="garbage"),
        )
        assert resp.status_code == 422

    # The cross-field invariant `is_active=True` + empty `image_path`
    # is unit-tested at the use-case + entity level
    # (`test_banner_use_cases.py::test_active_no_image_rejected` and
    # `test_banner.py::test_active_requires_image_path`). Re-asserting
    # it through the HTTP layer would either require a generic
    # ValueError → 422 handler (over-broad) or a Pydantic
    # `model_validator` (duplicates domain logic). The unit-level
    # coverage is the right depth for this invariant.


class TestList:
    @pytest.mark.asyncio
    async def test_list_admin_sees_inactive(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(slug_title="A"),
        )
        await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(slug_title="draft", image_path="", is_active=False),
        )
        resp = await client.get(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 2

    @pytest.mark.asyncio
    async def test_position_filter(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(slug_title="hero", position="homepage_hero"),
        )
        await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(slug_title="footer", position="footer"),
        )
        resp = await client.get(
            "/api/admin/shop/banners?position=footer",
            headers={"Authorization": f"Bearer {token}"},
        )
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["title"] == "footer"


class TestPatch:
    @pytest.mark.asyncio
    async def test_unknown_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/shop/banners/missing",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "x"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "banner_not_found"

    @pytest.mark.asyncio
    async def test_patch_priority(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(),
        )
        bid = created.json()["id"]
        resp = await client.patch(
            f"/api/admin/shop/banners/{bid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"priority": 50},
        )
        assert resp.status_code == 200
        assert resp.json()["priority"] == 50


class TestDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(),
        )
        bid = created.json()["id"]
        resp = await client.delete(
            f"/api/admin/shop/banners/{bid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_audit_recorded(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/shop/banners",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(slug_title="aud"),
        )
        bid = created.json()["id"]
        await client.delete(
            f"/api/admin/shop/banners/{bid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Find the SETTINGS_UPDATE audit entry with op=banner_delete.
        matches = [
            e for e in _mem_audit_repo._entries
            if e.payload.get("op") == "banner_delete"
        ]
        assert len(matches) == 1

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/shop/banners/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "banner_not_found"
