from abc import ABC, abstractmethod

from .entities import Order
from .filters import OrderFilters


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

    @abstractmethod
    async def find_paginated(
        self,
        filters: OrderFilters,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[Order], int]:
        """Phase 4A — admin-facing paginated query.

        Returns `(items_for_page, total_matching)`. `page` is 1-based to
        match the Ant Design Table convention; size is bounded by the
        caller (the API layer enforces 1..200).

        Sort order: `created_at DESC` (newest first) — matches what the
        admin sees on the dashboard and is the only stable order we need
        for the table view. Pagination is server-side; UI never receives
        more than `size` rows.
        """
        ...
