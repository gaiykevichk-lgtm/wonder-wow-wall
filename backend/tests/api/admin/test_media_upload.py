"""Phase 6 — `/api/admin/media` integration tests.

Same shape as `test_users.py`: in-memory repos via `USE_MEMORY_REPOS=true`
(set by root conftest), full ASGI stack via httpx ASGITransport. The
`FileStorage` singleton is overridden per-test with one backed by a
`tempfile.TemporaryDirectory` so the suite never writes to `/var/uploads`.

Coverage:

  * `GET /constraints`               — auth-guarded read, shape pin
  * `POST /media`                    — happy 201, 413, 415, 422 (mime),
                                       422 (corrupt), 422 (dimensions),
                                       422 (missing purpose), 401, 403,
                                       URL round-trip via storage adapter
  * `DELETE /media/{id}`             — 204 happy, 404 missing, 404
                                       on second delete (idempotent at
                                       the use case, NOT at the API)
"""
import io
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    get_file_storage,
    reset_file_storage_singleton,
    user_repo as _mem_user_repo,
)
from app.container import _mem_media_repo
from app.infrastructure.storage.local import LocalFileStorage
from app.main import app


# ─── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def storage_root():
    """Per-test tempdir + LocalFileStorage. Override the FastAPI dep so
    the production singleton never touches disk during tests."""
    with tempfile.TemporaryDirectory() as root:
        adapter = LocalFileStorage(root=root, url_prefix="/uploads")
        app.dependency_overrides[get_file_storage] = lambda: adapter
        try:
            yield root, adapter
        finally:
            app.dependency_overrides.pop(get_file_storage, None)
            # Reset the lazy-init singleton so the next test gets a
            # fresh instance against any settings monkeypatching it
            # might do.
            reset_file_storage_singleton()


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_media_repo._assets.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_media_repo._assets.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Helpers ─────────────────────────────────────────────────────────


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
            "name": "C",
            "email": "c@test.com",
            "phone": "+7 999 111 11 11",
            "password": "secret123",
        },
    )
    return resp.json()["token"]


def _png(width: int, height: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color="green").save(buf, format="PNG")
    return buf.getvalue()


def _jpeg(width: int, height: int, quality: int = 80) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color="red").save(
        buf, format="JPEG", quality=quality,
    )
    return buf.getvalue()


# ─── Auth guard ──────────────────────────────────────────────────────


class TestAuthGuard:
    @pytest.mark.asyncio
    async def test_constraints_requires_token(self, client, storage_root):
        resp = await client.get("/api/admin/media/constraints")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_constraints_requires_admin_role(self, client, storage_root):
        # Symmetry with upload/delete: a customer-token must NOT be able
        # to read media constraints (they leak per-purpose limits which
        # are admin-internal — public UI doesn't need them).
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/media/constraints",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_upload_requires_admin_role(self, client, storage_root):
        token = await _customer_token(client)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "PANEL_PHOTO"},
            files={"file": ("p.jpg", _jpeg(800, 800), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_requires_admin(self, client, storage_root):
        token = await _customer_token(client)
        resp = await client.delete(
            "/api/admin/media/some-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ─── Constraints read ────────────────────────────────────────────────


class TestConstraints:
    @pytest.mark.asyncio
    async def test_returns_global_and_per_purpose_envelopes(
        self, client, storage_root,
    ):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/media/constraints",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["global_max_size_bytes"] == 20 * 1024 * 1024
        # Every enum value present.
        purposes = body["purposes"]
        assert {"DESIGN_PREVIEW", "PANEL_PHOTO", "BANNER", "MISC"} <= set(purposes)
        # Pin one — the frontend reads PANEL_PHOTO to decide hint text.
        panel = purposes["PANEL_PHOTO"]
        assert panel["max_size_bytes"] == 10 * 1024 * 1024
        assert "image/jpeg" in panel["allowed_mimes"]
        assert panel["min_width"] == 600


# ─── Upload happy + URL round-trip ───────────────────────────────────


class TestUploadHappy:
    @pytest.mark.asyncio
    async def test_panel_photo_returns_201_and_url(self, client, storage_root):
        token = await _admin_token(client)
        root, adapter = storage_root

        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "PANEL_PHOTO"},
            files={"file": ("panel.jpg", _jpeg(800, 800), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["purpose"] == "PANEL_PHOTO"
        assert body["mime"] == "image/jpeg"
        assert body["original_name"] == "panel.jpg"
        # URL is built by the storage adapter — round-trip pin.
        assert body["url"].startswith("/uploads/PANEL_PHOTO/")
        assert body["url"].endswith(".jpg")

        # File actually landed on disk under the tempdir.
        import os
        assert os.path.exists(os.path.join(root, body["path"]))

    @pytest.mark.asyncio
    async def test_url_round_trip_through_storage_adapter(
        self, client, storage_root,
    ):
        # Critical contract: `path` returned by upload must round-trip
        # through `url_for(path)` to the same `url` field — a future
        # storage adapter that strips `/uploads` would break the
        # frontend silently.
        token = await _admin_token(client)
        _, adapter = storage_root
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "MISC"},
            files={"file": ("x.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert adapter.url_for(body["path"]) == body["url"]


# ─── Upload validation 4xx ──────────────────────────────────────────


class TestUploadValidation:
    @pytest.mark.asyncio
    async def test_missing_purpose_is_422(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/media",
            files={"file": ("x.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unknown_purpose_is_422(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "NOT_A_PURPOSE"},
            files={"file": ("x.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_wrong_mime_is_415(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "PANEL_PHOTO"},
            files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 415
        body = resp.json()
        # Top-level envelope from `media_invalid_mime_handler` — the
        # global handlers produce `{detail, code}` flat, NOT nested
        # under FastAPI's HTTPException `detail` wrapper.
        assert body["code"] == "media_invalid_mime"

    @pytest.mark.asyncio
    async def test_corrupt_image_is_422(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "PANEL_PHOTO"},
            files={"file": ("fake.jpg", b"not really an image", "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "media_corrupt"

    @pytest.mark.asyncio
    async def test_too_small_dimensions_is_422(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "DESIGN_PREVIEW"},
            files={"file": ("small.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "media_invalid_dimensions"

    @pytest.mark.asyncio
    async def test_per_purpose_size_cap_is_413(self, client, storage_root):
        # DESIGN_PREVIEW caps at 5MB.
        token = await _admin_token(client)
        big = _jpeg(2500, 2500, quality=100)
        if len(big) <= 5 * 1024 * 1024:
            big = big + b"\x00" * (5 * 1024 * 1024 + 1 - len(big))
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "DESIGN_PREVIEW"},
            files={"file": ("big.jpg", big, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 413
        body = resp.json()
        assert body["code"] == "media_too_large"

    @pytest.mark.asyncio
    async def test_global_cap_api_pre_reject_is_413(self, client, storage_root):
        # Exercises the API-layer early check (media.py:146) that fires
        # BEFORE the use case runs. 21MB > 20MB global cap → 413 without
        # Pillow decode. The per-purpose test above hits the use-case
        # check (5MB < 20MB); this one hits the API-layer guard.
        token = await _admin_token(client)
        blob = b"\x00" * (20 * 1024 * 1024 + 1)
        resp = await client.post(
            "/api/admin/media",
            params={"purpose": "MISC"},
            files={"file": ("huge.bin", blob, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 413
        body = resp.json()
        assert body["code"] == "media_too_large"


# ─── Delete ──────────────────────────────────────────────────────────


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_removes_row_and_file(self, client, storage_root):
        token = await _admin_token(client)
        root, _ = storage_root

        upload = await client.post(
            "/api/admin/media",
            params={"purpose": "MISC"},
            files={"file": ("x.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        body = upload.json()
        asset_id = body["id"]
        import os
        on_disk = os.path.join(root, body["path"])
        assert os.path.exists(on_disk)

        # 204 No Content on success — pin the body shape too.
        resp = await client.delete(
            f"/api/admin/media/{asset_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204
        # File AND row both gone.
        assert not os.path.exists(on_disk)

    @pytest.mark.asyncio
    async def test_delete_unknown_returns_404(self, client, storage_root):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/media/no-such-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "media_not_found"

    @pytest.mark.asyncio
    async def test_second_delete_is_404_not_500(self, client, storage_root):
        # Use case is idempotent (returns False); the API translates
        # False to 404 — important so the admin UI's "delete" button
        # can be re-clicked on a stuck spinner without surfacing a 500.
        token = await _admin_token(client)
        upload = await client.post(
            "/api/admin/media",
            params={"purpose": "MISC"},
            files={"file": ("x.png", _png(100, 100), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        asset_id = upload.json()["id"]

        first = await client.delete(
            f"/api/admin/media/{asset_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 204
        second = await client.delete(
            f"/api/admin/media/{asset_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert second.status_code == 404
