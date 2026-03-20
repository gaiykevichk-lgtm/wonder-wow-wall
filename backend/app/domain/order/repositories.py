from abc import ABC, abstractmethod

from .entities import Order


class OrderRepository(ABC):
    @abstractmethod
    async def create(self, order: Order) -> Order:
        ...

    @abstractmethod
    async def get_by_id(self, order_id: str) -> Order | None:
        ...

    @abstractmethod
    async def list_by_user(self, user_id: str, offset: int = 0, limit: int = 20) -> list[Order]:
        ...

    @abstractmethod
    async def update(self, order: Order) -> Order:
        ...

    @abstractmethod
    async def generate_order_number(self) -> str:
        ...
