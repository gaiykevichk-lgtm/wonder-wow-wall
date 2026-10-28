import asyncio

import pytest

from app.application.order.use_cases import CreateOrder
from app.domain.catalog.panel import Panel
from app.domain.catalog.panel_variant import PanelVariant
from app.domain.catalog.value_objects import PanelSize
from app.domain.order.entities import Order
from app.infrastructure.persistence.panel_variant_repo import InMemoryPanelVariantRepository
from app.infrastructure.persistence.repositories.memory import InMemoryOrderRepository, InMemoryPanelRepository


async def _setup(stock: int):
    panels = InMemoryPanelRepository([])
    panels._panels.append(Panel(id="p1", name="Панель", slug="panel", size=PanelSize(300, 300, "30×30"), stock_quantity=stock))
    variants = InMemoryPanelVariantRepository()
    await variants.create(PanelVariant(id="v1", panel_id="p1", texture_id="t1"))
    orders = InMemoryOrderRepository()
    use_case = CreateOrder(orders, variant_repo=variants, panel_repo=panels)
    payload = [{"variant_id":"v1", "design_id":"p1", "design_name":"Panel", "size_key":"300x300", "quantity":2, "unit_price":100}]
    address = {"city":"M", "street":"S", "building":"1"}
    return panels, orders, use_case, payload, address


@pytest.mark.asyncio
async def test_checkout_decrements_stock_once_and_creates_order():
    panels, orders, use_case, items, address = await _setup(5)
    panel = await panels.get_by_id("p1")
    assert panel and panel.stock_quantity == 5
    await use_case.execute("buyer", items, address)
    panel = await panels.get_by_id("p1")
    assert panel and panel.stock_quantity == 3
    assert len(orders._orders) == 1


@pytest.mark.asyncio
async def test_insufficient_stock_rejects_checkout_without_order_or_decrement():
    panels, orders, use_case, items, address = await _setup(1)
    with pytest.raises(ValueError, match="Insufficient stock"):
        await use_case.execute("buyer", items, address)
    panel = await panels.get_by_id("p1")
    assert panel and panel.stock_quantity == 1
    assert not orders._orders


@pytest.mark.asyncio
async def test_concurrent_checkout_cannot_oversell_in_memory_repository():
    panels, orders, use_case, items, address = await _setup(2)
    async def checkout():
        try:
            await use_case.execute("buyer", items, address)
            return True
        except ValueError:
            return False
    results = await asyncio.gather(checkout(), checkout())
    panel = await panels.get_by_id("p1")
    assert panel and panel.stock_quantity == 0
    assert sum(results) == 1
    assert len(orders._orders) == 1
