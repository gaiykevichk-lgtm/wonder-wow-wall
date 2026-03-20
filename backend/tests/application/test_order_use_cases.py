import pytest
from app.application.order.use_cases import CreateOrder, GetOrderHistory, GetOrderDetails, CalculateWallCost
from app.infrastructure.persistence.repositories.memory import InMemoryOrderRepository


@pytest.fixture
def order_repo():
    return InMemoryOrderRepository()


class TestCreateOrder:
    @pytest.mark.asyncio
    async def test_create(self, order_repo):
        uc = CreateOrder(order_repo)
        order = await uc.execute(
            user_id="user-1",
            items=[
                {"design_id": "d1", "design_name": "Test", "size_key": "300x300",
                 "quantity": 2, "unit_price": 2090},
            ],
            address={"city": "Москва", "street": "Тверская", "building": "10"},
        )
        assert order.number.startswith("WW-")
        assert order.user_id == "user-1"
        assert len(order.items) == 1
        assert order.total == 2090 * 2

    @pytest.mark.asyncio
    async def test_multiple_items(self, order_repo):
        uc = CreateOrder(order_repo)
        order = await uc.execute(
            user_id="user-1",
            items=[
                {"design_id": "d1", "design_name": "A", "size_key": "300x300", "quantity": 3, "unit_price": 1000},
                {"design_id": "d2", "design_name": "B", "size_key": "600x600", "quantity": 1, "unit_price": 2000},
            ],
            address={"city": "M", "street": "S", "building": "1"},
        )
        assert len(order.items) == 2
        assert order.total == 3000 + 2000


class TestGetOrderHistory:
    @pytest.mark.asyncio
    async def test_empty(self, order_repo):
        uc = GetOrderHistory(order_repo)
        orders = await uc.execute("user-1")
        assert orders == []

    @pytest.mark.asyncio
    async def test_returns_user_orders(self, order_repo):
        create_uc = CreateOrder(order_repo)
        await create_uc.execute("user-1", [{"design_id": "d1", "design_name": "A", "size_key": "300x300", "quantity": 1, "unit_price": 1000}], {"city": "M", "street": "S", "building": "1"})
        await create_uc.execute("user-2", [{"design_id": "d2", "design_name": "B", "size_key": "300x300", "quantity": 1, "unit_price": 1000}], {"city": "M", "street": "S", "building": "2"})

        uc = GetOrderHistory(order_repo)
        orders = await uc.execute("user-1")
        assert len(orders) == 1


class TestGetOrderDetails:
    @pytest.mark.asyncio
    async def test_own_order(self, order_repo):
        create_uc = CreateOrder(order_repo)
        order = await create_uc.execute("user-1", [{"design_id": "d1", "design_name": "A", "size_key": "300x300", "quantity": 1, "unit_price": 1000}], {"city": "M", "street": "S", "building": "1"})

        uc = GetOrderDetails(order_repo)
        found = await uc.execute(order.id, "user-1")
        assert found is not None

    @pytest.mark.asyncio
    async def test_other_user_order_returns_none(self, order_repo):
        create_uc = CreateOrder(order_repo)
        order = await create_uc.execute("user-1", [{"design_id": "d1", "design_name": "A", "size_key": "300x300", "quantity": 1, "unit_price": 1000}], {"city": "M", "street": "S", "building": "1"})

        uc = GetOrderDetails(order_repo)
        found = await uc.execute(order.id, "user-2")
        assert found is None


class TestCalculateWallCost:
    @pytest.mark.asyncio
    async def test_calculate(self):
        uc = CalculateWallCost()
        result = await uc.execute([
            {"size_key": "300x300", "quantity": 4},
            {"size_key": "600x600", "quantity": 2},
        ])
        assert result["total_panels"] == 6
        assert result["total"] > 0
