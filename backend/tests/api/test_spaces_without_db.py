"""DB-backed spaces must fail cleanly in the in-memory development mode."""
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.infrastructure.api.spaces import public_router
from app.infrastructure.persistence.database import get_db


@pytest.mark.asyncio
async def test_spaces_returns_503_without_database():
    app = FastAPI()
    app.include_router(public_router, prefix="/api")
    with patch("app.infrastructure.persistence.database.settings.USE_MEMORY_REPOS", True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for route in ("/api/spaces", "/api/spaces/page"):
                response = await client.get(route)
                assert response.status_code == 503
                assert response.json()["detail"] == "Для управления пространствами требуется PostgreSQL"
    # Keep the dependency a real async generator in both execution branches.
    assert hasattr(get_db(), "__anext__")
