"""Contract checks for the canonical admin texture-visualization URLs and legacy alias."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_texture_repo,
    _mem_texture_visualization_repo,
    user_repo as _mem_user_repo,
)
from app.domain.catalog.texture import Texture
from app.main import app


@pytest.fixture(autouse=True)
def reset_repos():
    _mem_user_repo._users.clear()
    _mem_texture_repo._textures.clear()
    _mem_texture_visualization_repo._vizs.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_texture_repo._textures.clear()
    _mem_texture_visualization_repo._vizs.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def admin_token(client):
    response = await client.post("/api/auth/register", json={
        "name": "Admin", "email": "visualization-admin@test.com",
        "phone": "+7 999 000 00 01", "password": "secret123",
    })
    assert response.status_code == 201
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=response.json()["user"]["id"],
    )
    login = await client.post("/api/auth/login", json={
        "email": "visualization-admin@test.com", "password": "secret123",
    })
    assert login.status_code == 200
    return login.json()["token"]


@pytest.mark.asyncio
async def test_canonical_route_auth_and_legacy_alias(client):
    path = "/api/admin/texture-visualizations"
    legacy = "/api/admin/admin/texture-visualizations"
    assert (await client.get(path)).status_code == 401
    assert (await client.get(legacy)).status_code == 401
    customer = await client.post("/api/auth/register", json={
        "name": "Customer", "email": "visualization-customer@test.com",
        "phone": "+7 999 000 00 02", "password": "secret123",
    })
    assert customer.status_code == 201
    customer_headers = {"Authorization": f"Bearer {customer.json()['token']}"}
    assert (await client.get(path, headers=customer_headers)).status_code == 403
    assert (await client.get(legacy, headers=customer_headers)).status_code == 403
    token = await admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    _mem_texture_repo._textures.append(Texture(id="texture-a", name="Oak", slug="oak"))

    created = await client.post(path, headers=headers, json={
        "texture_id": "texture-a", "title": "Oak wall",
    })
    assert created.status_code == 201, created.text
    viz_id = created.json()["id"]
    assert (await client.get(path, headers=headers)).json()[0]["id"] == viz_id
    assert (await client.get(legacy, headers=headers)).json()[0]["id"] == viz_id
    detail = await client.get(f"{path}/{viz_id}", headers=headers)
    assert detail.status_code == 200 and detail.json()["title"] == "Oak wall"
    updated = await client.patch(f"{path}/{viz_id}", headers=headers, json={"title": "New title"})
    assert updated.status_code == 200 and updated.json()["title"] == "New title"
    assert (await client.get(f"{legacy}/{viz_id}", headers=headers)).json()["title"] == "New title"
    assert (await client.delete(f"{path}/{viz_id}", headers=headers)).status_code == 204
    assert (await client.get(f"{legacy}/{viz_id}", headers=headers)).status_code == 404


def test_openapi_exposes_canonical_route_only():
    paths = app.openapi()["paths"]
    assert "/api/admin/texture-visualizations" in paths
    assert "/api/admin/texture-visualizations/{viz_id}" in paths
    assert "/api/admin/admin/texture-visualizations" not in paths
    assert "/api/admin/admin/texture-visualizations/{viz_id}" not in paths
