"""Phase 8B — Banner CRUD use case tests."""
import pytest

from app.application.audit.use_cases import RecordAuditEntry
from app.application.shop.banner_use_cases import (
    CreateBannerAdmin,
    DeleteBannerAdmin,
    GetBannerAdmin,
    ListBannersAdmin,
    ListBannersPublic,
    UpdateBannerAdmin,
)
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
    InMemoryBannerRepository,
)


@pytest.fixture
def repo():
    return InMemoryBannerRepository()


@pytest.fixture
def audit_repo():
    return InMemoryAuditEntryRepository()


class TestCreateBannerAdmin:
    @pytest.mark.asyncio
    async def test_happy(self, repo):
        b = await CreateBannerAdmin(repo).execute(
            title="Hero", image_path="hero.jpg",
        )
        assert b.id
        assert b.title == "Hero"
        assert b.is_active is True

    @pytest.mark.asyncio
    async def test_active_no_image_rejected(self, repo):
        with pytest.raises(ValueError, match="image_path"):
            await CreateBannerAdmin(repo).execute(
                title="x", image_path="", is_active=True,
            )

    @pytest.mark.asyncio
    async def test_inactive_no_image_ok(self, repo):
        b = await CreateBannerAdmin(repo).execute(
            title="draft", image_path="", is_active=False,
        )
        assert b.is_active is False

    @pytest.mark.asyncio
    async def test_empty_title_rejected(self, repo):
        with pytest.raises(ValueError, match="title"):
            await CreateBannerAdmin(repo).execute(title="", image_path="x.jpg")

    @pytest.mark.asyncio
    async def test_negative_priority_rejected(self, repo):
        with pytest.raises(ValueError, match="priority"):
            await CreateBannerAdmin(repo).execute(
                title="x", image_path="x.jpg", priority=-1,
            )


class TestUpdateBannerAdmin:
    @pytest.mark.asyncio
    async def test_patch_title_only(self, repo):
        b = await CreateBannerAdmin(repo).execute(title="A", image_path="a.jpg")
        updated = await UpdateBannerAdmin(repo).execute(
            banner_id=b.id, title="B",
        )
        assert updated.title == "B"
        assert updated.image_path == "a.jpg"

    @pytest.mark.asyncio
    async def test_unknown_id(self, repo):
        with pytest.raises(BannerNotFoundError):
            await UpdateBannerAdmin(repo).execute(
                banner_id="missing", title="x",
            )

    @pytest.mark.asyncio
    async def test_activate_without_image_rejected(self, repo):
        b = await CreateBannerAdmin(repo).execute(
            title="draft", image_path="", is_active=False,
        )
        with pytest.raises(ValueError, match="image_path"):
            await UpdateBannerAdmin(repo).execute(
                banner_id=b.id, is_active=True,
            )

    @pytest.mark.asyncio
    async def test_change_position(self, repo):
        b = await CreateBannerAdmin(repo).execute(title="x", image_path="x.jpg")
        updated = await UpdateBannerAdmin(repo).execute(
            banner_id=b.id, position=BannerPosition.FOOTER,
        )
        assert updated.position == BannerPosition.FOOTER


class TestDeleteBannerAdmin:
    @pytest.mark.asyncio
    async def test_happy(self, repo):
        b = await CreateBannerAdmin(repo).execute(title="x", image_path="x.jpg")
        ok = await DeleteBannerAdmin(repo).execute(b.id)
        assert ok is True
        assert await repo.get_by_id(b.id) is None

    @pytest.mark.asyncio
    async def test_missing(self, repo):
        ok = await DeleteBannerAdmin(repo).execute("missing")
        assert ok is False

    @pytest.mark.asyncio
    async def test_audit_recorded(self, repo, audit_repo):
        b = await CreateBannerAdmin(repo).execute(title="x", image_path="x.jpg")
        await DeleteBannerAdmin(
            repo, audit_recorder=RecordAuditEntry(audit_repo),
        ).execute(b.id, actor_id="admin-1")
        assert len(audit_repo._entries) == 1
        e = audit_repo._entries[0]
        assert e.action == AuditAction.SETTINGS_UPDATE
        assert e.target_type == AuditTargetType.SETTINGS
        assert e.payload["op"] == "banner_delete"
        assert e.payload["title"] == "x"


class TestListBanners:
    @pytest.mark.asyncio
    async def test_admin_sees_inactive(self, repo):
        await CreateBannerAdmin(repo).execute(title="A", image_path="a.jpg")
        await CreateBannerAdmin(repo).execute(
            title="draft", image_path="", is_active=False,
        )
        items = await ListBannersAdmin(repo).execute()
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_public_hides_inactive(self, repo):
        await CreateBannerAdmin(repo).execute(title="A", image_path="a.jpg")
        await CreateBannerAdmin(repo).execute(
            title="draft", image_path="", is_active=False,
        )
        items = await ListBannersPublic(repo).execute()
        assert len(items) == 1
        assert items[0].title == "A"

    @pytest.mark.asyncio
    async def test_position_filter(self, repo):
        await CreateBannerAdmin(repo).execute(
            title="hero", image_path="x.jpg",
            position=BannerPosition.HOMEPAGE_HERO,
        )
        await CreateBannerAdmin(repo).execute(
            title="footer", image_path="x.jpg",
            position=BannerPosition.FOOTER,
        )
        items = await ListBannersAdmin(repo).execute(
            position=BannerPosition.FOOTER,
        )
        assert len(items) == 1
        assert items[0].title == "footer"

    @pytest.mark.asyncio
    async def test_priority_ordering(self, repo):
        # Lower priority first.
        await CreateBannerAdmin(repo).execute(
            title="low-prio-30", image_path="x.jpg", priority=30,
        )
        await CreateBannerAdmin(repo).execute(
            title="high-prio-10", image_path="x.jpg", priority=10,
        )
        items = await ListBannersAdmin(repo).execute()
        assert items[0].title == "high-prio-10"
        assert items[1].title == "low-prio-30"


class TestGetBannerAdmin:
    @pytest.mark.asyncio
    async def test_unknown_raises(self, repo):
        with pytest.raises(BannerNotFoundError):
            await GetBannerAdmin(repo).execute("missing")
