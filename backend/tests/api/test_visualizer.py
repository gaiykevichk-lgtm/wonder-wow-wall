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
    email = f"viz-{uuid.uuid4().hex[:8]}@test.com"
    resp = await client.post("/api/auth/register", json={
        "name": "Viz User", "email": email, "phone": "", "password": "secret123",
    })
    assert resp.status_code == 201
    return resp.json()["token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestVisualizerProjectsAuth:
    @pytest.mark.asyncio
    async def test_list_requires_auth(self, client):
        resp = await client.get("/api/visualizer/projects")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_create_requires_auth(self, client):
        resp = await client.post("/api/visualizer/projects", json={"name": "Test"})
        assert resp.status_code == 401


class TestVisualizerProjectsCRUD:
    @pytest.mark.asyncio
    async def test_create_project(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/visualizer/projects",
            json={
                "name": "My Wall",
                "photo_url": "data:image/png;base64,abc",
                "photo_width": 1920,
                "photo_height": 1080,
                "calibration_pixels_per_cm": 5.0,
                "panels": [
                    {
                        "design_id": "d1", "design_name": "Marble",
                        "size_key": "30x30", "color": "#CCC",
                        "x": 10, "y": 20, "render_width": 150, "render_height": 150,
                    }
                ],
                "placement_mode": "manual",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Wall"
        assert data["photo_width"] == 1920
        assert len(data["panels"]) == 1
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_list_projects(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)

        # Create 2 projects
        await client.post("/api/visualizer/projects", json={"name": "P1"}, headers=headers)
        await client.post("/api/visualizer/projects", json={"name": "P2"}, headers=headers)

        resp = await client.get("/api/visualizer/projects", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert "panel_count" in data[0]

    @pytest.mark.asyncio
    async def test_get_project(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)

        create_resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "Detail Test", "photo_width": 800, "photo_height": 600},
            headers=headers,
        )
        project_id = create_resp.json()["id"]

        resp = await client.get(f"/api/visualizer/projects/{project_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Detail Test"
        assert resp.json()["photo_width"] == 800

    @pytest.mark.asyncio
    async def test_update_project(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)

        create_resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "Original"},
            headers=headers,
        )
        project_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/visualizer/projects/{project_id}",
            json={"name": "Updated", "calibration_pixels_per_cm": 10.0},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"
        assert resp.json()["calibration_pixels_per_cm"] == 10.0

    @pytest.mark.asyncio
    async def test_delete_project(self, client):
        token = await _register_and_get_token(client)
        headers = _auth_headers(token)

        create_resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "To Delete"},
            headers=headers,
        )
        project_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/visualizer/projects/{project_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

        # Verify deleted
        resp = await client.get(f"/api/visualizer/projects/{project_id}", headers=headers)
        assert resp.status_code == 404


class TestVisualizerProjectsIsolation:
    @pytest.mark.asyncio
    async def test_cannot_access_other_users_project(self, client):
        token1 = await _register_and_get_token(client)
        token2 = await _register_and_get_token(client)

        # User 1 creates
        create_resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "Private"},
            headers=_auth_headers(token1),
        )
        project_id = create_resp.json()["id"]

        # User 2 cannot get
        resp = await client.get(
            f"/api/visualizer/projects/{project_id}",
            headers=_auth_headers(token2),
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_cannot_delete_other_users_project(self, client):
        token1 = await _register_and_get_token(client)
        token2 = await _register_and_get_token(client)

        create_resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "Private"},
            headers=_auth_headers(token1),
        )
        project_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/visualizer/projects/{project_id}",
            headers=_auth_headers(token2),
        )
        assert resp.status_code == 404


class TestVisualizerProjectsValidation:
    @pytest.mark.asyncio
    async def test_name_too_short(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/visualizer/projects",
            json={"name": ""},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_name_too_long(self, client):
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/visualizer/projects",
            json={"name": "A" * 101},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422
