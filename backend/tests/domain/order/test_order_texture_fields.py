"""Phase 5 — OrderItem texture/color fields."""
import pytest
from app.domain.order.entities import OrderItem, Order


def test_order_item_has_texture_fields():
    """OrderItem includes texture_name, texture_id, color_id with defaults."""
    item = OrderItem()
    assert item.texture_name == ""
    assert item.texture_id == ""
    assert item.color_id == ""


def test_order_item_accepts_texture_fields():
    """OrderItem can be created with texture fields."""
    item = OrderItem(
        design_name="Тропический лес",
        texture_name="Бетон",
        texture_id="tex-1",
        color_id="color-1",
        unit_price=2090,
        quantity=2,
    )
    assert item.texture_name == "Бетон"
    assert item.texture_id == "tex-1"
    assert item.color_id == "color-1"
    assert item.subtotal == 4180


def test_order_total_includes_textured_items():
    """Order.total sums items regardless of texture fields."""
    order = Order()
    order.add_item(OrderItem(unit_price=1000, quantity=1))
    order.add_item(OrderItem(
        unit_price=2000,
        quantity=3,
        texture_name="Дерево",
        texture_id="tex-2",
        color_id="c3",
    ))
    assert order.total == 1000 + 6000
