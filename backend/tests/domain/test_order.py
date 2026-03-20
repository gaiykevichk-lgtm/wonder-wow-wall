import pytest
from app.domain.order.entities import Order, OrderItem
from app.domain.order.value_objects import OrderStatus, Address, Money
from app.domain.order.services import calculate_panel_cost, calculate_wall_cost


class TestOrderStatus:
    def test_values(self):
        assert OrderStatus.PLACED.value == "placed"
        assert OrderStatus.INSTALLED.value == "installed"

    def test_label_ru(self):
        assert OrderStatus.PLACED.label_ru == "Оформлен"
        assert OrderStatus.IN_PROGRESS.label_ru == "В работе"


class TestAddress:
    def test_full_address(self):
        a = Address(city="Москва", street="Тверская", building="10", apartment="5")
        assert a.full == "Москва, Тверская, д. 10, кв. 5"

    def test_full_without_apartment(self):
        a = Address(city="Москва", street="Тверская", building="10")
        assert "кв." not in a.full


class TestMoney:
    def test_add(self):
        result = Money(100) + Money(200)
        assert result.amount == 300

    def test_add_different_currency_raises(self):
        with pytest.raises(ValueError):
            Money(100, "RUB") + Money(200, "USD")

    def test_multiply(self):
        result = Money(500) * 3
        assert result.amount == 1500


class TestOrderItem:
    def test_subtotal(self):
        item = OrderItem(unit_price=2090, quantity=3)
        assert item.subtotal == 6270


class TestOrder:
    def test_total(self):
        order = Order(items=[
            OrderItem(unit_price=2090, quantity=2),
            OrderItem(unit_price=3690, quantity=1),
        ])
        assert order.total == 2090 * 2 + 3690

    def test_confirm(self):
        order = Order()
        order.confirm()
        assert order.status == OrderStatus.CONFIRMED

    def test_confirm_wrong_status_raises(self):
        order = Order(status=OrderStatus.DELIVERED)
        with pytest.raises(ValueError):
            order.confirm()

    def test_start_work(self):
        order = Order(status=OrderStatus.CONFIRMED)
        order.start_work()
        assert order.status == OrderStatus.IN_PROGRESS

    def test_add_item(self):
        order = Order()
        order.add_item(OrderItem(design_name="Test", unit_price=1000))
        assert len(order.items) == 1


class TestPricingService:
    def test_calculate_panel_cost_no_subscription(self):
        cost = calculate_panel_cost("300x300", 4)
        assert cost == (890 + 1200) * 4

    def test_calculate_panel_cost_with_subscription(self):
        cost = calculate_panel_cost("300x300", 4, has_subscription=True)
        assert cost == 890 * 4

    def test_calculate_wall_cost(self):
        panels = [
            {"size_key": "300x300", "quantity": 6},
            {"size_key": "600x600", "quantity": 2},
        ]
        result = calculate_wall_cost(panels)
        assert result["total_panels"] == 8
        assert result["total_base"] == 890 * 6 + 2490 * 2
        assert result["total_overlay"] == 1200 * 8
        assert result["total"] == result["total_base"] + result["total_overlay"]

    def test_calculate_wall_cost_with_subscription(self):
        panels = [{"size_key": "300x300", "quantity": 4}]
        result = calculate_wall_cost(panels, has_subscription=True)
        assert result["total_overlay"] == 0
        assert result["subscription_savings"] == 1200 * 4
        assert result["total"] == 890 * 4
