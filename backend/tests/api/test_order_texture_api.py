"""Phase 5 — OrderItem texture fields through API."""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register_and_get_token(client: AsyncClient) -> str:
    email = f"tex-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post("/api/auth/register", json={
        "name": "Texture Tester",
        "email": email,
        "phone": "+7 999 000 00 00",
        "password": "secret123",
    })
    assert resp.status_code == 201
    return resp.json()["token"]


@pytest.mark.asyncio
async def test_create_order_with_texture_fields(client):
    """POST /api/orders with texture fields persists them."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "items": [
            {
                "design_id": "design-1",
                "design_name": "Тропический лес",
                "design_image": "/img/d1.jpg",
                "size_key": "300x300",
                "color": "#808080",
                "quantity": 2,
                "unit_price": 2090,
                "texture_name": "Бетон",
                "texture_id": "tex-1",
                "color_id": "color-1",
            }
        ],
        "address": {
            "city": "Москва",
            "street": "Тверская",
            "building": "1",
        },
    }

    resp = await client.post("/api/orders", json=body, headers=headers)

    assert resp.status_code == 201
    data = resp.json()
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["texture_name"] == "Бетон"
    assert item["texture_id"] == "tex-1"
    assert item["color_id"] == "color-1"
    assert item["quantity"] == 2
    assert item["unit_price"] == 2090


@pytest.mark.asyncio
async def test_create_order_without_texture_fields_defaults(client):
    """Legacy orders without texture fields still work."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "items": [
            {
                "design_id": "design-2",
                "design_name": "Мрамор",
                "size_key": "600x600",
                "quantity": 1,
                "unit_price": 3690,
            }
        ],
        "address": {
            "city": "СПб",
            "street": "Невский",
            "building": "10",
        },
    }

    resp = await client.post("/api/orders", json=body, headers=headers)

    assert resp.status_code == 201
    item = resp.json()["items"][0]
    assert item["texture_name"] == ""
    assert item["texture_id"] == ""
    assert item["color_id"] == ""


@pytest.mark.asyncio
async def test_get_order_includes_texture_fields(client):
    """GET /api/orders includes texture fields in response."""
    token = await _register_and_get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "items": [
            {
                "design_id": "design-1",
                "design_name": "Тропический лес",
                "size_key": "300x300",
                "quantity": 1,
                "unit_price": 2090,
                "texture_name": "Дерево",
                "texture_id": "tex-2",
                "color_id": "color-3",
            }
        ],
        "address": {
            "city": "Москва",
            "street": "Тверская",
            "building": "1",
        },
    }

    create_resp = await client.post("/api/orders", json=body, headers=headers)
    assert create_resp.status_code == 201
    order_id = create_resp.json()["id"]

    list_resp = await client.get("/api/orders", headers=headers)
    assert list_resp.status_code == 200

    orders = list_resp.json()
    order = next(o for o in orders if o["id"] == order_id)
    item = order["items"][0]
    assert item["texture_name"] == "Дерево"
    assert item["texture_id"] == "tex-2"
    assert item["color_id"] == "color-3"
