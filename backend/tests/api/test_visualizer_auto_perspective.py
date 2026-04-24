"""Phase 6 — HTTP tests for `POST /auto-perspective`.

Covers the happy path (StubDepthEstimator → PlaneFittingService → corners in
photo-pixel space) and the failure envelopes (`code: plane_fit_failed` on
degenerate mask, `code: depth_unavailable` on estimator failure).

Why a dedicated file: the scenarios here need to swap `get_depth_estimator`
via `app.dependency_overrides`, which is a different fixture discipline from
the CRUD tests in `test_visualizer_perspective_api.py`. Keeping them apart
avoids cross-test override leakage (overrides are process-global).
"""

import base64
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.container import get_depth_estimator
from app.domain.visualizer.depth_estimator import DepthEstimator
from app.domain.visualizer.exceptions import DepthEstimationError
from app.domain.visualizer.value_objects import DepthMap
from app.infrastructure.ml.depth_estimators import StubDepthEstimator
from app.main import app


# A 1×1 red pixel PNG base64 — smallest valid data URL the backend accepts.
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)
_DATA_URL = f"data:image/png;base64,{_TINY_PNG_B64}"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_overrides():
    # Ensure each test starts with a clean slate regardless of previous tests.
    yield
    app.dependency_overrides.pop(get_depth_estimator, None)


async def _register(client: AsyncClient) -> str:
    email = f"viz6-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Viz6", "email": email, "phone": "", "password": "secret123"},
    )
    assert resp.status_code == 201
    return resp.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _make_mask(photo_w: int, photo_h: int, filled: bool = True) -> str:
    """Build a raw-bytes wall mask (1 byte per pixel) → base64.

    Matches the frontend's wire contract (see
    `frontend/src/domains/visualizer/lib/maskSerialization.ts`): no PNG
    container, just the flat raw mask bytes (0 or 255).
    """
    byte = 0xFF if filled else 0x00
    return base64.b64encode(bytes([byte] * (photo_w * photo_h))).decode()


async def _create_project(
    client: AsyncClient,
    token: str,
    *,
    photo_w: int = 64,
    photo_h: int = 64,
    mask_filled: bool = True,
    with_photo: bool = True,
    with_mask: bool = True,
) -> str:
    body = {
        "name": "AutoP",
        "photo_url": _DATA_URL if with_photo else "",
        "photo_width": photo_w,
        "photo_height": photo_h,
        "wall_mask_base64": _make_mask(photo_w, photo_h, mask_filled) if with_mask else "",
    }
    resp = await client.post(
        "/api/visualizer/projects", json=body, headers=_auth(token)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ─── Happy path ──────────────────────────────────────────────────────


class TestAutoPerspectiveHappy:
    @pytest.mark.asyncio
    async def test_returns_corners_in_photo_coords(self, client):
        token = await _register(client)
        pid = await _create_project(client, token, photo_w=64, photo_h=64)

        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "corners" in body
        assert "confidence" in body
        assert len(body["corners"]) == 4
        # Stub emits a 64×64 depth map that maps 1:1 with our 64×64 photo, so
        # the bounding box should span the full image (mask is all-True).
        # We check loosely to stay robust to stride-1 rounding.
        xs = [c["x"] for c in body["corners"]]
        ys = [c["y"] for c in body["corners"]]
        assert min(xs) == 0.0
        assert max(xs) >= 60.0  # ~photo_width, allowing for subsample edge
        assert min(ys) == 0.0
        assert max(ys) >= 60.0
        # Full-wall mask enclosed entirely by BBox → confidence ≈ 1.0.
        assert body["confidence"] > 0.9

    @pytest.mark.asyncio
    async def test_rescales_to_non_square_photo(self, client):
        """Photo dims differ from depth-map dims — API layer rescales."""
        token = await _register(client)
        pid = await _create_project(client, token, photo_w=128, photo_h=96)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
        xs = [c["x"] for c in resp.json()["corners"]]
        ys = [c["y"] for c in resp.json()["corners"]]
        # Corners returned in *photo* pixel coords — must reach toward 128×96
        # bounds, not the estimator's internal 64×64 grid.
        assert max(xs) > 64.0  # > stub depth width
        assert max(ys) > 64.0


# ─── Error envelopes ────────────────────────────────────────────────


class TestAutoPerspectiveErrors:
    @pytest.mark.asyncio
    async def test_cross_user_returns_404(self, client):
        t1 = await _register(client)
        t2 = await _register(client)
        pid = await _create_project(client, t1)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(t2),
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_no_mask_returns_422(self, client):
        token = await _register(client)
        pid = await _create_project(client, token, with_mask=False)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 422
        assert "wall mask" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_no_photo_returns_422(self, client):
        token = await _register(client)
        pid = await _create_project(client, token, with_photo=False)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_mask_returns_422_with_plane_fit_code(self, client):
        """Mask-but-all-False → PlaneFittingService raises `min_mask_pixels`
        branch. Surfaces as 422 + `code: plane_fit_failed`."""
        token = await _register(client)
        pid = await _create_project(client, token, mask_filled=False)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "plane_fit_failed"

    @pytest.mark.asyncio
    async def test_depth_unavailable_returns_503(self, client):
        """DepthEstimator raising DepthEstimationError → 503 +
        `code: depth_unavailable`. Exercises the error-handler wiring."""

        class FailingEstimator(DepthEstimator):
            async def estimate(self, image_bytes: bytes) -> DepthMap:
                raise DepthEstimationError("inference backend unreachable")

        app.dependency_overrides[get_depth_estimator] = lambda: FailingEstimator()
        token = await _register(client)
        pid = await _create_project(client, token)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 503
        body = resp.json()
        assert body["code"] == "depth_unavailable"

    @pytest.mark.asyncio
    async def test_returns_bbox_pixels(self, client):
        """Response must include bbox_pixels so the frontend can seed a
        placeholder calibration from the detected wall width."""
        token = await _register(client)
        pid = await _create_project(client, token, photo_w=64, photo_h=64)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "bbox_pixels" in body
        assert body["bbox_pixels"]["width"] > 0
        assert body["bbox_pixels"]["height"] > 0

    @pytest.mark.asyncio
    async def test_depth_dims_mismatch_surfaces_plane_fit_error(self, client):
        """Sanity: the API layer resizes the mask to the estimator's output
        dims. If a custom estimator returns an oddly-sized depth map, the
        resize still happens — so the happy path holds. Lock this behaviour."""

        class BigEstimator(StubDepthEstimator):
            def __init__(self) -> None:
                super().__init__(width=32, height=32)

        app.dependency_overrides[get_depth_estimator] = lambda: BigEstimator()
        token = await _register(client)
        pid = await _create_project(client, token, photo_w=64, photo_h=64)
        resp = await client.post(
            f"/api/visualizer/projects/{pid}/auto-perspective",
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
        # Corners still in photo coords, not depth coords.
        xs = [c["x"] for c in resp.json()["corners"]]
        assert max(xs) > 32.0  # > the 32-px depth-map width


# ─── Inline variant (no project_id) ────────────────────────────────────


class TestAutoPerspectiveInline:
    """Inline endpoint runs the same pipeline but accepts photo/mask in the
    request body. Used by the frontend immediately after photo upload, before
    any project has been persisted."""

    @pytest.mark.asyncio
    async def test_inline_happy_path(self, client):
        token = await _register(client)
        body = {
            "photo_url": _DATA_URL,
            "photo_width": 64,
            "photo_height": 64,
            "wall_mask_base64": _make_mask(64, 64, True),
        }
        resp = await client.post(
            "/api/visualizer/projects/auto-perspective",
            json=body,
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data["corners"]) == 4
        assert data["confidence"] > 0.9
        assert data["bbox_pixels"]["width"] > 0

    @pytest.mark.asyncio
    async def test_inline_requires_auth(self, client):
        body = {
            "photo_url": _DATA_URL,
            "photo_width": 64,
            "photo_height": 64,
            "wall_mask_base64": _make_mask(64, 64, True),
        }
        # No Authorization header.
        resp = await client.post(
            "/api/visualizer/projects/auto-perspective", json=body
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_inline_invalid_mask_size_returns_422(self, client):
        token = await _register(client)
        # Mask declared 64×64 but we send bytes for 32×32 — API layer rejects.
        body = {
            "photo_url": _DATA_URL,
            "photo_width": 64,
            "photo_height": 64,
            "wall_mask_base64": _make_mask(32, 32, True),
        }
        resp = await client.post(
            "/api/visualizer/projects/auto-perspective",
            json=body,
            headers=_auth(token),
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_inline_depth_unavailable_returns_503(self, client):
        class FailingEstimator(DepthEstimator):
            async def estimate(self, image_bytes: bytes) -> DepthMap:
                raise DepthEstimationError("inference backend unreachable")

        app.dependency_overrides[get_depth_estimator] = lambda: FailingEstimator()
        token = await _register(client)
        body = {
            "photo_url": _DATA_URL,
            "photo_width": 64,
            "photo_height": 64,
            "wall_mask_base64": _make_mask(64, 64, True),
        }
        resp = await client.post(
            "/api/visualizer/projects/auto-perspective",
            json=body,
            headers=_auth(token),
        )
        assert resp.status_code == 503
        assert resp.json()["code"] == "depth_unavailable"
