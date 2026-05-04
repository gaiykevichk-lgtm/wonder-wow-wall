"""Phase 7A — `/api/admin/categories` + `/api/admin/designs` integration tests.

Same shape as `test_panels.py`: in-memory repos via `USE_MEMORY_REPOS=true`
(set by root conftest), full ASGI stack via httpx ASGITransport. Auth
helpers are local copies of the Phase 7B versions — identical pattern.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_audit_repo,
    _mem_category_repo,
    _mem_design_repo,
    _mem_recommendation_repo,
)
from app.container import user_repo as _mem_user_repo
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    # Snapshot seed-state of singleton in-memory repos so the suite does
    # not lose the container-level seed (`SEED_DESIGNS`, `SEED_CATEGORIES`)
    # for tests that rely on it (`tests/api/test_api.py::TestCatalog`).
    # Mutating in-place (clear+extend) preserves the list identity so
    # the `designs_source=lambda: _mem_design_repo._designs` callback
    # wired in `app/container.py` continues to see live writes.
    saved_designs = list(_mem_design_repo._designs)
    saved_categories = list(_mem_category_repo._categories)
    _mem_user_repo._users.clear()
    _mem_design_repo._designs.clear()
    _mem_category_repo._categories.clear()
    _mem_audit_repo._entries.clear()
    _mem_recommendation_repo._recs.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_design_repo._designs.clear()
    _mem_category_repo._categories.clear()
    _mem_audit_repo._entries.clear()
    _mem_recommendation_repo._recs.clear()
    _mem_design_repo._designs.extend(saved_designs)
    _mem_category_repo._categories.extend(saved_categories)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Auth helpers ────────────────────────────────────────────────────


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


def _category_payload(slug: str = "nature", **overrides) -> dict:
    base = {"name": "Природа", "slug": slug, "image": "/n.jpg"}
    base.update(overrides)
    return base


def _design_payload(category_id: str, slug: str = "forest", **overrides) -> dict:
    base = {
        "name": "Лес",
        "slug": slug,
        "category_id": category_id,
        "style": "Природа",
        "image": "/d.jpg",
        "description": "",
        "price": 1200,
        "colors": [{"hex": "#0f0", "name": "Зелёный"}],
        "is_published": True,
        "is_new": False,
        "is_popular": False,
    }
    base.update(overrides)
    return base


# ═══════════════════════════════════════════════════════════════════════
# Auth gates
# ═══════════════════════════════════════════════════════════════════════


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_categories_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/categories")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_categories_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_designs_create_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id="x"),
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_designs_patch_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.patch(
            "/api/admin/designs/any-id",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "x"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_designs_delete_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.delete(
            "/api/admin/designs/any-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_designs_toggle_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.post(
            "/api/admin/designs/any-id/toggle-visibility",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════
# Categories — CRUD
# ═══════════════════════════════════════════════════════════════════════


class TestCategoriesCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["slug"] == "nature"
        assert body["designs_count"] == 0
        assert body["id"]

    @pytest.mark.asyncio
    async def test_slug_conflict_409(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="dup"),
        )
        resp = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="dup", name="Other"),
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "category_slug_conflict"

    @pytest.mark.asyncio
    async def test_empty_name_422(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(name=""),
        )
        assert resp.status_code == 422


class TestCategoriesList:
    @pytest.mark.asyncio
    async def test_includes_design_counts(self, client):
        token = await _admin_token(client)
        a = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="a", name="A"),
        )
        a_id = a.json()["id"]
        await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="b", name="B"),
        )
        # One design in A.
        await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=a_id, slug="d1"),
        )
        resp = await client.get(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert {row["slug"] for row in items} == {"a", "b"}
        counts = {row["slug"]: row["designs_count"] for row in items}
        assert counts["a"] == 1
        assert counts["b"] == 0


class TestCategoriesUpdate:
    @pytest.mark.asyncio
    async def test_patch_name_only(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="up"),
        )
        cid = created.json()["id"]
        resp = await client.patch(
            f"/api/admin/categories/{cid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Renamed"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"
        assert resp.json()["slug"] == "up"

    @pytest.mark.asyncio
    async def test_unknown_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/categories/missing",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "x"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "category_not_found"


class TestCategoriesDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        created = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="del"),
        )
        cid = created.json()["id"]
        resp = await client.delete(
            f"/api/admin/categories/{cid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_in_use_409(self, client):
        token = await _admin_token(client)
        cat = await client.post(
            "/api/admin/categories",
            headers={"Authorization": f"Bearer {token}"},
            json=_category_payload(slug="busy"),
        )
        cid = cat.json()["id"]
        await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="bound"),
        )
        resp = await client.delete(
            f"/api/admin/categories/{cid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "category_in_use"

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/categories/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "category_not_found"


# ═══════════════════════════════════════════════════════════════════════
# Designs — CRUD + visibility + delete
# ═══════════════════════════════════════════════════════════════════════


async def _seeded_category(client: AsyncClient, token: str, slug="x") -> str:
    resp = await client.post(
        "/api/admin/categories",
        headers={"Authorization": f"Bearer {token}"},
        json=_category_payload(slug=slug),
    )
    return resp.json()["id"]


class TestDesignsCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        resp = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["category_id"] == cid
        assert body["is_published"] is True
        assert body["colors"][0]["hex"] == "#0f0"

    @pytest.mark.asyncio
    async def test_unknown_category_404(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id="missing"),
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "category_not_found"

    @pytest.mark.asyncio
    async def test_slug_conflict_409(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="dup"),
        )
        resp = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="dup", name="B"),
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "design_slug_conflict"


class TestDesignsList:
    @pytest.mark.asyncio
    async def test_admin_sees_unpublished(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="pub"),
        )
        await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(
                category_id=cid, slug="hid", is_published=False,
            ),
        )
        resp = await client.get(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert {x["slug"] for x in body["items"]} == {"pub", "hid"}


class TestDesignsUpdate:
    @pytest.mark.asyncio
    async def test_patch_price_only(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        created = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="up", price=100),
        )
        did = created.json()["id"]
        resp = await client.patch(
            f"/api/admin/designs/{did}",
            headers={"Authorization": f"Bearer {token}"},
            json={"price": 999},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["price"] == 999
        assert body["slug"] == "up"

    @pytest.mark.asyncio
    async def test_unknown_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/designs/missing",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "x"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "design_not_found"


class TestDesignsToggleVisibility:
    @pytest.mark.asyncio
    async def test_flip(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        created = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="t"),
        )
        did = created.json()["id"]
        resp = await client.post(
            f"/api/admin/designs/{did}/toggle-visibility",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_published"] is False
        resp = await client.post(
            f"/api/admin/designs/{did}/toggle-visibility",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.json()["is_published"] is True


class TestDesignsDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        created = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="del"),
        )
        did = created.json()["id"]
        resp = await client.delete(
            f"/api/admin/designs/{did}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_audit_recorded(self, client):
        token = await _admin_token(client)
        cid = await _seeded_category(client, token)
        created = await client.post(
            "/api/admin/designs",
            headers={"Authorization": f"Bearer {token}"},
            json=_design_payload(category_id=cid, slug="aud"),
        )
        did = created.json()["id"]
        await client.delete(
            f"/api/admin/designs/{did}",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Direct check of audit singleton — same pattern as panels test.
        assert any(
            e.target_id == did and e.action.value == "design_delete"
            for e in _mem_audit_repo._entries
        )

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/designs/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "design_not_found"
