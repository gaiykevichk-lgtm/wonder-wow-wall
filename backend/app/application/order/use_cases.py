from app.domain.order.entities import Order, OrderItem
from app.domain.order.repositories import OrderRepository
from app.domain.order.value_objects import Address
from app.domain.order.services import calculate_wall_cost


class CreateOrder:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(
        self, user_id: str, items: list[dict], address: dict,
    ) -> Order:
        number = await self.repo.generate_order_number()
        order = Order(
            number=number,
            user_id=user_id,
            address=Address(**address),
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
