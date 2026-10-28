"""Phase 5C — HTTP-level tests for the perspective/calibration PATCH endpoints
and for the new POST/PUT/GET fields.

Coverage at a glance:
* `POST /projects` round-trips `calibration` + auto-detected flags + `version`.
* `GET /projects/{id}` returns the new fields.
* `PATCH /projects/{id}/perspective`
    - happy path (200, version bumped, auto-flag cleared)
    - degenerate quad (422 + `code: degenerate_corners`)
    - stale version (409 + `code: stale_version`)
    - clearing corners (200, corners=null)
    - cross-user (404)
* `PATCH /projects/{id}/calibration`
    - happy path (200, legacy float mirror updated)
    - stale version (409)

Authn helper is duplicated from `test_visualizer.py` to avoid coupling tests
to each other's fixtures (per CONVENTIONS.md `tests/api/` should be standalone
integration tests).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register_and_get_token(client: AsyncClient) -> str:
    email = f"viz5c-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post("/api/auth/register", json={
        "name": "Viz5C User", "email": email, "phone": "", "password": "secret123",
    })
    assert resp.status_code == 201
    return resp.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _square_corners() -> list[dict]:
    return [
        {"x": 0, "y": 0}, {"x": 100, "y": 0},
        {"x": 100, "y": 100}, {"x": 0, "y": 100},
    ]


# ─── POST/GET round-trip with new fields ─────────────────────────────


class TestVisualizationProjectFieldRoundTrip:
    @pytest.mark.asyncio
    async def test_create_with_calibration_and_flags(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/visualizer/projects",
            json={
                "name": "Round-trip",
                "calibration": {
                    "method": "reference",
                    "pixels_per_cm": 6.5,
                    "wall_width_cm": 300,
                    "wall_height_cm": 240,
                },
                "perspective_auto_detected": True,
                "calibration_auto_detected": True,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["calibration"]["method"] == "reference"
        assert data["calibration"]["pixels_per_cm"] == 6.5
        assert data["perspective_auto_detected"] is True
        assert data["calibration_auto_detected"] is True
        assert data["version"] == 1
        # Legacy float mirror reflects calibration.pixels_per_cm even though
        # the request body sent only the typed `calibration`.
        assert data["calibration_pixels_per_cm"] == 6.5

    @pytest.mark.asyncio
    async def test_get_returns_new_fields(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P"},
            headers=_auth(token),
        )
        pid = create.json()["id"]
        resp = await client.get(f"/api/visualizer/projects/{pid}", headers=_auth(token))
        body = resp.json()
        assert "calibration" in body
        assert "perspective_auto_detected" in body
        assert "calibration_auto_detected" in body
        assert body["version"] == 1


# ─── PATCH /perspective ──────────────────────────────────────────────


class TestPatchPerspective:
    @pytest.mark.asyncio
    async def test_happy_path(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P", "perspective_auto_detected": True},
            headers=_auth(token),
        )
        pid = create.json()["id"]
        version = create.json()["version"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/perspective",
            json={"corners": _square_corners(), "version": version},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["perspective_corners"] == _square_corners()
        assert data["perspective_auto_detected"] is False  # cleared on manual edit
        assert data["version"] == version + 1

    @pytest.mark.asyncio
    async def test_degenerate_returns_422_with_code(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P"},
            headers=_auth(token),
        )
        pid = create.json()["id"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/perspective",
            json={
                # All four corners on the same point ⇒ area = 0 ⇒ degenerate.
                "corners": [{"x": 5, "y": 5}] * 4,
                "version": 1,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 422
        body = resp.json()
        # Distinguishable from generic Pydantic 422s — the frontend can branch
        # on `code` to decide whether to silently retry or surface an error.
        assert body["code"] == "degenerate_corners"
        assert "degenerate" in body["detail"].lower()

    @pytest.mark.asyncio
    async def test_stale_version_returns_409(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P"},
            headers=_auth(token),
        )
        pid = create.json()["id"]
        server_version = create.json()["version"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/perspective",
            json={"corners": _square_corners(), "version": 99},
            headers=_auth(token),
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["code"] == "stale_version"
        # X11 closure — the 409 body must carry `server_version` so the
        # frontend can use it as the next read-marker when it refetches
        # (B45 contract). Previously only `code` was asserted.
        assert body["server_version"] == server_version

    @pytest.mark.asyncio
    async def test_clear_corners_with_null(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={
                "name": "P",
                "perspective_corners": _square_corners(),
            },
            headers=_auth(token),
        )
        pid = create.json()["id"]
        version = create.json()["version"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/perspective",
            json={"corners": None, "version": version},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["perspective_corners"] is None

    @pytest.mark.asyncio
    async def test_cross_user_returns_404(self, client):
        token1 = await _register_and_get_token(client)
        token2 = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P"},
            headers=_auth(token1),
        )
        pid = create.json()["id"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/perspective",
            json={"corners": _square_corners(), "version": 1},
            headers=_auth(token2),
        )
        assert resp.status_code == 404


# ─── PATCH /calibration ──────────────────────────────────────────────


class TestPatchCalibration:
    @pytest.mark.asyncio
    async def test_happy_path(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P", "calibration_auto_detected": True},
            headers=_auth(token),
        )
        pid = create.json()["id"]
        version = create.json()["version"]

        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/calibration",
            json={
                "calibration": {
                    "method": "manual",
                    "pixels_per_cm": 8.0,
                    "wall_width_cm": 250,
                },
                "version": version,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["calibration"]["method"] == "manual"
        assert data["calibration"]["pixels_per_cm"] == 8.0
        # Legacy float mirror updated.
        assert data["calibration_pixels_per_cm"] == 8.0
        assert data["calibration_auto_detected"] is False
        assert data["version"] == version + 1

    @pytest.mark.asyncio
    async def test_stale_version_returns_409(self, client):
        token = await _register_and_get_token(client)
        create = await client.post(
            "/api/visualizer/projects",
            json={"name": "P"},
            headers=_auth(token),
        )
        pid = create.json()["id"]
        server_version = create.json()["version"]
        resp = await client.patch(
            f"/api/visualizer/projects/{pid}/calibration",
            json={
                "calibration": {"method": "manual", "pixels_per_cm": 5.0},
                "version": 42,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["code"] == "stale_version"
        # X11 closure — symmetric with the perspective 409 assertion.
        # Ensures B45's server_version contract is covered on calibration too.
        assert body["server_version"] == server_version
