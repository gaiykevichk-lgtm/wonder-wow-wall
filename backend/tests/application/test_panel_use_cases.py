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
