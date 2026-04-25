"""Phase 7A — Category + Design admin CRUD use case tests.

Uses `InMemoryCategoryRepository` + `InMemoryDesignRepository` so the
tests stay fast and free of an actual DB. We exercise:
  * Categories: Create / Update / Delete (with in-use guard) / List with counts
  * Designs:    Create / Update / Toggle visibility / Delete (with cascade)
  * Public filter: published-only listing (regression for visibility flag)
"""
from __future__ import annotations

import pytest

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.admin_use_cases import (
    CreateCategoryAdmin,
    CreateDesignAdmin,
    DeleteCategoryAdmin,
    DeleteDesignAdmin,
    ListCategoriesAdmin,
    ListDesignsAdmin,
    ToggleDesignVisibilityAdmin,
    UpdateCategoryAdmin,
    UpdateDesignAdmin,
)
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
)
from app.application.catalog.use_cases import ListDesigns
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.catalog_exceptions import (
    CategoryInUseError,
    CategoryNotFoundError,
    CategorySlugConflictError,
    DesignNotFoundError,
    DesignSlugConflictError,
)
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.domain.catalog.value_objects import Color
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
    InMemoryCategoryRepository,
    InMemoryDesignRepository,
    InMemoryRecommendationRepository,
)


# ─── Fixtures ───────────────────────────────────────────────────────


@pytest.fixture
def design_repo():
    return InMemoryDesignRepository()


@pytest.fixture
def category_repo(design_repo):
    return InMemoryCategoryRepository(
        designs_source=lambda: design_repo._designs,
    )


@pytest.fixture
def audit_repo():
    return InMemoryAuditEntryRepository()


@pytest.fixture
def rec_repo():
    return InMemoryRecommendationRepository()


# ═══════════════════════════════════════════════════════════════════════
# Categories
# ═══════════════════════════════════════════════════════════════════════


class TestCreateCategoryAdmin:
    @pytest.mark.asyncio
    async def test_happy_path(self, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(
            name="Природа", slug="nature", image="/img/n.jpg",
        )
        assert c.id
        assert c.slug == "nature"
        assert c.name == "Природа"

    @pytest.mark.asyncio
    async def test_empty_slug_rejected(self, category_repo):
        with pytest.raises(ValueError, match="slug"):
            await CreateCategoryAdmin(category_repo).execute(
                name="x", slug="",
            )

    @pytest.mark.asyncio
    async def test_empty_name_rejected(self, category_repo):
        with pytest.raises(ValueError, match="name"):
            await CreateCategoryAdmin(category_repo).execute(
                name="", slug="x",
            )

    @pytest.mark.asyncio
    async def test_slug_conflict(self, category_repo):
        await CreateCategoryAdmin(category_repo).execute(name="A", slug="dup")
        with pytest.raises(CategorySlugConflictError):
            await CreateCategoryAdmin(category_repo).execute(
                name="B", slug="dup",
            )


class TestUpdateCategoryAdmin:
    @pytest.mark.asyncio
    async def test_patch_only_name(self, category_repo):
        original = await CreateCategoryAdmin(category_repo).execute(
            name="Old", slug="orig", image="/old.jpg",
        )
        updated = await UpdateCategoryAdmin(category_repo).execute(
            category_id=original.id, name="New",
        )
        assert updated.name == "New"
        assert updated.slug == "orig"
        assert updated.image == "/old.jpg"

    @pytest.mark.asyncio
    async def test_clear_image(self, category_repo):
        original = await CreateCategoryAdmin(category_repo).execute(
            name="x", slug="cl", image="/img.jpg",
        )
        updated = await UpdateCategoryAdmin(category_repo).execute(
            category_id=original.id, image="",
        )
        assert updated.image == ""

    @pytest.mark.asyncio
    async def test_unknown_id(self, category_repo):
        with pytest.raises(CategoryNotFoundError):
            await UpdateCategoryAdmin(category_repo).execute(
                category_id="missing", name="x",
            )

    @pytest.mark.asyncio
    async def test_slug_conflict(self, category_repo):
        await CreateCategoryAdmin(category_repo).execute(name="A", slug="taken")
        b = await CreateCategoryAdmin(category_repo).execute(name="B", slug="free")
        with pytest.raises(CategorySlugConflictError):
            await UpdateCategoryAdmin(category_repo).execute(
                category_id=b.id, slug="taken",
            )

    @pytest.mark.asyncio
    async def test_self_alias_no_409(self, category_repo):
        # Saving the modal with the slug unchanged must NOT trip the
        # uniqueness check against the row's own current slug.
        c = await CreateCategoryAdmin(category_repo).execute(name="A", slug="self")
        updated = await UpdateCategoryAdmin(category_repo).execute(
            category_id=c.id, slug="self", name="A2",
        )
        assert updated.name == "A2"


class TestDeleteCategoryAdmin:
    @pytest.mark.asyncio
    async def test_happy_path(self, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="d")
        ok = await DeleteCategoryAdmin(category_repo).execute(c.id)
        assert ok is True
        assert await category_repo.get_by_id(c.id) is None

    @pytest.mark.asyncio
    async def test_missing_returns_false(self, category_repo):
        assert (
            await DeleteCategoryAdmin(category_repo).execute("missing")
        ) is False

    @pytest.mark.asyncio
    async def test_in_use_409(self, category_repo, design_repo):
        # Create a category with an attached design — refusal expected.
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="cat")
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="d1", slug="d1", category_id=c.id, price=100,
        )
        with pytest.raises(CategoryInUseError):
            await DeleteCategoryAdmin(category_repo).execute(c.id)


class TestListCategoriesAdmin:
    @pytest.mark.asyncio
    async def test_includes_design_counts(self, category_repo, design_repo):
        a = await CreateCategoryAdmin(category_repo).execute(name="A", slug="a")
        b = await CreateCategoryAdmin(category_repo).execute(name="B", slug="b")
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="d1", slug="d1", category_id=a.id, price=100,
        )
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="d2", slug="d2", category_id=a.id, price=100,
        )
        rows = await ListCategoriesAdmin(category_repo).execute()
        counts = {c.id: n for (c, n) in rows}
        assert counts[a.id] == 2
        assert counts[b.id] == 0


# ═══════════════════════════════════════════════════════════════════════
# Designs — Create + Update + Toggle
# ═══════════════════════════════════════════════════════════════════════


class TestCreateDesignAdmin:
    @pytest.mark.asyncio
    async def test_happy_path(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="Nat", slug="nat")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="Лес", slug="forest", category_id=c.id, price=1500,
            colors=[Color("#0f0", "Зелёный")],
        )
        assert d.id
        assert d.slug == "forest"
        assert d.category_id == c.id
        assert d.is_published is True

    @pytest.mark.asyncio
    async def test_unknown_category_404(self, design_repo, category_repo):
        with pytest.raises(CategoryNotFoundError):
            await CreateDesignAdmin(design_repo, category_repo).execute(
                name="x", slug="x", category_id="missing", price=100,
            )

    @pytest.mark.asyncio
    async def test_slug_conflict(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="dup", category_id=c.id, price=100,
        )
        with pytest.raises(DesignSlugConflictError):
            await CreateDesignAdmin(design_repo, category_repo).execute(
                name="B", slug="dup", category_id=c.id, price=200,
            )

    @pytest.mark.asyncio
    async def test_negative_price_rejected(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        with pytest.raises(ValueError, match="price"):
            await CreateDesignAdmin(design_repo, category_repo).execute(
                name="A", slug="np", category_id=c.id, price=-1,
            )


class TestUpdateDesignAdmin:
    @pytest.mark.asyncio
    async def test_patch_only_price(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        original = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="up", category_id=c.id, price=100,
        )
        updated = await UpdateDesignAdmin(design_repo, category_repo).execute(
            design_id=original.id, price=999,
        )
        assert updated.price == 999
        assert updated.name == "A"
        assert updated.slug == "up"

    @pytest.mark.asyncio
    async def test_change_category(self, design_repo, category_repo):
        c1 = await CreateCategoryAdmin(category_repo).execute(name="A", slug="a1")
        c2 = await CreateCategoryAdmin(category_repo).execute(name="B", slug="b1")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="x", slug="d", category_id=c1.id, price=100,
        )
        updated = await UpdateDesignAdmin(design_repo, category_repo).execute(
            design_id=d.id, category_id=c2.id,
        )
        assert updated.category_id == c2.id

    @pytest.mark.asyncio
    async def test_change_to_unknown_category_404(
        self, design_repo, category_repo,
    ):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="a", category_id=c.id, price=100,
        )
        with pytest.raises(CategoryNotFoundError):
            await UpdateDesignAdmin(design_repo, category_repo).execute(
                design_id=d.id, category_id="missing",
            )

    @pytest.mark.asyncio
    async def test_unknown_design_404(self, design_repo, category_repo):
        with pytest.raises(DesignNotFoundError):
            await UpdateDesignAdmin(design_repo, category_repo).execute(
                design_id="missing", price=100,
            )

    @pytest.mark.asyncio
    async def test_slug_conflict(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="taken", category_id=c.id, price=100,
        )
        b = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="B", slug="free", category_id=c.id, price=100,
        )
        with pytest.raises(DesignSlugConflictError):
            await UpdateDesignAdmin(design_repo, category_repo).execute(
                design_id=b.id, slug="taken",
            )


class TestToggleDesignVisibilityAdmin:
    @pytest.mark.asyncio
    async def test_flip(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="a", category_id=c.id, price=100,
        )
        assert d.is_published is True
        d2 = await ToggleDesignVisibilityAdmin(design_repo).execute(d.id)
        assert d2.is_published is False
        d3 = await ToggleDesignVisibilityAdmin(design_repo).execute(d.id)
        assert d3.is_published is True

    @pytest.mark.asyncio
    async def test_unknown(self, design_repo):
        with pytest.raises(DesignNotFoundError):
            await ToggleDesignVisibilityAdmin(design_repo).execute("missing")


# ═══════════════════════════════════════════════════════════════════════
# Designs — Delete + cascade + audit
# ═══════════════════════════════════════════════════════════════════════


class TestDeleteDesignAdmin:
    @pytest.mark.asyncio
    async def test_happy_path(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="del", category_id=c.id, price=100,
        )
        ok = await DeleteDesignAdmin(design_repo).execute(d.id)
        assert ok is True
        assert await design_repo.get_by_id(d.id) is None

    @pytest.mark.asyncio
    async def test_missing(self, design_repo):
        ok = await DeleteDesignAdmin(design_repo).execute("missing")
        assert ok is False

    @pytest.mark.asyncio
    async def test_audit_recorded_on_success(
        self, design_repo, category_repo, audit_repo,
    ):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="aud", category_id=c.id, price=100,
        )
        ok = await DeleteDesignAdmin(
            design_repo,
            audit_recorder=RecordAuditEntry(audit_repo),
        ).execute(d.id, actor_id="admin-1")
        assert ok is True
        assert len(audit_repo._entries) == 1
        entry = audit_repo._entries[0]
        assert entry.actor_id == "admin-1"
        assert entry.action == AuditAction.DESIGN_DELETE
        assert entry.target_type == AuditTargetType.DESIGN
        assert entry.target_id == d.id
        assert entry.payload["name"] == "A"
        assert entry.payload["slug"] == "aud"

    @pytest.mark.asyncio
    async def test_audit_skipped_on_miss(self, design_repo, audit_repo):
        ok = await DeleteDesignAdmin(
            design_repo,
            audit_recorder=RecordAuditEntry(audit_repo),
        ).execute("missing", actor_id="admin-1")
        assert ok is False
        assert audit_repo._entries == []

    @pytest.mark.asyncio
    async def test_audit_skipped_without_actor(
        self, design_repo, category_repo, audit_repo,
    ):
        # CLI seeder / legacy callers without actor context: action runs,
        # audit row is skipped (entry would fail invariant).
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="na", category_id=c.id, price=100,
        )
        ok = await DeleteDesignAdmin(
            design_repo,
            audit_recorder=RecordAuditEntry(audit_repo),
        ).execute(d.id)
        assert ok is True
        assert audit_repo._entries == []

    @pytest.mark.asyncio
    async def test_recommendation_cleanup_runs(
        self, design_repo, category_repo, rec_repo, audit_repo,
    ):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="cas", category_id=c.id, price=100,
        )
        # Pre-load a recommendation aggregate for this design as source.
        rec = Recommendation(
            source_type=RecommendationSourceType.DESIGN,
            source_id=d.id,
            targets=[
                RecommendationTarget(
                    target_type=RecommendationTargetType.DESIGN,
                    target_id="other",
                ),
            ],
        )
        await rec_repo.save(rec)
        assert await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, d.id,
        ) is not None

        ok = await DeleteDesignAdmin(
            design_repo,
            audit_recorder=RecordAuditEntry(audit_repo),
            recommendation_cleanup=CleanupRecommendationsOnDelete(rec_repo),
        ).execute(d.id, actor_id="admin-1")
        assert ok is True
        # Source aggregate is dropped.
        assert await rec_repo.find_by_source(
            RecommendationSourceType.DESIGN, d.id,
        ) is None
        # Audit payload contains the cascade report.
        assert "recommendations_cleanup" in audit_repo._entries[0].payload


# ═══════════════════════════════════════════════════════════════════════
# Public catalog visibility regression
# ═══════════════════════════════════════════════════════════════════════


class TestPublicCatalogFiltersUnpublished:
    @pytest.mark.asyncio
    async def test_unpublished_hidden_in_public(
        self, design_repo, category_repo,
    ):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        published = await CreateDesignAdmin(
            design_repo, category_repo,
        ).execute(name="A", slug="pub", category_id=c.id, price=100,
                  is_published=True)
        unpublished = await CreateDesignAdmin(
            design_repo, category_repo,
        ).execute(name="B", slug="hid", category_id=c.id, price=200,
                  is_published=False)

        items, total = await ListDesigns(design_repo).execute()
        slugs = {d.slug for d in items}
        assert "pub" in slugs
        assert "hid" not in slugs
        assert total == 1

    @pytest.mark.asyncio
    async def test_admin_sees_both(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="a", category_id=c.id, price=100,
            is_published=True,
        )
        await CreateDesignAdmin(design_repo, category_repo).execute(
            name="B", slug="b", category_id=c.id, price=100,
            is_published=False,
        )
        items, total = await ListDesignsAdmin(design_repo).execute()
        assert total == 2
        assert {d.slug for d in items} == {"a", "b"}

    @pytest.mark.asyncio
    async def test_toggle_round_trip(self, design_repo, category_repo):
        c = await CreateCategoryAdmin(category_repo).execute(name="x", slug="x")
        d = await CreateDesignAdmin(design_repo, category_repo).execute(
            name="A", slug="rt", category_id=c.id, price=100,
        )
        # Public visible.
        items, _ = await ListDesigns(design_repo).execute()
        assert any(x.slug == "rt" for x in items)
        # Hide.
        await ToggleDesignVisibilityAdmin(design_repo).execute(d.id)
        items, _ = await ListDesigns(design_repo).execute()
        assert not any(x.slug == "rt" for x in items)
        # Show again.
        await ToggleDesignVisibilityAdmin(design_repo).execute(d.id)
        items, _ = await ListDesigns(design_repo).execute()
        assert any(x.slug == "rt" for x in items)
