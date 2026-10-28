from abc import ABC, abstractmethod

from .entities import Subscription, SubscriptionPlan


class SubscriptionRepository(ABC):
    @abstractmethod
    async def get_active_by_user(self, user_id: str) -> Subscription | None:
        ...

    @abstractmethod
    async def create(self, subscription: Subscription) -> Subscription:
        ...

    @abstractmethod
    async def update(self, subscription: Subscription) -> Subscription:
        ...

    @abstractmethod
    async def count_active_by_plan(self, plan_id: str) -> int:
        """Phase 8C — `DeleteSubscriptionPlanAdmin` cascade-guard.

        Returns the number of `ACTIVE`-status subscriptions referencing
        the plan. Non-zero ⇒ delete refused with `SubscriptionPlanInUseError`
        (409). Cancelled / expired subscriptions don't count — they're
        historic, deleting the plan won't break them.
        """


class SubscriptionPlanRepository(ABC):
    """Phase 8C — admin-managed tariff catalog."""

    @abstractmethod
    async def list_plans(
        self, *, active_only: bool = False,
    ) -> list[SubscriptionPlan]:
        """Return plans sorted by `sort_order` asc.

        `active_only=True` is the public read posture; admin defaults to
        `False` so it sees retired plans too.
        """

    @abstractmethod
    async def get_by_id(self, plan_id: str) -> SubscriptionPlan | None:
        ...

    @abstractmethod
    async def create(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        ...

    @abstractmethod
    async def update(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        ...

    @abstractmethod
    async def delete(self, plan_id: str) -> bool:
        ...
