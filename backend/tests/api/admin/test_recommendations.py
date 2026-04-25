"""Phase 10 — `/api/admin/recommendations` integration tests.

Same shape as `test_panels.py`: in-memory repos via `USE_MEMORY_REPOS=true`
(set by root conftest), full ASGI stack via httpx ASGITransport.

Coverage:
  * Auth gate (401 / 403 vs admin token).
  * GET detail — empty aggregate when no curation, 200 + targets when set.
  * PUT upsert — fresh + overwrite paths, idempotent re-PUT.
  * Domain → HTTP error mapping (self-ref, dup, limit) lands at 422 with
    the stable `code` keys the global handlers register.
  * DELETE — 204 + 404 on a second call (idempotency exposed as feedback).
  * GET list — page/size pagination, has_manual filter, source_type filter.
  * Audit retrofit — UPSERT and DELETE land in the in-memory audit log
    with composite `target_id` (`{source_type}:{source_id}`).
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_audit_repo,
    _mem_recommendation_repo,
    _mem_shop_settings_repo,
)
from app.container import user_repo as _mem_user_repo
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_recommendation_repo._recs.clear()
    _mem_audit_repo._entries.clear()
    # Ensure settings is at the default singleton so the limit assertion
    # uses the documented baseline (12). The shop_settings repo lazily
    # creates the row on first read; we just clear any prior mutation.
    from app.domain.shop.settings import ShopSettings
    _mem_shop_settings_repo._settings = ShopSettings()
    yield
    _mem_user_repo._users.clear()
    _mem_recommendation_repo._recs.clear()
    _mem_audit_repo._entries.clear()
    _mem_shop_settings_repo._settings = ShopSettings()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Auth helpers (lifted from test_panels.py) ───────────────────────


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


def _t(target_id: str, target_type: str = "design") -> dict:
    return {"target_type": target_type, "target_id": target_id}


# ─── Auth gate ───────────────────────────────────────────────────────


class TestAuthGate:
    @pytest.mark.asyncio
    async def test_list_unauthenticated_401(self, client):
        resp = await client.get("/api/admin/recommendations")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_list_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.get(
            "/api/admin/recommendations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_put_customer_403(self, client):
        token = await _customer_token(client)
        resp = await client.put(
            "/api/admin/recommendations/design/abc",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": []},
        )
        assert resp.status_code == 403


# ─── GET detail ──────────────────────────────────────────────────────


class TestGetDetail:
    @pytest.mark.asyncio
    async def test_missing_returns_empty_aggregate(self, client):
        # The editor expects an empty payload (200) so it can render
        # without a 404 special-case branch. `id` is "" sentinel.
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/recommendations/design/never-seen",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == ""
        assert body["source_type"] == "design"
        assert body["source_id"] == "never-seen"
        assert body["targets"] == []

    @pytest.mark.asyncio
    async def test_returns_curation_after_put(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a"), _t("b")]},
        )
        resp = await client.get(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"]  # surrogate id assigned
        assert [t["target_id"] for t in body["targets"]] == ["a", "b"]

    @pytest.mark.asyncio
    async def test_bad_source_type_422(self, client):
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/recommendations/banana/abc",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


# ─── PUT upsert ──────────────────────────────────────────────────────


class TestUpsert:
    @pytest.mark.asyncio
    async def test_fresh_insert(self, client):
        token = await _admin_token(client)
        resp = await client.put(
            "/api/admin/recommendations/design/new",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x"), _t("y")]},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert [t["target_id"] for t in body["targets"]] == ["x", "y"]
        assert body["source_id"] == "new"

    @pytest.mark.asyncio
    async def test_overwrite_replaces_wholesale(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a"), _t("b"), _t("c")]},
        )
        # PUT with a smaller list — stale targets are gone.
        resp = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("z")]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert [t["target_id"] for t in body["targets"]] == ["z"]

    @pytest.mark.asyncio
    async def test_idempotent_repeat(self, client):
        # Same body twice → identical state, no duplication.
        token = await _admin_token(client)
        body = {"targets": [_t("a"), _t("b")]}
        first = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json=body,
        )
        second = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json=body,
        )
        assert first.status_code == 200
        assert second.status_code == 200
        # Surrogate id is preserved across re-PUT (update path, not insert).
        assert first.json()["id"] == second.json()["id"]
        assert second.json()["targets"] == first.json()["targets"]

    @pytest.mark.asyncio
    async def test_self_reference_422(self, client):
        token = await _admin_token(client)
        resp = await client.put(
            "/api/admin/recommendations/design/self",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("self")]},
        )
        assert resp.status_code == 422
        assert resp.json()["code"] == "self_reference"

    @pytest.mark.asyncio
    async def test_duplicate_target_422(self, client):
        token = await _admin_token(client)
        resp = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a"), _t("a")]},
        )
        assert resp.status_code == 422
        assert resp.json()["code"] == "duplicate_target"

    @pytest.mark.asyncio
    async def test_limit_exceeded_422(self, client):
        # Default limit is 12 (DEFAULT_RECOMMENDATIONS_LIMIT). Push 13.
        token = await _admin_token(client)
        targets = [_t(f"d{i}") for i in range(13)]
        resp = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": targets},
        )
        assert resp.status_code == 422
        assert resp.json()["code"] == "limit_exceeded"

    @pytest.mark.asyncio
    async def test_bad_target_type_422(self, client):
        token = await _admin_token(client)
        resp = await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [{"target_type": "banana", "target_id": "x"}]},
        )
        assert resp.status_code == 422


# ─── DELETE ──────────────────────────────────────────────────────────


class TestDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a")]},
        )
        resp = await client.delete(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/recommendations/design/never",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "recommendation_not_found"

    @pytest.mark.asyncio
    async def test_double_delete_first_204_second_404(self, client):
        # The endpoint is idempotent at the data layer (delete-of-missing
        # is a no-op) but exposes the miss as 404 so the admin UI can
        # distinguish "I just deleted it" from "someone else already did".
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a")]},
        )
        first = await client.delete(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
        )
        second = await client.delete(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert first.status_code == 204
        assert second.status_code == 404


# ─── List ────────────────────────────────────────────────────────────


class TestList:
    @pytest.mark.asyncio
    async def test_list_paginated(self, client):
        token = await _admin_token(client)
        for i in range(5):
            await client.put(
                f"/api/admin/recommendations/design/src{i}",
                headers={"Authorization": f"Bearer {token}"},
                json={"targets": [_t(f"t{i}")]},
            )
        resp = await client.get(
            "/api/admin/recommendations?page=1&size=3",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 5
        assert len(body["items"]) == 3
        assert body["page"] == 1
        assert body["size"] == 3

    @pytest.mark.asyncio
    async def test_filter_source_type(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/d1",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("t")]},
        )
        await client.put(
            "/api/admin/recommendations/panel/p1",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("t", "panel")]},
        )
        resp = await client.get(
            "/api/admin/recommendations?source_type=panel",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["source_type"] == "panel"

    @pytest.mark.asyncio
    async def test_filter_has_manual(self, client):
        token = await _admin_token(client)
        # An aggregate WITH targets...
        await client.put(
            "/api/admin/recommendations/design/full",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x")]},
        )
        # ...and one explicitly emptied (replace_all([]) leaves the row).
        await client.put(
            "/api/admin/recommendations/design/empty",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("y")]},
        )
        await client.put(
            "/api/admin/recommendations/design/empty",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": []},
        )
        resp = await client.get(
            "/api/admin/recommendations?has_manual=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # Only the row with at least one target.
        ids = {item["source_id"] for item in body["items"]}
        assert ids == {"full"}


    @pytest.mark.asyncio
    async def test_filter_search_substring_on_source_id(self, client):
        """Phase 10 LOW-6 — substring filter on source_id."""
        token = await _admin_token(client)
        for src_id in ("forest-sunrise", "FOREST-NIGHT", "city-grid"):
            await client.put(
                f"/api/admin/recommendations/design/{src_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"targets": [_t("x-001")]},
            )
        resp = await client.get(
            "/api/admin/recommendations?search=forest",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        ids = {item["source_id"] for item in body["items"]}
        # Both forest rows match (case-insensitive); city does not.
        assert ids == {"forest-sunrise", "FOREST-NIGHT"}
        assert body["total"] == 2

    @pytest.mark.asyncio
    async def test_filter_search_combined_with_source_type(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/forest-sunrise",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x-001")]},
        )
        await client.put(
            "/api/admin/recommendations/panel/forest-panel",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x-001")]},
        )
        resp = await client.get(
            "/api/admin/recommendations?search=forest&source_type=panel",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        # AND-combined: only the panel row survives.
        assert {item["source_id"] for item in body["items"]} == {"forest-panel"}


# ─── Phase 10 LOW-7 — fallback suggestions in admin detail ───────────


class TestFallbackSuggestionsInDetail:
    @pytest.mark.asyncio
    async def test_empty_curation_returns_fallback_suggestions(self, client):
        """LOW-7 — admin lands on a never-curated source and sees the
        heuristic's auto-suggestions so they can one-click accept."""
        from app.container import _mem_design_repo
        from app.domain.catalog.entities import Design

        # Snapshot the seed so we can append + restore without wiping
        # the catalog rows other suites rely on.
        seed = list(_mem_design_repo._designs)
        _mem_design_repo._designs.append(
            Design(id="d-src", name="Src", slug="src", category_id="cat-1")
        )
        _mem_design_repo._designs.append(
            Design(id="d-fb-1", name="FB1", slug="fb-1", category_id="cat-1")
        )
        try:
            token = await _admin_token(client)
            resp = await client.get(
                "/api/admin/recommendations/design/d-src",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["targets"] == []
            # `d-fb-1` is in the same category and not excluded → suggested.
            suggestion_ids = {s["target_id"] for s in body["fallback_suggestions"]}
            assert "d-fb-1" in suggestion_ids
            # Source itself never suggests itself.
            assert "d-src" not in suggestion_ids
        finally:
            _mem_design_repo._designs.clear()
            _mem_design_repo._designs.extend(seed)

    @pytest.mark.asyncio
    async def test_fallback_excludes_existing_curated_targets(self, client):
        from app.container import _mem_design_repo
        from app.domain.catalog.entities import Design
        seed = list(_mem_design_repo._designs)
        _mem_design_repo._designs.append(
            Design(id="d-src2", name="Src", slug="src2", category_id="cat-2")
        )
        _mem_design_repo._designs.append(
            Design(id="d-curated", name="C", slug="c", category_id="cat-2")
        )
        _mem_design_repo._designs.append(
            Design(id="d-fb-2", name="F", slug="f", category_id="cat-2")
        )
        try:
            token = await _admin_token(client)
            # Curate one target.
            await client.put(
                "/api/admin/recommendations/design/d-src2",
                headers={"Authorization": f"Bearer {token}"},
                json={"targets": [{"target_type": "design", "target_id": "d-curated"}]},
            )
            resp = await client.get(
                "/api/admin/recommendations/design/d-src2",
                headers={"Authorization": f"Bearer {token}"},
            )
            body = resp.json()
            suggestion_ids = {s["target_id"] for s in body["fallback_suggestions"]}
            # d-fb-2 is a fresh suggestion; d-curated must be filtered out.
            assert "d-fb-2" in suggestion_ids
            assert "d-curated" not in suggestion_ids
        finally:
            _mem_design_repo._designs.clear()
            _mem_design_repo._designs.extend(seed)


# ─── Phase 10 follow-up — bulk copy from another source ──────────────


class TestCopyFrom:
    @pytest.mark.asyncio
    async def test_copy_replace_overwrites_destination(self, client):
        token = await _admin_token(client)
        # Source A with 2 curated targets.
        await client.put(
            "/api/admin/recommendations/design/A",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x-1"), _t("x-2")]},
        )
        # Destination B with a different curated target.
        await client.put(
            "/api/admin/recommendations/design/B",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("y-9")]},
        )
        resp = await client.post(
            "/api/admin/recommendations/design/B/copy-from",
            headers={"Authorization": f"Bearer {token}"},
            json={"from_source_type": "design", "from_source_id": "A", "mode": "replace"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # Replace overwrites — y-9 is gone; A's order is preserved.
        ids = [t["target_id"] for t in body["targets"]]
        assert ids == ["x-1", "x-2"]

    @pytest.mark.asyncio
    async def test_copy_append_dedupes_and_preserves_existing(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/A",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x-1"), _t("x-2")]},
        )
        await client.put(
            "/api/admin/recommendations/design/B",
            headers={"Authorization": f"Bearer {token}"},
            # Existing y-9 + x-1 (will be deduped against the source).
            json={"targets": [_t("y-9"), _t("x-1")]},
        )
        resp = await client.post(
            "/api/admin/recommendations/design/B/copy-from",
            headers={"Authorization": f"Bearer {token}"},
            json={"from_source_type": "design", "from_source_id": "A", "mode": "append"},
        )
        body = resp.json()
        ids = [t["target_id"] for t in body["targets"]]
        # Existing first (order preserved), then x-2 appended (x-1 dedup).
        assert ids == ["y-9", "x-1", "x-2"]

    @pytest.mark.asyncio
    async def test_copy_from_missing_source_404(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/recommendations/design/B/copy-from",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "from_source_type": "design",
                "from_source_id": "never-curated",
                "mode": "replace",
            },
        )
        assert resp.status_code == 404
        assert resp.json().get("code") == "recommendation_not_found"

    @pytest.mark.asyncio
    async def test_copy_self_to_self_422(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/A",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("x-1")]},
        )
        resp = await client.post(
            "/api/admin/recommendations/design/A/copy-from",
            headers={"Authorization": f"Bearer {token}"},
            json={"from_source_type": "design", "from_source_id": "A", "mode": "replace"},
        )
        assert resp.status_code == 422
        assert resp.json().get("code") == "self_reference"


# ─── Audit retrofit ──────────────────────────────────────────────────


class TestAudit:
    @pytest.mark.asyncio
    async def test_upsert_writes_audit_entry(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a"), _t("b")]},
        )
        # Composite target_id pattern lets a forensics search match
        # either component with a substring filter.
        upsert_entries = [
            e for e in _mem_audit_repo._entries
            if e.action.value == "recommendation_upsert"
        ]
        assert len(upsert_entries) == 1
        assert upsert_entries[0].target_id == "design:src"
        assert upsert_entries[0].payload["targets_count"] == 2

    @pytest.mark.asyncio
    async def test_delete_writes_audit_entry(self, client):
        token = await _admin_token(client)
        await client.put(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
            json={"targets": [_t("a")]},
        )
        await client.delete(
            "/api/admin/recommendations/design/src",
            headers={"Authorization": f"Bearer {token}"},
        )
        delete_entries = [
            e for e in _mem_audit_repo._entries
            if e.action.value == "recommendation_delete"
        ]
        assert len(delete_entries) == 1
        assert delete_entries[0].target_id == "design:src"

    @pytest.mark.asyncio
    async def test_delete_miss_does_not_audit(self, client):
        # Idempotent no-op (no row found) MUST NOT emit an entry —
        # mirrors the rule applied to BlockUserAdmin / DeletePanelAdmin.
        token = await _admin_token(client)
        await client.delete(
            "/api/admin/recommendations/design/never",
            headers={"Authorization": f"Bearer {token}"},
        )
        delete_entries = [
            e for e in _mem_audit_repo._entries
            if e.action.value == "recommendation_delete"
        ]
        assert delete_entries == []
