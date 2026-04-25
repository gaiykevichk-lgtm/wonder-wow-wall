"""Phase 10 — public `GET /api/recommendations/{source_type}/{source_id}` test.

Verifies the composition rule: admin manual targets first, fallback
heuristic fills the remainder up to `limit`. The endpoint must always
return 200 + a list — even when the source has no curation and no
seeded design — so the catalog UI never has to special-case errors.
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_recommendation_repo
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    _mem_recommendation_repo._recs.clear()
    yield
    _mem_recommendation_repo._recs.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _seed_curation(
    *, source_id: str, target_ids: list[str],
) -> None:
    rec = Recommendation(
        source_type=RecommendationSourceType.DESIGN,
        source_id=source_id,
        targets=[
            RecommendationTarget(
                target_type=RecommendationTargetType.DESIGN,
                target_id=tid,
            )
            for tid in target_ids
        ],
    )
    await _mem_recommendation_repo.save(rec)


class TestPublicRecommendations:
    @pytest.mark.asyncio
    async def test_no_auth_required(self, client):
        # Endpoint is public — no Authorization header attached.
        resp = await client.get("/api/recommendations/design/d-1?limit=3")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_curation_first(self, client):
        # When admin curation exists, manual targets land at the head of
        # the list and the fallback fills the tail up to `limit`.
        await _seed_curation(source_id="d-1", target_ids=["d-2", "d-3"])
        resp = await client.get("/api/recommendations/design/d-1?limit=4")
        assert resp.status_code == 200
        items = resp.json()["items"]
        # First two slots come from manual curation, in admin order.
        assert items[0]["target_id"] == "d-2"
        assert items[1]["target_id"] == "d-3"
        # Total respects the requested limit.
        assert len(items) <= 4

    @pytest.mark.asyncio
    async def test_no_curation_falls_back_to_heuristic(self, client):
        # No row stored for d-1 → use case still returns 200 with the
        # fallback-only list (popular/category siblings from SEED_DESIGNS).
        resp = await client.get("/api/recommendations/design/d-1?limit=3")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        # Source itself MUST NOT appear in the rail.
        for item in body["items"]:
            assert item["target_id"] != "d-1"

    @pytest.mark.asyncio
    async def test_unknown_source_id_still_returns_list(self, client):
        # No catastrophic failure for a source that doesn't exist in
        # the catalog — the rail simply renders the fallback bucket.
        resp = await client.get(
            "/api/recommendations/design/never-seen?limit=3",
        )
        assert resp.status_code == 200
        assert "items" in resp.json()

    @pytest.mark.asyncio
    async def test_bad_source_type_422(self, client):
        # Uniform 422 envelope (same as the admin route) — frontend
        # branches on a single status code for shape errors.
        resp = await client.get("/api/recommendations/banana/x?limit=3")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_curation_dedup_excludes_self(self, client):
        # Even if the fallback would surface the source itself, the
        # endpoint MUST NOT — the use case adds the source to the
        # exclude set as a safety net.
        resp = await client.get("/api/recommendations/design/d-1?limit=12")
        for item in resp.json()["items"]:
            assert item["target_id"] != "d-1"

    @pytest.mark.asyncio
    async def test_payload_shape(self, client):
        await _seed_curation(source_id="d-1", target_ids=["d-2"])
        resp = await client.get("/api/recommendations/design/d-1?limit=2")
        item = resp.json()["items"][0]
        # Pin the schema so a future addition is deliberate.
        assert set(item.keys()) == {"target_type", "target_id"}

    @pytest.mark.asyncio
    async def test_cache_control_set(self, client):
        # Public rail is cacheable for 5 minutes — admin curation is
        # rare and the fallback is deterministic. Pin the directive so a
        # future change to the header is deliberate.
        resp = await client.get("/api/recommendations/design/d-1?limit=3")
        assert resp.headers.get("cache-control") == "public, max-age=300"

    @pytest.mark.asyncio
    async def test_curation_alone_is_enough(self, client):
        # When the manual list is already at/above the requested limit,
        # the fallback should be skipped entirely.
        await _seed_curation(
            source_id="d-1", target_ids=["d-2", "d-3", "d-4"],
        )
        resp = await client.get("/api/recommendations/design/d-1?limit=2")
        items = resp.json()["items"]
        assert len(items) == 2
        assert [i["target_id"] for i in items] == ["d-2", "d-3"]
