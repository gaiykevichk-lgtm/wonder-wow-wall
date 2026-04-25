"""Phase 10 — Recommendation use case tests.

Coverage:
  * `GetRecommendationAdmin` — None for missing source.
  * `ListRecommendationsAdmin` — pagination clamp + filters.
  * `UpsertRecommendationAdmin` — fresh insert vs overwrite, limit
    fetched from settings, audit emission with composite target_id.
  * `DeleteRecommendationAdmin` — idempotent (no audit on miss).
  * `GetPublicRecommendations` — manual + fallback composition.
  * `CleanupRecommendationsOnDelete` — both passes, exclude orphans.
"""
from __future__ import annotations

import pytest

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
    DeleteRecommendationAdmin,
    GetPublicRecommendations,
    GetRecommendationAdmin,
    ListRecommendationsAdmin,
    RecommendationFallbackProvider,
    UpsertRecommendationAdmin,
)
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationLimitExceededError,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.domain.catalog.repositories import RecommendationFilters
from app.domain.shop.settings import ShopSettings
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
    InMemoryRecommendationRepository,
    InMemoryShopSettingsRepository,
)


# ─── Fixtures / helpers ─────────────────────────────────────────────


def _t(target_id: str, type_=RecommendationTargetType.DESIGN):
    return RecommendationTarget(target_type=type_, target_id=target_id)


@pytest.fixture
def rec_repo():
    return InMemoryRecommendationRepository()


@pytest.fixture
def settings_repo():
    return InMemoryShopSettingsRepository(
        ShopSettings(recommendations_limit_per_source=5),
    )


@pytest.fixture
def audit_repo():
    return InMemoryAuditEntryRepository()


@pytest.fixture
def audit_recorder(audit_repo):
    return RecordAuditEntry(audit_repo)


# ─── GetRecommendationAdmin ─────────────────────────────────────────


class TestGetRecommendationAdmin:
    @pytest.mark.asyncio
    async def test_missing_returns_none(self, rec_repo):
        result = await GetRecommendationAdmin(rec_repo).execute(
            RecommendationSourceType.DESIGN, "missing",
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_existing(self, rec_repo):
        seeded = Recommendation(
            source_type=RecommendationSourceType.PANEL,
            source_id="p1",
            targets=[_t("d1")],
        )
        await rec_repo.save(seeded)
        result = await GetRecommendationAdmin(rec_repo).execute(
            RecommendationSourceType.PANEL, "p1",
        )
        assert result is not None
        assert [t.target_id for t in result.targets] == ["d1"]


# ─── ListRecommendationsAdmin ───────────────────────────────────────


class TestListRecommendationsAdmin:
    @pytest.mark.asyncio
    async def test_filters_and_pagination(self, rec_repo):
        for i in range(7):
            await rec_repo.save(Recommendation(
                source_type=RecommendationSourceType.DESIGN,
                source_id=f"d{i}",
                targets=[_t("x")] if i % 2 == 0 else [],
            ))
        # Page 1, size 3 — 7 total.
        items, total = await ListRecommendationsAdmin(rec_repo).execute(
            RecommendationFilters(), page=1, size=3,
        )
        assert total == 7
        assert len(items) == 3

        # Filter by has_manual=True — only even indices have targets (4 rows).
        items, total = await ListRecommendationsAdmin(rec_repo).execute(
            RecommendationFilters(has_manual=True), page=1, size=10,
        )
        assert total == 4
        assert all(len(r.targets) > 0 for r in items)

    @pytest.mark.asyncio
    async def test_size_clamped_to_max_200(self, rec_repo):
        # Use case clamps oversized requests rather than 422-ing — keeps
        # the admin UI from being able to soft-DOS the API on a bug.
        items, total = await ListRecommendationsAdmin(rec_repo).execute(
            RecommendationFilters(), page=1, size=99999,
        )
        assert total == 0  # empty repo
        assert items == []

    @pytest.mark.asyncio
    async def test_page_clamped_to_minimum_1(self, rec_repo):
        # page=0 → page=1 (no negative offset).
        items, total = await ListRecommendationsAdmin(rec_repo).execute(
            RecommendationFilters(), page=0, size=5,
        )
        assert total == 0
        assert items == []


# ─── UpsertRecommendationAdmin ──────────────────────────────────────


class TestUpsertRecommendationAdmin:
    @pytest.mark.asyncio
    async def test_fresh_insert(self, rec_repo, settings_repo):
        saved = await UpsertRecommendationAdmin(
            rec_repo, settings_repo,
        ).execute(
            actor_id="admin-1",
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            targets=[_t("a"), _t("b")],
        )
        assert [t.target_id for t in saved.targets] == ["a", "b"]
        # Persisted — read-back matches.
        rec = await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, "d1",
        )
        assert rec is not None and len(rec.targets) == 2

    @pytest.mark.asyncio
    async def test_overwrite_replaces(self, rec_repo, settings_repo):
        await UpsertRecommendationAdmin(rec_repo, settings_repo).execute(
            actor_id="admin", source_type=RecommendationSourceType.DESIGN,
            source_id="d1", targets=[_t("a")],
        )
        await UpsertRecommendationAdmin(rec_repo, settings_repo).execute(
            actor_id="admin", source_type=RecommendationSourceType.DESIGN,
            source_id="d1", targets=[_t("b"), _t("c")],
        )
        rec = await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, "d1",
        )
        assert [t.target_id for t in rec.targets] == ["b", "c"]

    @pytest.mark.asyncio
    async def test_limit_from_settings(self, rec_repo, settings_repo):
        # settings_repo fixture caps at 5.
        with pytest.raises(RecommendationLimitExceededError):
            await UpsertRecommendationAdmin(
                rec_repo, settings_repo,
            ).execute(
                actor_id="admin",
                source_type=RecommendationSourceType.DESIGN,
                source_id="d1",
                targets=[_t(f"x{i}") for i in range(6)],
            )

    @pytest.mark.asyncio
    async def test_audit_emission(
        self, rec_repo, settings_repo, audit_repo, audit_recorder,
    ):
        await UpsertRecommendationAdmin(
            rec_repo, settings_repo, audit_recorder=audit_recorder,
        ).execute(
            actor_id="admin-7",
            source_type=RecommendationSourceType.DESIGN,
            source_id="d-source",
            targets=[
                _t("a"),
                _t("p1", RecommendationTargetType.PANEL),
            ],
        )
        assert len(audit_repo._entries) == 1
        entry = audit_repo._entries[0]
        assert entry.action == AuditAction.RECOMMENDATION_UPSERT
        assert entry.target_type == AuditTargetType.RECOMMENDATION
        assert entry.target_id == "design:d-source"
        assert entry.payload["targets_count"] == 2
        assert entry.payload["targets"] == ["design:a", "panel:p1"]

    @pytest.mark.asyncio
    async def test_audit_skipped_without_actor(
        self, rec_repo, settings_repo, audit_repo, audit_recorder,
    ):
        # Calling without actor_id (None) skips audit silently — the
        # use case still saves but the entity invariant on
        # AuditEntry.actor_id would fail an unattributed entry.
        await UpsertRecommendationAdmin(
            rec_repo, settings_repo, audit_recorder=audit_recorder,
        ).execute(
            actor_id=None,
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            targets=[_t("a")],
        )
        assert audit_repo._entries == []


# ─── DeleteRecommendationAdmin ──────────────────────────────────────


class TestDeleteRecommendationAdmin:
    @pytest.mark.asyncio
    async def test_happy_path_audited(
        self, rec_repo, audit_repo, audit_recorder,
    ):
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1", targets=[_t("a")],
        ))
        deleted = await DeleteRecommendationAdmin(
            rec_repo, audit_recorder=audit_recorder,
        ).execute(
            actor_id="admin",
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
        )
        assert deleted is True
        assert len(audit_repo._entries) == 1
        assert audit_repo._entries[0].action == AuditAction.RECOMMENDATION_DELETE

    @pytest.mark.asyncio
    async def test_idempotent_miss_not_audited(
        self, rec_repo, audit_repo, audit_recorder,
    ):
        deleted = await DeleteRecommendationAdmin(
            rec_repo, audit_recorder=audit_recorder,
        ).execute(
            actor_id="admin",
            source_type=RecommendationSourceType.DESIGN,
            source_id="missing",
        )
        assert deleted is False
        assert audit_repo._entries == []


# ─── GetPublicRecommendations + fallback ────────────────────────────


class _FakeFallback(RecommendationFallbackProvider):
    """Tiny dict-backed fallback for tests."""

    def __init__(self, suggestions: list[RecommendationTarget]):
        self.suggestions = suggestions
        self.last_exclude: set | None = None
        self.last_limit: int | None = None

    async def suggest(
        self, source_type, source_id, *, limit, exclude,
    ) -> list[RecommendationTarget]:
        self.last_exclude = set(exclude)
        self.last_limit = limit
        # Filter out anything the caller already has.
        out: list[RecommendationTarget] = []
        for s in self.suggestions:
            key = (s.target_type, s.target_id)
            if key in exclude:
                continue
            out.append(s)
            if len(out) >= limit:
                break
        return out


class TestGetPublicRecommendations:
    @pytest.mark.asyncio
    async def test_manual_only_when_full(self, rec_repo):
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            targets=[_t("a"), _t("b"), _t("c")],
        ))
        fb = _FakeFallback([_t("never")])
        out = await GetPublicRecommendations(rec_repo, fb).execute(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            limit=3,
        )
        assert [t.target_id for t in out] == ["a", "b", "c"]
        # Fallback should not have been called.
        assert fb.last_limit is None

    @pytest.mark.asyncio
    async def test_fallback_fills_tail(self, rec_repo):
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            targets=[_t("a")],
        ))
        fb = _FakeFallback([_t("b"), _t("c"), _t("d")])
        out = await GetPublicRecommendations(rec_repo, fb).execute(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            limit=3,
        )
        assert [t.target_id for t in out] == ["a", "b", "c"]
        # Manual + source_self in exclude.
        assert (RecommendationTargetType.DESIGN, "a") in fb.last_exclude
        assert (RecommendationTargetType.DESIGN, "d1") in fb.last_exclude

    @pytest.mark.asyncio
    async def test_no_curation_uses_fallback_only(self, rec_repo):
        fb = _FakeFallback([_t("x"), _t("y")])
        out = await GetPublicRecommendations(rec_repo, fb).execute(
            source_type=RecommendationSourceType.DESIGN,
            source_id="missing",
            limit=2,
        )
        assert [t.target_id for t in out] == ["x", "y"]

    @pytest.mark.asyncio
    async def test_limit_zero_returns_empty(self, rec_repo):
        fb = _FakeFallback([_t("x")])
        out = await GetPublicRecommendations(rec_repo, fb).execute(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            limit=0,
        )
        assert out == []


# ─── CleanupRecommendationsOnDelete ─────────────────────────────────


class TestCleanupRecommendationsOnDelete:
    @pytest.mark.asyncio
    async def test_drops_source_aggregate(self, rec_repo):
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.PANEL,
            source_id="p-deleted",
            targets=[_t("a")],
        ))
        report = await CleanupRecommendationsOnDelete(rec_repo).execute(
            RecommendationSourceType.PANEL, "p-deleted",
        )
        assert report["source_dropped"] is True
        # Aggregate gone.
        assert await rec_repo.find_by_source(
            RecommendationSourceType.PANEL, "p-deleted",
        ) is None

    @pytest.mark.asyncio
    async def test_prunes_targets_in_other_aggregates(self, rec_repo):
        # Two aggregates list the soon-to-be-deleted panel as a target.
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d1",
            targets=[
                _t("p-deleted", RecommendationTargetType.PANEL),
                _t("d2"),
            ],
        ))
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d3",
            targets=[
                _t("p-deleted", RecommendationTargetType.PANEL),
            ],
        ))
        report = await CleanupRecommendationsOnDelete(rec_repo).execute(
            RecommendationSourceType.PANEL, "p-deleted",
        )
        assert report["targets_pruned"] == 2
        # d1 keeps d2, d3 is left empty.
        d1 = await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, "d1",
        )
        assert [t.target_id for t in d1.targets] == ["d2"]
        d3 = await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, "d3",
        )
        assert d3.targets == []

    @pytest.mark.asyncio
    async def test_idempotent_no_state_change(self, rec_repo):
        report = await CleanupRecommendationsOnDelete(rec_repo).execute(
            RecommendationSourceType.PANEL, "never-existed",
        )
        assert report == {"source_dropped": False, "targets_pruned": 0}
