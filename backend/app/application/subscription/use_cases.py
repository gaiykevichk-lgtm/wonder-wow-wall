from datetime import datetime, timedelta

from app.domain.subscription.entities import Subscription, SUBSCRIPTION_PLANS
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.subscription.value_objects import SubscriptionStatus


class GetPlans:
    async def execute(self):
        return SUBSCRIPTION_PLANS


class Subscribe:
    def __init__(self, repo: SubscriptionRepository):
        self.repo = repo

    async def execute(self, user_id: str, plan_id: str) -> Subscription:
        # Check if already subscribed
        existing = await self.repo.get_active_by_user(user_id)
        if existing:
            raise ValueError("User already has an active subscription")

        plan = next((p for p in SUBSCRIPTION_PLANS if p.id == plan_id), None)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

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
