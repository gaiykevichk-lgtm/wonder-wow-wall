"""The checkout API rejects stale/malformed variants without persisting an order."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.container import _mem_order_repo, _mem_panel_variant_repo, _mem_user_repo, _mem_panel_repo
from app.domain.catalog.panel_variant import PanelVariant
from app.main import app


@pytest.fixture(autouse=True)
def isolate_repos():
    users = list(_mem_user_repo._users)
    variants = list(_mem_panel_variant_repo._variants)
    orders = list(_mem_order_repo._orders)
    panels = list(_mem_panel_repo._panels)
    _mem_user_repo._users.clear()
    _mem_panel_variant_repo._variants.clear()
    _mem_order_repo._orders.clear()
    _mem_panel_repo._panels.clear()
    yield
    _mem_user_repo._users[:] = users
    _mem_panel_variant_repo._variants[:] = variants
    _mem_order_repo._orders[:] = orders
    _mem_panel_repo._panels[:] = panels


@pytest.mark.asyncio
async def test_invalid_cart_lines_return_422_without_creating_order():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        registered = await client.post("/api/auth/register", json={
            "name": "Buyer", "email": "order-validation@test.com",
            "phone": "+7 999 000 00 03", "password": "secret123",
        })
        assert registered.status_code == 201
        headers = {"Authorization": f"Bearer {registered.json()['token']}"}
        line = {
            "design_id": "panel-a", "design_name": "Panel A",
            "size_key": "300x300", "quantity": 1, "unit_price": 1200,
        }
        payload = {"items": [line], "address": {"city": "M", "street": "S", "building": "1"}}
        for invalid_line, detail in [
            (line, "variant_id is required"),
            ({**line, "variant_id": "missing"}, "missing or inactive"),
        ]:
            response = await client.post(
                "/api/orders", json={**payload, "items": [invalid_line]}, headers=headers,
            )
            assert response.status_code == 422
            assert detail in response.json()["detail"]
            assert _mem_order_repo._orders == []

        variant = PanelVariant(id="variant-a", name="A", panel_id="panel-a", texture_id="texture-a")
        _mem_panel_variant_repo._variants.append(variant)
        from app.domain.catalog.panel import Panel
        from app.domain.catalog.value_objects import PanelSize
        _mem_panel_repo._panels.append(Panel(
            id="panel-a", name="Panel A", slug="panel-a",
            size=PanelSize(300, 300, "30×30"), stock_quantity=5,
        ))
        wrong_panel = await client.post(
            "/api/orders", json={**payload, "items": [{**line, "variant_id": variant.id, "design_id": "panel-b"}]},
            headers=headers,
        )
        assert wrong_panel.status_code == 422
        assert "does not belong to panel" in wrong_panel.json()["detail"]
        assert _mem_order_repo._orders == []

        valid = await client.post(
            "/api/orders", json={**payload, "items": [{**line, "variant_id": variant.id}]},
            headers=headers,
        )
        assert valid.status_code == 201, valid.text
        assert valid.json()["items"][0]["variant_id"] == variant.id
        assert len(_mem_order_repo._orders) == 1
        panel_after_checkout = await _mem_panel_repo.get_by_id("panel-a")
        assert panel_after_checkout is not None
        assert panel_after_checkout.stock_quantity == 4
        after_duplicate = await client.post(
            "/api/orders", json={**payload, "items": [{**line, "variant_id": variant.id}]}, headers=headers,
        )
        assert after_duplicate.status_code == 422
        assert "Insufficient stock" in after_duplicate.json()["detail"]
        assert len(_mem_order_repo._orders) == 1
