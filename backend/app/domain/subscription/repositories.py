from abc import ABC, abstractmethod

from .entities import Subscription


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
