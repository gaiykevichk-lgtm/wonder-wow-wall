"""Phase 6 — `POST /api/quick-calculate` endpoint tests.

No auth required. Calculates wall area, panel estimate, and price based on
wall dimensions using the formula:
  wall_area = height × length
  panels_estimate = ceil(wall_area / 0.09)  — panel 30×30 cm = 0.09 m²
  price_from = panels_estimate × 890  — base panel price 300×300
"""
import math

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestQuickCalculate:
    @pytest.mark.asyncio
    async def test_valid_dimensions(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 3.0,
            "length_m": 4.0,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["wall_area"] == 12.0
        assert body["panels_estimate"] == math.ceil(12.0 / 0.09)  # 134
        assert body["price_from"] == body["panels_estimate"] * 890

    @pytest.mark.asyncio
    async def test_negative_height_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": -1.0,
            "length_m": 4.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_length_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 3.0,
            "length_m": -1.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_height_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 0.0,
            "length_m": 4.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_length_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 3.0,
            "length_m": 0.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_numeric_height_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": "three",
            "length_m": 4.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_numeric_length_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 3.0,
            "length_m": "four",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_height_exceeds_limit_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 15.0,  # le=10
            "length_m": 4.0,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_length_exceeds_limit_rejected(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 3.0,
            "length_m": 60.0,  # le=50
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_small_dimensions(self, client):
        resp = await client.post("/api/quick-calculate", json={
            "height_m": 0.5,
            "length_m": 0.5,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["wall_area"] == 0.25
        assert body["panels_estimate"] == math.ceil(0.25 / 0.09)  # 3
        assert body["price_from"] == 3 * 890
