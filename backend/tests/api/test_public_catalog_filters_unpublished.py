"""Phase 7A — public `GET /api/designs` regression test.

Hard-checks that unpublished designs (Phase 7A `is_published=False`) do
NOT leak through the public catalog endpoint, regardless of query
parameters. Mirrors `test_panels_public.py`'s posture for inactive
panels.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_design_repo
from app.domain.catalog.entities import Design
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    # Snapshot seed-state so `tests/api/test_api.py::TestCatalog` (which
    # relies on the container-level `SEED_DESIGNS` singleton without
    # explicit re-seeding) is not blown away by this suite's clear().
    # In-place mutation preserves list identity for the
    # `designs_source` lambda in `app/container.py`.
    saved_designs = list(_mem_design_repo._designs)
    _mem_design_repo._designs.clear()
    yield
    _mem_design_repo._designs.clear()
    _mem_design_repo._designs.extend(saved_designs)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _seed(slug: str, *, is_published: bool, category_id="cat-1") -> Design:
    d = Design(
        name=f"D-{slug}",
        slug=slug,
        category_id=category_id,
        style="Природа",
        image=f"/img/{slug}.jpg",
        description="",
        price=1200,
        is_published=is_published,
    )
    _mem_design_repo._designs.append(d)
    return d


class TestPublicListing:
    @pytest.mark.asyncio
    async def test_unpublished_hidden(self, client):
        _seed("visible", is_published=True)
        _seed("hidden", is_published=False)
        resp = await client.get("/api/designs")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        slugs = {item["slug"] for item in body["items"]}
        assert slugs == {"visible"}

    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        _seed("v", is_published=True)
        # Same auth posture as the existing public listing — endpoint
        # never required Authorization, the visibility filter doesn't
        # change that.
        resp = await client.get("/api/designs")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_published_filter_robust_against_known_query_params(self, client):
        # Defence-in-depth: passing the existing filters (category,
        # search, color, style, is_new) must not bypass the published-only
        # constraint.
        _seed("v1", is_published=True, category_id="cat-1")
        _seed("h1", is_published=False, category_id="cat-1")
        resp = await client.get("/api/designs?category=cat-1&sort=name")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["slug"] == "v1"


class TestPublicDetail:
    """Phase 7A C1 — `GET /api/designs/{id}` must NOT leak unpublished
    rows even when the caller knows the UUID. 404 (not 403) so the
    existence of the row is not disclosed either.
    """

    @pytest.mark.asyncio
    async def test_published_detail_200(self, client):
        d = _seed("vis", is_published=True)
        resp = await client.get(f"/api/designs/{d.id}")
        assert resp.status_code == 200
        assert resp.json()["slug"] == "vis"

    @pytest.mark.asyncio
    async def test_unpublished_detail_404(self, client):
        d = _seed("hid", is_published=False)
        resp = await client.get(f"/api/designs/{d.id}")
        # 404 (not 403/200) — existence of the row is concealed.
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_unknown_id_still_404(self, client):
        # Same status code as the unpublished case — caller cannot
        # distinguish "row hidden" from "row never existed".
        resp = await client.get("/api/designs/never-existed-id")
        assert resp.status_code == 404


class TestPublicReviews:
    """Phase 7A C2 — `GET /api/designs/{id}/reviews` mirrors C1: an
    unpublished parent yields 404, not 200 + empty list (which would
    confirm the row exists).
    """

    @pytest.mark.asyncio
    async def test_published_reviews_200(self, client):
        d = _seed("rv", is_published=True)
        resp = await client.get(f"/api/designs/{d.id}/reviews")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_unpublished_reviews_404(self, client):
        d = _seed("rh", is_published=False)
        resp = await client.get(f"/api/designs/{d.id}/reviews")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_unknown_design_404(self, client):
        resp = await client.get("/api/designs/missing-id/reviews")
        assert resp.status_code == 404
