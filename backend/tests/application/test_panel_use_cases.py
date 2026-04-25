"""Phase 7B — Panel admin/public use case tests.

Uses `InMemoryPanelRepository` so the tests stay fast and free of an
actual DB. We exercise:
  * Create — happy path, slug-conflict 409 path, invalid-size guard
  * Update — patch semantics (None = don't touch), slug-conflict, 404
  * Delete — happy path returns True, missing returns False
  * List   — admin sees inactive, public hides them
"""
import pytest

from app.application.catalog.panel_use_cases import (
    CreatePanelAdmin,
    DeletePanelAdmin,
    GetPanelAdmin,
    ListPanelsAdmin,
    ListPanelsPublic,
    UpdatePanelAdmin,
)
from app.domain.catalog.panel import Panel
from app.domain.catalog.panel_exceptions import (
    PanelNotFoundError,
    PanelSlugConflictError,
)
from app.domain.catalog.value_objects import PanelSize
from app.infrastructure.persistence.repositories.memory import InMemoryPanelRepository


def _size(w=300, h=300, label="30×30 см") -> PanelSize:
    return PanelSize(width_mm=w, height_mm=h, label=label)


@pytest.fixture
def repo():
    return InMemoryPanelRepository()


# ─── Create ──────────────────────────────────────────────────────────


class TestCreatePanelAdmin:
    @pytest.mark.asyncio
    async def test_happy_path(self, repo):
        panel = await CreatePanelAdmin(repo).execute(
            name="Маленькая", slug="small", size=_size(),
            base_price=890, description="desc", photo_path="",
            is_active=True,
        )
        assert panel.id
        assert panel.slug == "small"
        # Stored — reload by id.
        again = await repo.get_by_id(panel.id)
        assert again is not None
        assert again.name == "Маленькая"

    @pytest.mark.asyncio
    async def test_empty_slug_rejected(self, repo):
        with pytest.raises(ValueError, match="slug"):
            await CreatePanelAdmin(repo).execute(
                name="x", slug="", size=_size(), base_price=100,
            )

    @pytest.mark.asyncio
    async def test_slug_conflict_raises_domain_exception(self, repo):
        await CreatePanelAdmin(repo).execute(
            name="A", slug="dup", size=_size(), base_price=100,
        )
        with pytest.raises(PanelSlugConflictError):
            await CreatePanelAdmin(repo).execute(
                name="B", slug="dup", size=_size(), base_price=200,
            )


# ─── Update ──────────────────────────────────────────────────────────


class TestUpdatePanelAdmin:
    @pytest.mark.asyncio
    async def test_patch_only_touches_provided_fields(self, repo):
        original = await CreatePanelAdmin(repo).execute(
            name="Old", slug="orig", size=_size(), base_price=100,
            description="desc-old",
        )
        # Touch only the price; everything else stays.
        updated = await UpdatePanelAdmin(repo).execute(
            panel_id=original.id, base_price=999,
        )
        assert updated.base_price == 999
        assert updated.name == "Old"
        assert updated.slug == "orig"
        assert updated.description == "desc-old"

    @pytest.mark.asyncio
    async def test_clear_description_with_empty_string(self, repo):
        # PATCH semantics: "" means "clear", None means "don't touch".
        original = await CreatePanelAdmin(repo).execute(
            name="x", slug="cl", size=_size(), base_price=100,
            description="not-empty",
        )
        updated = await UpdatePanelAdmin(repo).execute(
            panel_id=original.id, description="",
        )
        assert updated.description == ""

    @pytest.mark.asyncio
    async def test_unknown_id_raises_not_found(self, repo):
        with pytest.raises(PanelNotFoundError):
            await UpdatePanelAdmin(repo).execute(
                panel_id="missing", name="x",
            )

    @pytest.mark.asyncio
    async def test_slug_conflict_on_rename(self, repo):
        await CreatePanelAdmin(repo).execute(
            name="A", slug="taken", size=_size(), base_price=100,
        )
        b = await CreatePanelAdmin(repo).execute(
            name="B", slug="free", size=_size(), base_price=100,
        )
        with pytest.raises(PanelSlugConflictError):
            await UpdatePanelAdmin(repo).execute(
                panel_id=b.id, slug="taken",
            )

    @pytest.mark.asyncio
    async def test_self_rename_to_same_slug_no_op(self, repo):
        # Re-saving the modal without touching the slug must not 409.
        a = await CreatePanelAdmin(repo).execute(
            name="A", slug="same", size=_size(), base_price=100,
        )
        again = await UpdatePanelAdmin(repo).execute(
            panel_id=a.id, slug="same", name="renamed",
        )
        assert again.name == "renamed"

    @pytest.mark.asyncio
    async def test_negative_price_rejected_in_patch(self, repo):
        a = await CreatePanelAdmin(repo).execute(
            name="A", slug="np", size=_size(), base_price=100,
        )
        with pytest.raises(ValueError, match="negative"):
            await UpdatePanelAdmin(repo).execute(
                panel_id=a.id, base_price=-5,
            )

    @pytest.mark.asyncio
    async def test_partial_size_patch_composes_from_current(self, repo):
        # Regression: API used to pre-load the row to compose PanelSize
        # (N+1). Now the use case takes individual patch components and
        # fills the missing ones from the current row itself.
        a = await CreatePanelAdmin(repo).execute(
            name="A", slug="ps", size=_size(w=300, h=400, label="orig"),
            base_price=100,
        )
        # Patch only width — height + label come from the existing row.
        updated = await UpdatePanelAdmin(repo).execute(
            panel_id=a.id, width_mm=500,
        )
        assert updated.size.width_mm == 500
        assert updated.size.height_mm == 400
        assert updated.size.label == "orig"

    @pytest.mark.asyncio
    async def test_partial_size_label_only_patch(self, repo):
        # Same regression coverage for the size_label-only branch.
        a = await CreatePanelAdmin(repo).execute(
            name="A", slug="psl", size=_size(w=300, h=400, label="orig"),
            base_price=100,
        )
        updated = await UpdatePanelAdmin(repo).execute(
            panel_id=a.id, size_label="renamed",
        )
        assert updated.size.width_mm == 300
        assert updated.size.height_mm == 400
        assert updated.size.label == "renamed"


# ─── Delete ──────────────────────────────────────────────────────────


class TestDeletePanelAdmin:
    @pytest.mark.asyncio
    async def test_happy_path_returns_true(self, repo):
        a = await CreatePanelAdmin(repo).execute(
            name="A", slug="d", size=_size(), base_price=100,
        )
        ok = await DeletePanelAdmin(repo).execute(a.id)
        assert ok is True
        assert await repo.get_by_id(a.id) is None

    @pytest.mark.asyncio
    async def test_unknown_id_returns_false(self, repo):
        # Same shape as DeleteMedia — API turns False into 404.
        assert await DeletePanelAdmin(repo).execute("missing") is False

    @pytest.mark.asyncio
    async def test_cascade_report_lands_in_audit_payload(self, repo):
        """Phase 10 — when `recommendation_cleanup` is wired in, the
        cascade `(source_dropped, targets_pruned)` report MUST be
        folded into the PANEL_DELETE audit payload under the
        `recommendations_cleanup` key. A forensics search by panel id
        sees the cascade footprint without a separate event.
        """
        from app.application.audit.use_cases import RecordAuditEntry
        from app.application.catalog.recommendation_use_cases import (
            CleanupRecommendationsOnDelete,
        )
        from app.domain.audit.value_objects import AuditAction
        from app.domain.catalog.recommendation import (
            Recommendation,
            RecommendationSourceType,
            RecommendationTarget,
            RecommendationTargetType,
        )
        from app.infrastructure.persistence.repositories.memory import (
            InMemoryAuditEntryRepository,
            InMemoryRecommendationRepository,
        )

        # Seed a panel and recommendation aggregates that list it both
        # as a source AND as a target (in another aggregate).
        panel = await CreatePanelAdmin(repo).execute(
            name="Doomed", slug="doomed", size=_size(), base_price=100,
        )
        rec_repo = InMemoryRecommendationRepository()
        # Source-side: panel `doomed` recommends design d-1.
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.PANEL,
            source_id=panel.id,
            targets=[RecommendationTarget(
                target_type=RecommendationTargetType.DESIGN,
                target_id="d-1",
            )],
        ))
        # Target-side: design d-2 recommends panel `doomed` (and d-3,
        # which must survive the prune).
        await rec_repo.save(Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id="d-2",
            targets=[
                RecommendationTarget(
                    target_type=RecommendationTargetType.PANEL,
                    target_id=panel.id,
                ),
                RecommendationTarget(
                    target_type=RecommendationTargetType.DESIGN,
                    target_id="d-3",
                ),
            ],
        ))

        audit_repo = InMemoryAuditEntryRepository()
        ok = await DeletePanelAdmin(
            repo,
            audit_recorder=RecordAuditEntry(audit_repo),
            recommendation_cleanup=CleanupRecommendationsOnDelete(rec_repo),
        ).execute(panel.id, actor_id="admin-1")
        assert ok is True

        # Audit row exists and carries the cascade report.
        entries = [
            e for e in audit_repo._entries
            if e.action == AuditAction.PANEL_DELETE
        ]
        assert len(entries) == 1
        payload = entries[0].payload
        assert payload["slug"] == "doomed"
        assert "recommendations_cleanup" in payload
        cascade = payload["recommendations_cleanup"]
        assert cascade["source_dropped"] is True
        assert cascade["targets_pruned"] == 1

        # Aggregate state confirms cleanup ran.
        assert await rec_repo.find_by_source(
            RecommendationSourceType.PANEL, panel.id,
        ) is None
        survivor = await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, "d-2",
        )
        assert survivor is not None
        assert [t.target_id for t in survivor.targets] == ["d-3"]

    @pytest.mark.asyncio
    async def test_cascade_skipped_when_collaborator_absent(self, repo):
        """Pre-Phase-10 callers (CLI seeder, legacy tests) construct
        `DeletePanelAdmin` without the cleanup collaborator. The audit
        payload then has NO `recommendations_cleanup` key — keeps the
        forensics row minimal for callers that don't care about the rail.
        """
        from app.application.audit.use_cases import RecordAuditEntry
        from app.domain.audit.value_objects import AuditAction
        from app.infrastructure.persistence.repositories.memory import (
            InMemoryAuditEntryRepository,
        )

        panel = await CreatePanelAdmin(repo).execute(
            name="Solo", slug="solo", size=_size(), base_price=100,
        )
        audit_repo = InMemoryAuditEntryRepository()
        await DeletePanelAdmin(
            repo,
            audit_recorder=RecordAuditEntry(audit_repo),
        ).execute(panel.id, actor_id="admin-1")

        entry = next(
            e for e in audit_repo._entries
            if e.action == AuditAction.PANEL_DELETE
        )
        assert "recommendations_cleanup" not in entry.payload


# ─── List ────────────────────────────────────────────────────────────


class TestListPanels:
    @pytest.mark.asyncio
    async def test_admin_sees_inactive(self, repo):
        await CreatePanelAdmin(repo).execute(
            name="Active", slug="a", size=_size(), base_price=100,
            is_active=True,
        )
        await CreatePanelAdmin(repo).execute(
            name="Hidden", slug="h", size=_size(), base_price=100,
            is_active=False,
        )
        items, total = await ListPanelsAdmin(repo).execute()
        assert total == 2
        assert {p.slug for p in items} == {"a", "h"}

    @pytest.mark.asyncio
    async def test_public_hides_inactive(self, repo):
        await CreatePanelAdmin(repo).execute(
            name="Active", slug="a", size=_size(), base_price=100,
            is_active=True,
        )
        await CreatePanelAdmin(repo).execute(
            name="Hidden", slug="h", size=_size(), base_price=100,
            is_active=False,
        )
        items, total = await ListPanelsPublic(repo).execute()
        assert total == 1
        assert items[0].slug == "a"


# ─── Get ─────────────────────────────────────────────────────────────


class TestGetPanelAdmin:
    @pytest.mark.asyncio
    async def test_happy(self, repo):
        a = await CreatePanelAdmin(repo).execute(
            name="X", slug="g", size=_size(), base_price=100,
        )
        got = await GetPanelAdmin(repo).execute(a.id)
        assert got.id == a.id

    @pytest.mark.asyncio
    async def test_unknown_raises(self, repo):
        with pytest.raises(PanelNotFoundError):
            await GetPanelAdmin(repo).execute("missing")
