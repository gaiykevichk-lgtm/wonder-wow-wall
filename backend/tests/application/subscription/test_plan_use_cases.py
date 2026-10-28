"""Phase 8C — Subscription plan CRUD use case tests."""
from datetime import datetime, timedelta

import pytest

from app.application.audit.use_cases import RecordAuditEntry
from app.application.subscription.plan_use_cases import (
    CreateSubscriptionPlanAdmin,
    DeleteSubscriptionPlanAdmin,
    GetSubscriptionPlanAdmin,
    ListSubscriptionPlansAdmin,
    ListSubscriptionPlansPublic,
    UpdateSubscriptionPlanAdmin,
)
from app.domain.audit.value_objects import AuditAction
from app.domain.subscription.entities import Subscription
from app.domain.subscription.plan_exceptions import (
    SubscriptionPlanIdConflictError,
    SubscriptionPlanInUseError,
    SubscriptionPlanNotFoundError,
)
from app.domain.subscription.value_objects import SubscriptionStatus
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
    InMemorySubscriptionPlanRepository,
    InMemorySubscriptionRepository,
)


@pytest.fixture
def plan_repo():
    return InMemorySubscriptionPlanRepository()


@pytest.fixture
def sub_repo():
    return InMemorySubscriptionRepository()


@pytest.fixture
def audit_repo():
    return InMemoryAuditEntryRepository()


class TestCreatePlan:
    @pytest.mark.asyncio
    async def test_happy(self, plan_repo):
        p = await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="vip", name="VIP", price=25000,
        )
        assert p.id == "vip"
        assert p.is_active is True

    @pytest.mark.asyncio
    async def test_id_conflict(self, plan_repo):
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="dup", name="A", price=100,
        )
        with pytest.raises(SubscriptionPlanIdConflictError):
            await CreateSubscriptionPlanAdmin(plan_repo).execute(
                plan_id="dup", name="B", price=200,
            )

    @pytest.mark.asyncio
    async def test_empty_id_rejected(self, plan_repo):
        with pytest.raises(ValueError, match="id"):
            await CreateSubscriptionPlanAdmin(plan_repo).execute(
                plan_id="", name="x", price=100,
            )

    @pytest.mark.asyncio
    async def test_negative_price_rejected(self, plan_repo):
        # Caught at the entity invariant level (`__post_init__`).
        with pytest.raises(ValueError, match="price"):
            await CreateSubscriptionPlanAdmin(plan_repo).execute(
                plan_id="x", name="x", price=-1,
            )


class TestUpdatePlan:
    @pytest.mark.asyncio
    async def test_patch_price(self, plan_repo):
        p = await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="x", name="X", price=100,
        )
        updated = await UpdateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id=p.id, price=999,
        )
        assert updated.price == 999
        assert updated.name == "X"

    @pytest.mark.asyncio
    async def test_unknown(self, plan_repo):
        with pytest.raises(SubscriptionPlanNotFoundError):
            await UpdateSubscriptionPlanAdmin(plan_repo).execute(
                plan_id="missing", price=100,
            )


class TestDeletePlan:
    @pytest.mark.asyncio
    async def test_happy(self, plan_repo, sub_repo):
        p = await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="x", name="X", price=100,
        )
        ok = await DeleteSubscriptionPlanAdmin(
            plan_repo, sub_repo,
        ).execute(p.id)
        assert ok is True

    @pytest.mark.asyncio
    async def test_in_use_409(self, plan_repo, sub_repo):
        # Create a plan and an active subscription that references it.
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="busy", name="X", price=100,
        )
        sub = Subscription(
            user_id="u1", plan_id="busy",
            status=SubscriptionStatus.ACTIVE,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        await sub_repo.create(sub)
        with pytest.raises(SubscriptionPlanInUseError):
            await DeleteSubscriptionPlanAdmin(
                plan_repo, sub_repo,
            ).execute("busy")

    @pytest.mark.asyncio
    async def test_cancelled_subscription_does_not_block(
        self, plan_repo, sub_repo,
    ):
        # Cancelled / expired subscriptions don't count.
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="cleared", name="X", price=100,
        )
        sub = Subscription(
            user_id="u1", plan_id="cleared",
            status=SubscriptionStatus.CANCELLED,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        await sub_repo.create(sub)
        ok = await DeleteSubscriptionPlanAdmin(
            plan_repo, sub_repo,
        ).execute("cleared")
        assert ok is True

    @pytest.mark.asyncio
    async def test_audit_recorded(self, plan_repo, sub_repo, audit_repo):
        p = await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="aud", name="Aud", price=500,
        )
        await DeleteSubscriptionPlanAdmin(
            plan_repo, sub_repo,
            audit_recorder=RecordAuditEntry(audit_repo),
        ).execute(p.id, actor_id="admin-1")
        assert len(audit_repo._entries) == 1
        e = audit_repo._entries[0]
        assert e.action == AuditAction.SETTINGS_UPDATE
        assert e.payload["op"] == "subscription_plan_delete"
        assert e.payload["id"] == "aud"
        assert e.payload["price"] == 500


class TestListPlans:
    @pytest.mark.asyncio
    async def test_admin_sees_inactive(self, plan_repo):
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="a", name="A", price=100, is_active=True,
        )
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="b", name="B", price=200, is_active=False,
        )
        rows = await ListSubscriptionPlansAdmin(plan_repo).execute()
        assert len(rows) == 2

    @pytest.mark.asyncio
    async def test_public_hides_inactive(self, plan_repo):
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="a", name="A", price=100, is_active=True,
        )
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="b", name="B", price=200, is_active=False,
        )
        rows = await ListSubscriptionPlansPublic(plan_repo).execute()
        assert len(rows) == 1
        assert rows[0].id == "a"

    @pytest.mark.asyncio
    async def test_sort_order(self, plan_repo):
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="late", name="L", price=100, sort_order=10,
        )
        await CreateSubscriptionPlanAdmin(plan_repo).execute(
            plan_id="early", name="E", price=200, sort_order=1,
        )
        rows = await ListSubscriptionPlansAdmin(plan_repo).execute()
        assert [p.id for p in rows] == ["early", "late"]


class TestGetPlanAdmin:
    @pytest.mark.asyncio
    async def test_unknown_raises(self, plan_repo):
        with pytest.raises(SubscriptionPlanNotFoundError):
            await GetSubscriptionPlanAdmin(plan_repo).execute("missing")
