"""Phase 7B — `/api/admin/panels` integration tests.

Same shape as `test_media_upload.py`: in-memory repos via
`USE_MEMORY_REPOS=true` (set by root conftest), full ASGI stack via
httpx ASGITransport.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import _mem_panel_repo
from app.container import user_repo as _mem_user_repo
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_panel_repo._panels.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_panel_repo._panels.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Auth helpers (lifted from test_media_upload) ────────────────────


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


def _create_payload(slug: str = "small", **overrides) -> dict:
    base = {
        "name": "Малая",
        "slug": slug,
        "width_mm": 300,
        "height_mm": 300,
        "size_label": "30×30 см",
        "base_price": 890,
        "description": "",
        "photo_path": "",
        "is_active": True,
    }
    base.update(overrides)
    return base


# ─── Auth gates ──────────────────────────────────────────────────────


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_list_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/panels")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_list_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(),
        )
        assert resp.status_code == 403


# ─── Create ──────────────────────────────────────────────────────────


class TestCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["slug"] == "small"
        assert body["width_mm"] == 300
        assert body["base_price"] == 890
        assert body["is_active"] is True
        assert body["id"]

    @pytest.mark.asyncio
    async def test_slug_conflict_409(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="dup"),
        )
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="dup", base_price=999),
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["code"] == "panel_slug_conflict"

    @pytest.mark.asyncio
    async def test_zero_dimension_422(self, client):
        # Pydantic Field(gt=0) rejects this at the API layer.
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(width_mm=0),
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_price_422(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(base_price=-1),
        )
        assert resp.status_code == 422


# ─── List ────────────────────────────────────────────────────────────


class TestList:
    @pytest.mark.asyncio
    async def test_list_includes_inactive(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="a", is_active=True),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="h", is_active=False),
        )
        resp = await client.get(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        slugs = {item["slug"] for item in body["items"]}
        assert slugs == {"a", "h"}


# ─── Detail ──────────────────────────────────────────────────────────


class TestDetail:
    @pytest.mark.asyncio
    async def test_unknown_id_404(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/panels/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "panel_not_found"

    @pytest.mark.asyncio
    async def test_get_by_id_200(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="x"),
        )
        pid = created.json()["id"]
        resp = await client.get(
            f"/api/admin/panels/{pid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["slug"] == "x"


# ─── Update ──────────────────────────────────────────────────────────


class TestUpdate:
    @pytest.mark.asyncio
    async def test_patch_only_price(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="p", base_price=100),
        )
        pid = created.json()["id"]
        resp = await client.patch(
            f"/api/admin/panels/{pid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"base_price": 999},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["base_price"] == 999
        assert body["slug"] == "p"  # unchanged

    @pytest.mark.asyncio
    async def test_patch_unknown_id_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/panels/missing",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "x"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "panel_not_found"

    @pytest.mark.asyncio
    async def test_patch_slug_conflict_409(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="taken"),
        )
        b = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="free"),
        )
        bid = b.json()["id"]
        resp = await client.patch(
            f"/api/admin/panels/{bid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"slug": "taken"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "panel_slug_conflict"

    @pytest.mark.asyncio
    async def test_patch_size_label_only(self, client):
        # Re-composes `PanelSize` from current row + the single delta.
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="sz", size_label="30×30 см"),
        )
        pid = created.json()["id"]
        resp = await client.patch(
            f"/api/admin/panels/{pid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"size_label": "Маленькая 30×30"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["size_label"] == "Маленькая 30×30"
        assert body["width_mm"] == 300  # untouched


# ─── Delete ──────────────────────────────────────────────────────────


class TestDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="del"),
        )
        pid = created.json()["id"]
        resp = await client.delete(
            f"/api/admin/panels/{pid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/panels/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "panel_not_found"
