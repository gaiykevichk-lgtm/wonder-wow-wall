import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_design_repo,
    _mem_texture_repo,
    _mem_texture_color_repo,
    _mem_variant_image_repo,
    user_repo as _mem_user_repo,
)
from app.domain.catalog.entities import Design
from app.domain.catalog.texture import Texture
from app.domain.catalog.texture_color import TextureColor
from app.domain.catalog.variant_image import VariantImage
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_texture_repo._textures.clear()
    _mem_texture_color_repo._colors.clear()
    _mem_variant_image_repo._variants.clear()
    old_designs = _mem_design_repo._designs[:]
    yield
    _mem_user_repo._users.clear()
    _mem_texture_repo._textures.clear()
    _mem_texture_color_repo._colors.clear()
    _mem_variant_image_repo._variants.clear()
    _mem_design_repo._designs[:] = old_designs


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


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


def _ensure_design(design_id="d1"):
    existing = [d for d in _mem_design_repo._designs if d.id == design_id]
    if existing:
        return existing[0]
    d = Design(
        id=design_id, name="Wave", slug="wave-admin",
        category_id="c1", price=100, is_published=True,
    )
    _mem_design_repo._designs.append(d)
    return d


# ─── Auth gates ──────────────────────────────────────────────────────


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/textures")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ─── Texture CRUD ───────────────────────────────────────────────────


class TestTextureCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Concrete", "slug": "concrete"},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "Concrete"
        assert body["slug"] == "concrete"
        assert body["is_active"] is True
        assert body["id"]

    @pytest.mark.asyncio
    async def test_slug_conflict_409(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "A", "slug": "dup"},
        )
        resp = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "B", "slug": "dup"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "texture_slug_conflict"


class TestTextureUpdate:
    @pytest.mark.asyncio
    async def test_happy(self, client):
        token = await _admin_token(client)
        create = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Old", "slug": "old"},
        )
        tid = create.json()["id"]
        resp = await client.patch(
            f"/api/admin/textures/{tid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "New"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/textures/nope",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "texture_not_found"


class TestTextureDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        create = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = create.json()["id"]
        resp = await client.delete(
            f"/api/admin/textures/{tid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/textures/nope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_has_variants_409(self, client):
        token = await _admin_token(client)
        d = _ensure_design()
        create_t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = create_t.json()["id"]
        create_c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray", "hex": "#888888"},
        )
        cid = create_c.json()["id"]
        await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_id": d.id,
                "texture_id": tid,
                "color_id": cid,
                "image_path": "/img.jpg",
            },
        )
        resp = await client.delete(
            f"/api/admin/textures/{tid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "texture_has_variants"


class TestTextureList:
    @pytest.mark.asyncio
    async def test_includes_inactive(self, client):
        token = await _admin_token(client)
        await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "A", "slug": "a", "is_active": True},
        )
        await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "B", "slug": "b", "is_active": False},
        )
        resp = await client.get(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2


# ─── Texture Color CRUD ─────────────────────────────────────────────


class TestTextureColorCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        resp = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray", "hex": "#888888"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Gray"
        assert body["hex"] == "#888888"
        assert body["texture_id"] == tid

    @pytest.mark.asyncio
    async def test_invalid_hex_422(self, client):
        """N3: Pydantic pattern rejects malformed hex at API boundary."""
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "hex-test"},
        )
        tid = t.json()["id"]
        resp = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Bad", "hex": "not-hex"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_texture_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/textures/nope/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "texture_not_found"


class TestTextureColorUpdate:
    @pytest.mark.asyncio
    async def test_happy(self, client):
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Old", "hex": "#000000"},
        )
        cid = c.json()["id"]
        resp = await client.patch(
            f"/api/admin/texture-colors/{cid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "New", "hex": "#FFFFFF"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"
        assert resp.json()["hex"] == "#FFFFFF"

    @pytest.mark.asyncio
    async def test_invalid_hex_update_422(self, client):
        """N3: Pydantic pattern rejects malformed hex on PATCH too."""
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "hex-upd"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "OK", "hex": "#111111"},
        )
        cid = c.json()["id"]
        resp = await client.patch(
            f"/api/admin/texture-colors/{cid}",
            headers={"Authorization": f"Bearer {token}"},
            json={"hex": "xyz"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/texture-colors/nope",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "texture_color_not_found"


class TestTextureColorDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        cid = c.json()["id"]
        resp = await client.delete(
            f"/api/admin/texture-colors/{cid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/texture-colors/nope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


class TestTextureColorList:
    @pytest.mark.asyncio
    async def test_includes_inactive(self, client):
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "A", "is_active": True},
        )
        await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "B", "is_active": False},
        )
        resp = await client.get(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2


# ─── Variant Image CRUD ─────────────────────────────────────────────


class TestVariantImageCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        d = _ensure_design()
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray", "hex": "#888888"},
        )
        cid = c.json()["id"]
        resp = await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_id": d.id,
                "texture_id": tid,
                "color_id": cid,
                "image_path": "/img.jpg",
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["design_id"] == d.id
        assert body["texture_id"] == tid
        assert body["color_id"] == cid
        assert body["image_path"] == "/img.jpg"

    @pytest.mark.asyncio
    async def test_combination_conflict_409(self, client):
        token = await _admin_token(client)
        d = _ensure_design()
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        cid = c.json()["id"]
        payload = {
            "design_id": d.id,
            "texture_id": tid,
            "color_id": cid,
            "image_path": "/img.jpg",
        }
        await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        resp = await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={**payload, "image_path": "/img2.jpg"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "variant_image_combination_conflict"

    @pytest.mark.asyncio
    async def test_design_not_found_404(self, client):
        token = await _admin_token(client)
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        cid = c.json()["id"]
        resp = await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_id": "no-such",
                "texture_id": tid,
                "color_id": cid,
                "image_path": "/img.jpg",
            },
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "design_not_found"


class TestVariantImageDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        d = _ensure_design()
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        cid = c.json()["id"]
        vi = await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_id": d.id,
                "texture_id": tid,
                "color_id": cid,
                "image_path": "/img.jpg",
            },
        )
        vid = vi.json()["id"]
        resp = await client.delete(
            f"/api/admin/variant-images/{vid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_not_found_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/variant-images/nope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "variant_image_not_found"


class TestVariantImageList:
    @pytest.mark.asyncio
    async def test_filter_by_design(self, client):
        token = await _admin_token(client)
        d = _ensure_design()
        t = await client.post(
            "/api/admin/textures",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "X", "slug": "x"},
        )
        tid = t.json()["id"]
        c = await client.post(
            f"/api/admin/textures/{tid}/colors",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Gray"},
        )
        cid = c.json()["id"]
        await client.post(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "design_id": d.id,
                "texture_id": tid,
                "color_id": cid,
                "image_path": "/img.jpg",
            },
        )
        resp = await client.get(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
            params={"design_id": d.id},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_no_filter_empty(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/variant-images",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []
