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


class TestCreateSelectedSizes:
    @pytest.mark.asyncio
    async def test_creates_only_selected_sizes_and_reuses_existing_ids(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"name": "КРУГ", "slug": "krug", "sizes": ["300x300", "600x600"]}
        first = await client.post("/api/admin/panels/sizes", json=payload, headers=headers)
        assert first.status_code == 201, first.text
        panels = first.json()
        assert [p["slug"] for p in panels] == ["krug-300x300", "krug-600x600"]
        assert [p["base_price"] for p in panels] == [890, 2490]
        second = await client.post("/api/admin/panels/sizes", json={**payload, "sizes": ["300x300", "300x600"]}, headers=headers)
        assert second.status_code == 201, second.text
        assert second.json()[0]["id"] == panels[0]["id"]
        assert second.json()[1]["id"] != panels[0]["id"]
        assert len(_mem_panel_repo._panels) == 3

    @pytest.mark.asyncio
    async def test_size_wizard_reuses_panel_when_slug_is_shared(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"name": "КРУГ", "slug": "krug", "sizes": ["300x300"]}
        first = await client.post("/api/admin/panels/sizes", json=payload, headers=headers)
        assert first.status_code == 201
        # Same name + size via a different endpoint is a duplicate: 409.
        copied = await client.post("/api/admin/panels", json=_create_payload("krug-300x300", name="КРУГ"), headers=headers)
        assert copied.status_code == 409
        assert copied.json()["code"] == "panel_size_conflict"
        repeated = await client.post("/api/admin/panels/sizes", json=payload, headers=headers)
        assert repeated.status_code == 201
        assert repeated.json()[0]["id"] == first.json()[0]["id"]
        assert len(_mem_panel_repo._panels) == 1

    @pytest.mark.asyncio
    async def test_conflict_preflight_does_not_create_partial_set(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        await client.post("/api/admin/panels", json=_create_payload("krug-600x600", name="Другая"), headers=headers)
        response = await client.post("/api/admin/panels/sizes", json={"name": "КРУГ", "slug": "krug", "sizes": ["300x300", "600x600"]}, headers=headers)
        assert response.status_code == 409
        assert len(_mem_panel_repo._panels) == 1

    @pytest.mark.asyncio
    async def test_rejects_duplicate_sizes(self, client):
        token = await _admin_token(client)
        response = await client.post("/api/admin/panels/sizes", json={"name": "КРУГ", "slug": "krug", "sizes": ["300x300", "300x300"]}, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 422
        assert not _mem_panel_repo._panels


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

    @pytest.mark.asyncio
    async def test_detail_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/panels/any-id")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_detail_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/panels/any-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_unauthenticated_401(self, client):
        resp = await client.patch(
            "/api/admin/panels/any-id", json={"name": "x"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.patch(
            "/api/admin/panels/any-id",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "x"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_unauthenticated_401(self, client):
        resp = await client.delete("/api/admin/panels/any-id")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.delete(
            "/api/admin/panels/any-id",
            headers={"Authorization": f"Bearer {token}"},
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
    async def test_same_slug_creates_distinct_panels(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="dup"),
        )
        resp = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="dup", base_price=999, width_mm=300, height_mm=600),
        )
        assert resp.status_code == 201
        assert resp.json()["slug"] == "dup"
        assert len({panel.id for panel in _mem_panel_repo._panels if panel.slug == "dup"}) == 2

    @pytest.mark.asyncio
    async def test_same_name_and_size_conflicts_409(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        first = await client.post("/api/admin/panels", headers=headers, json=_create_payload(slug="a"))
        assert first.status_code == 201, first.text
        resp = await client.post("/api/admin/panels", headers=headers, json=_create_payload(slug="b"))
        assert resp.status_code == 409
        assert resp.json()["code"] == "panel_size_conflict"
        assert len(_mem_panel_repo._panels) == 1

    @pytest.mark.asyncio
    async def test_same_name_and_size_case_insensitive_409(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        first = await client.post("/api/admin/panels", headers=headers, json=_create_payload(slug="a"))
        assert first.status_code == 201, first.text
        resp = await client.post(
            "/api/admin/panels", headers=headers,
            json=_create_payload(slug="b", name="  МАЛАЯ "),
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "panel_size_conflict"

    @pytest.mark.asyncio
    async def test_rename_into_existing_name_size_conflicts_409(self, client):
        token = await _admin_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        first = await client.post("/api/admin/panels", headers=headers, json=_create_payload(slug="a"))
        second = await client.post(
            "/api/admin/panels", headers=headers,
            json=_create_payload(slug="b", name="Другая", width_mm=300, height_mm=600),
        )
        assert first.status_code == 201 and second.status_code == 201
        resp = await client.patch(
            f"/api/admin/panels/{second.json()['id']}", headers=headers,
            json={"name": "Малая", "width_mm": 300, "height_mm": 300},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "panel_size_conflict"

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
            json=_create_payload(slug="h", name="Другая", is_active=False),
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

    # Phase 7B remediation 2 (FE-B) — server-side filters.

    @pytest.mark.asyncio
    async def test_list_filter_is_active_true(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="visible", is_active=True),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="hidden", name="Другая", is_active=False),
        )
        resp = await client.get(
            "/api/admin/panels?is_active=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # Total reflects the filtered set, not the full count.
        assert body["total"] == 1
        assert {item["slug"] for item in body["items"]} == {"visible"}

    @pytest.mark.asyncio
    async def test_list_filter_is_active_false(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="visible", is_active=True),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="hidden", name="Другая", is_active=False),
        )
        resp = await client.get(
            "/api/admin/panels?is_active=false",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "hidden"

    @pytest.mark.asyncio
    async def test_list_search_matches_name(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="alpha", name="Alpha 30"),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="bravo", name="Bravo 60"),
        )
        resp = await client.get(
            "/api/admin/panels?search=alpha",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "alpha"

    @pytest.mark.asyncio
    async def test_list_search_matches_slug(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="custom-30x60", name="Foo"),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="bar-60x60", name="Bar"),
        )
        resp = await client.get(
            "/api/admin/panels?search=30x60",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "custom-30x60"

    @pytest.mark.asyncio
    async def test_list_search_case_insensitive(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="a", name="MyPanel"),
        )
        resp = await client.get(
            "/api/admin/panels?search=mypanel",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1

    @pytest.mark.asyncio
    async def test_list_search_combined_with_is_active(self, client):
        # Defence-in-depth: filters are AND-combined, not OR.
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="active-foo", name="Foo", is_active=True),
        )
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="hidden-foo", name="Foo", is_active=False),
        )
        resp = await client.get(
            "/api/admin/panels?search=foo&is_active=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "active-foo"


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
    async def test_patch_slug_to_existing_group(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="taken"),
        )
        b = await client.post(
            "/api/admin/panels",
            headers={"Authorization": f"Bearer {token}"},
            json=_create_payload(slug="free", name="Другая"),
        )
        bid = b.json()["id"]
        resp = await client.patch(
            f"/api/admin/panels/{bid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"slug": "taken"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == bid
        assert resp.json()["slug"] == "taken"

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

@pytest.mark.anyio
async def test_panel_specs_create_edit_and_public_projection(client):
    token = await _admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    specs = {"thickness_mm": 7, "execution": "Матовое покрытие", "mounting_system": "Клипсы", "base_material": "Композит", "packaging": "10 шт"}
    created = await client.post('/api/admin/panels', json=_create_payload('spec-test', **specs), headers=headers)
    assert created.status_code == 201, created.text
    panel_id = created.json()['id']
    assert all(created.json()[key] == val for key, val in specs.items())
    updated = await client.patch(f'/api/admin/panels/{panel_id}', json={"thickness_mm": 8, "packaging": "8 шт"}, headers=headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()['execution'] == specs['execution']
    public = await client.get('/api/panels')
    assert public.status_code == 200, public.text
    panel = next(item for item in public.json()['items'] if item['id'] == panel_id)
    assert panel['thickness_mm'] == 8 and panel['packaging'] == '8 шт'
    assert panel['mounting_system'] == specs['mounting_system']
    invalid = await client.patch(f'/api/admin/panels/{panel_id}', json={"thickness_mm": 0}, headers=headers)
    assert invalid.status_code == 422
