"""`POST /api/calculate` — расчёт проекта стены.

Спецификация: `docs/product-specs/PRODUCT-CARD.md` §4 (PC-CALC-301..304,
PC-API-002..005) и критерий приёмки AC-PC-005:
  250 × 400 см, 300×300 → 10 м² → 11 коробок → 11,88 м² → 132 панели.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.infrastructure.api.calculate import (
    CombinedItemRequest,
    calculate_project,
)
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestCalculateFormulas:
    """Чистая функция расчёта — формулы из ТЗ."""

    def test_acceptance_case_300x300(self):
        """AC-PC-005 — контрольный кейс из критериев приёмки."""
        res = calculate_project(250, 400, "300x300")
        assert res.wall_area == 10.0
        # ceil(10 × 1.1 / 1.08) = ceil(10.185) = 11
        assert res.boxes_count == 11
        assert res.actual_area == 11.88
        assert res.panels_count == 132

    def test_300x600_same_box_area(self):
        res = calculate_project(250, 400, "300x600")
        assert res.boxes_count == 11
        assert res.actual_area == 11.88
        assert res.panels_count == 66  # 11 × 6

    def test_600x600_bigger_box(self):
        res = calculate_project(250, 400, "600x600")
        # ceil(10 × 1.1 / 1.44) = ceil(7.64) = 8
        assert res.boxes_count == 8
        assert res.actual_area == 11.52
        assert res.panels_count == 32  # 8 × 4

    def test_boxes_always_rounded_up(self):
        """PC-CALC-302 — округление строго вверх."""
        res = calculate_project(100, 100, "300x300")  # 1 м² → 1.1 / 1.08 = 1.019
        assert res.boxes_count == 2

    def test_purchase_price_uses_panel_price(self):
        res = calculate_project(
            250, 400, "300x300",
            base_prices={"300x300": 890},
            overlay_price=1200,
        )
        assert res.price_per_panel == 2090
        assert res.purchase_price == 132 * 2090

    def test_price_per_m2_derived_from_panel_area(self):
        res = calculate_project(
            250, 400, "300x300",
            base_prices={"300x300": 890},
            overlay_price=1200,
        )
        # 2090 ₽ за панель 0.09 м²
        assert res.price_per_m2 == round(2090 / 0.09)

    def test_combined_design_sums_positions(self):
        """PC-API-005 — комбинированный дизайн считается по позициям."""
        items = [
            CombinedItemRequest(panel_size="300x300", share=0.5),
            CombinedItemRequest(panel_size="600x600", share=0.5),
        ]
        res = calculate_project(
            250, 400, "300x300", "combined",
            base_prices={"300x300": 890, "600x600": 2490},
            overlay_price=1200,
            items=items,
        )
        assert res.design_type == "combined"
        assert len(res.breakdown) == 2
        # 5 м² каждой половине: ceil(5×1.1/1.08)=6 коробок, ceil(5×1.1/1.44)=4
        assert res.breakdown[0].boxes_count == 6
        assert res.breakdown[1].boxes_count == 4
        assert res.boxes_count == 10
        assert res.panels_count == 6 * 12 + 4 * 4
        assert res.purchase_price == sum(b.purchase_price for b in res.breakdown)

    def test_combined_shares_normalised(self):
        items = [
            CombinedItemRequest(panel_size="300x300", share=1.0),
            CombinedItemRequest(panel_size="300x600", share=1.0),
        ]
        res = calculate_project(250, 400, "300x300", "combined", items=items)
        assert res.breakdown[0].wall_area == 5.0
        assert res.breakdown[1].wall_area == 5.0

    def test_mono_has_no_breakdown(self):
        res = calculate_project(250, 400, "300x300")
        assert res.breakdown == []
        assert res.design_type == "mono"

    def test_combined_boxes_mode_sums_boxes_without_rounding(self):
        """Комбо по коробкам: строгое суммирование, без округления вверх."""
        items = [
            CombinedItemRequest(panel_size="300x300", boxes=3),
            CombinedItemRequest(panel_size="600x600", boxes=2),
        ]
        res = calculate_project(
            250, 400, "300x300", "combined",
            base_prices={"300x300": 890, "600x600": 2490},
            overlay_price=1200,
            items=items,
        )
        assert res.design_type == "combined"
        assert len(res.breakdown) == 2
        assert res.boxes_count == 5
        assert res.panels_count == 3 * 12 + 2 * 4
        assert res.purchase_price == 36 * 2090 + 8 * 3690
        assert res.purchase_price == sum(b.purchase_price for b in res.breakdown)

    def test_subscription_passed_through(self):
        res = calculate_project(
            250, 400, "300x300", subscription=(7000, "starter", "Стартовый"),
        )
        assert res.subscription_price == 7000
        assert res.subscription_plan_id == "starter"
        assert res.subscription_plan_name == "Стартовый"


class TestCalculateEndpoint:
    @pytest.mark.asyncio
    async def test_acceptance_case(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 250,
            "width": 400,
            "panel_size": "300x300",
            "design_type": "mono",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["wall_area"] == 10.0
        assert body["boxes_count"] == 11
        assert body["actual_area"] == 11.88
        assert body["panels_count"] == 132
        assert body["purchase_price"] > 0
        assert body["price_per_panel"] > 0
        assert body["panel_specs"]["panels_per_box"] == 12

    @pytest.mark.asyncio
    async def test_unknown_panel_size_rejected(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 250, "width": 400, "panel_size": "999x999",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_unknown_design_type_rejected(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 250, "width": 400, "design_type": "wild",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_height_out_of_range_rejected(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 10, "width": 400,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_combined_endpoint(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 250,
            "width": 400,
            "design_type": "combined",
            "items": [
                {"panel_size": "300x300", "share": 0.5},
                {"panel_size": "600x600", "share": 0.5},
            ],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["design_type"] == "combined"
        assert len(body["breakdown"]) == 2
        assert body["boxes_count"] == 10

    @pytest.mark.asyncio
    async def test_combined_boxes_endpoint(self, client):
        resp = await client.post("/api/calculate", json={
            "height": 250,
            "width": 400,
            "design_type": "combined",
            "items": [
                {"panel_size": "300x300", "boxes": 3},
                {"panel_size": "600x600", "boxes": 2},
            ],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["design_type"] == "combined"
        assert body["boxes_count"] == 5
        assert body["panels_count"] == 3 * 12 + 2 * 4

    @pytest.mark.asyncio
    async def test_unknown_design_id_does_not_break(self, client):
        """PC-API-003 — неизвестный design_id откатывается на настройки магазина."""
        resp = await client.post("/api/calculate", json={
            "height": 250, "width": 400, "design_id": "no-such-design",
        })
        assert resp.status_code == 200
        assert resp.json()["price_per_panel"] > 0

    @pytest.mark.asyncio
    async def test_panel_sizes_reference(self, client):
        resp = await client.get("/api/calculate/panel-sizes")
        assert resp.status_code == 200
        body = resp.json()
        assert body["300x300"]["box_area_m2"] == 1.08
        assert body["300x600"]["panels_per_box"] == 6
        assert body["600x600"]["panel_area_m2"] == 0.36
