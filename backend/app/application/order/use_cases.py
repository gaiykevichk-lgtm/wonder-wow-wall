from datetime import datetime

from app.domain.order.entities import Order, OrderItem
from app.domain.order.filters import OrderFilters
from app.domain.order.repositories import OrderRepository
from app.domain.order.value_objects import Address
from app.domain.order.services import calculate_wall_cost


class CreateOrder:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(
        self, user_id: str, items: list[dict], address: dict,
        installation_date: datetime | None = None,
    ) -> Order:
        number = await self.repo.generate_order_number()
        order = Order(
            number=number,
            user_id=user_id,
            address=Address(**address),
            installation_date=installation_date,
        )
        for item_data in items:
            order.add_item(OrderItem(
                design_id=item_data.get("design_id", ""),
                design_name=item_data.get("design_name", ""),
                design_image=item_data.get("design_image", ""),
                size_key=item_data.get("size_key", ""),
                color=item_data.get("color", ""),
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price", 0),
            ))
        return await self.repo.create(order)


class GetOrderHistory:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(self, user_id: str, offset: int = 0, limit: int = 20) -> list[Order]:
        return await self.repo.list_by_user(user_id, offset, limit)


class GetOrderDetails:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(self, order_id: str, user_id: str) -> Order | None:
        order = await self.repo.get_by_id(order_id)
        if order and order.user_id != user_id:
            return None
        return order


class CalculateWallCost:
    async def execute(self, panels: list[dict], has_subscription: bool = False) -> dict:
        return calculate_wall_cost(panels, has_subscription)


class ListOrdersAdmin:
    """Phase 4A — admin paginated order list.

    Pure pass-through to the repository. Authorisation (admin role) is
    enforced at the API layer by `get_current_admin_id`, so this use case
    has no dependency on the user repository or actor identity. Keeping
    it minimal mirrors the pattern in `GetDashboardSnapshot`.
    """

    MAX_PAGE_SIZE = 200

    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(
        self, filters: OrderFilters, page: int = 1, size: int = 50,
    ) -> tuple[list[Order], int]:
        if page < 1:
            raise ValueError(f"page must be >= 1, got {page}")
        if size < 1 or size > self.MAX_PAGE_SIZE:
            raise ValueError(
                f"size must be in 1..{self.MAX_PAGE_SIZE}, got {size}"
            )
        return await self.repo.find_paginated(filters, page=page, size=size)
