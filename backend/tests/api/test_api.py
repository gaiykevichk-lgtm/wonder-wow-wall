import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register_and_get_token(client: AsyncClient) -> str:
    import uuid
    email = f"test-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post("/api/auth/register", json={
        "name": "Test User", "email": email, "phone": "+7 999 000 00 00", "password": "secret123",
    })
    assert resp.status_code == 201
    return resp.json()["token"]


class TestHealth:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestAuth:
    @pytest.mark.asyncio
    async def test_register(self, client):
        import uuid
        email = f"reg-{uuid.uuid4().hex[:8]}@test.com"
        resp = await client.post("/api/auth/register", json={
            "name": "New User", "email": email, "phone": "+7 000", "password": "pass123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == email

    @pytest.mark.asyncio
    async def test_login(self, client):
        import uuid
        email = f"login-{uuid.uuid4().hex[:8]}@test.com"
        await client.post("/api/auth/register", json={
            "name": "User", "email": email, "phone": "", "password": "pass123",
        })
        resp = await client.post("/api/auth/login", json={"email": email, "password": "pass123"})
        assert resp.status_code == 200
        assert "token" in resp.json()

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        import uuid
        email = f"wrong-{uuid.uuid4().hex[:8]}@test.com"
        await client.post("/api/auth/register", json={
            "name": "User", "email": email, "phone": "", "password": "correct",
        })
        resp = await client.post("/api/auth/login", json={"email": email, "password": "wrong"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_me(self, client):
        token = await _register_and_get_token(client)
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test User"

    @pytest.mark.asyncio
    async def test_me_unauthorized(self, client):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401


class TestCatalog:
    @pytest.mark.asyncio
    async def test_list_designs(self, client):
        resp = await client.get("/api/designs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 12
        assert len(data["items"]) == 12

    @pytest.mark.asyncio
    async def test_get_design(self, client):
        resp = await client.get("/api/designs/d-1")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Тропический лес"

    @pytest.mark.asyncio
    async def test_design_not_found(self, client):
        resp = await client.get("/api/designs/nonexistent")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_list_categories(self, client):
        resp = await client.get("/api/categories")
        assert resp.status_code == 200
        assert len(resp.json()) == 6

    @pytest.mark.asyncio
    async def test_search_designs(self, client):
        resp = await client.get("/api/designs?search=тропический")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


class TestSubscriptions:
    @pytest.mark.asyncio
    async def test_list_plans(self, client):
        resp = await client.get("/api/subscriptions/plans")
        assert resp.status_code == 200
        plans = resp.json()
        assert len(plans) == 3
        assert plans[0]["id"] == "starter"

    @pytest.mark.asyncio
    async def test_subscribe_and_status(self, client):
        token = await _register_and_get_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.post("/api/subscriptions", json={"plan_id": "popular"}, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["plan_id"] == "popular"

        resp = await client.get("/api/subscriptions/status", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["plan_id"] == "popular"

    @pytest.mark.asyncio
    async def test_cancel_subscription(self, client):
        token = await _register_and_get_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        await client.post("/api/subscriptions", json={"plan_id": "starter"}, headers=headers)
        resp = await client.delete("/api/subscriptions", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


class TestOrders:
    @pytest.mark.asyncio
    async def test_create_order(self, client):
        token = await _register_and_get_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.post("/api/orders", json={
            "items": [{"design_id": "d-1", "design_name": "Test", "size_key": "300x300", "quantity": 2, "unit_price": 2090}],
            "address": {"city": "Москва", "street": "Тверская", "building": "10"},
        }, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["total"] == 2090 * 2

    @pytest.mark.asyncio
    async def test_list_orders(self, client):
        token = await _register_and_get_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        await client.post("/api/orders", json={
            "items": [{"design_id": "d-1", "design_name": "T", "size_key": "300x300", "quantity": 1, "unit_price": 1000}],
            "address": {"city": "M", "street": "S", "building": "1"},
        }, headers=headers)

        resp = await client.get("/api/orders", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestCalculator:
    @pytest.mark.asyncio
    async def test_calculate(self, client):
        resp = await client.post("/api/calculator", json={
            "panels": [{"size_key": "300x300", "quantity": 4}],
            "has_subscription": False,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_panels"] == 4
        assert data["total"] == (890 + 1200) * 4


class TestContacts:
    @pytest.mark.asyncio
    async def test_submit_contact(self, client):
        resp = await client.post("/api/contacts", json={
            "name": "Test", "email": "test@test.com", "message": "Hello",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"
