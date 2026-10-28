from datetime import datetime, timedelta

from app.domain.subscription.entities import Subscription, SubscriptionPlan
from app.domain.subscription.repositories import (
    SubscriptionPlanRepository,
    SubscriptionRepository,
)


class GetPlans:
    """Phase 8C — read active plans from the admin-editable repository.

    Was previously a const-return (`SUBSCRIPTION_PLANS`); after Phase 8C
    moved the source of truth to the DB, that path silently ignored
    admin edits. Now reads through `SubscriptionPlanRepository` with
    `active_only=True` so the customer sees the same plans the public
    `/api/subscription-plans` endpoint exposes.
    """

    def __init__(self, plan_repo: SubscriptionPlanRepository):
        self.plan_repo = plan_repo

    async def execute(self) -> list[SubscriptionPlan]:
        return await self.plan_repo.list_plans(active_only=True)


class Subscribe:
    """Phase 8C — validate `plan_id` against the admin DB, not the const.

    Pre-Phase-8C, `Subscribe` validated against the legacy
    `SUBSCRIPTION_PLANS` constant — meaning admin-created plans
    couldn't be subscribed to (the validation bounced with «not found»).
    The repo lookup also enforces `is_active=True` so a retired plan
    cannot accept new subscriptions while existing rows continue
    referencing it (graceful retire path).
    """

    def __init__(
        self,
        repo: SubscriptionRepository,
        plan_repo: SubscriptionPlanRepository,
    ):
        self.repo = repo
        self.plan_repo = plan_repo

    async def execute(self, user_id: str, plan_id: str) -> Subscription:
        # Check if already subscribed
        existing = await self.repo.get_active_by_user(user_id)
        if existing:
            raise ValueError("User already has an active subscription")

        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")
        if not plan.is_active:
            # Retired plans cannot accept new subscriptions. Existing
            # rows that reference them keep working (admin-controlled
            # graceful sunset).
            raise ValueError(f"Plan {plan_id} is no longer available")

        sub = Subscription(
            user_id=user_id,
            plan_id=plan_id,
            started_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        return await self.repo.create(sub)


class GetSubscriptionStatus:
    def __init__(self, repo: SubscriptionRepository):
        self.repo = repo

    async def execute(self, user_id: str) -> Subscription | None:
        return await self.repo.get_active_by_user(user_id)


class CancelSubscription:
    def __init__(self, repo: SubscriptionRepository):
        self.repo = repo

    async def execute(self, user_id: str) -> bool:
        sub = await self.repo.get_active_by_user(user_id)
        if not sub:
            raise ValueError("No active subscription found")
        sub.cancel()
        await self.repo.update(sub)
        return True


def compute_remaining_area_m2(
    sub: Subscription, plan: SubscriptionPlan | None,
) -> float:
    """Phase 8C — compute remaining area against a freshly-fetched plan.

    Replaces the entity property `Subscription.remaining_area_m2` which
    silently read from the legacy `SUBSCRIPTION_PLANS` const. Callers
    pass the plan they just looked up via `plan_repo.get_by_id(...)` so
    admin edits to `area_limit_m2` propagate without restarting the app.

    `None` plan returns `0.0` — same posture as the legacy property
    (graceful degradation if the FK ever orphans).
    """
    if plan is None:
        return 0.0
    if plan.area_limit_m2 == 0:
        # 0 = unlimited (admin convention preserved).
        return float("inf")
    return max(0.0, plan.area_limit_m2 - sub.area_used_this_month_m2)
