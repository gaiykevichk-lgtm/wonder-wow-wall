"""Integration test against configured PostgreSQL; run only when SPACES_INTEGRATION_DB=1.

Uses a transaction and rolls it back so it never changes production content.
"""
import os
import uuid
import json
from pathlib import Path
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

if not os.environ.get('SPACES_INTEGRATION_DB'):
    pytest.skip('Requires explicit PostgreSQL integration opt-in', allow_module_level=True)

from app.infrastructure.api.spaces import admin_router, public_router
from app.infrastructure.persistence.database import get_db, _get_engine
from app.utils.dependencies import get_current_admin_id


@pytest.mark.asyncio
async def test_admin_crud_and_public_read():
    engine = _get_engine()
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, expire_on_commit=False, join_transaction_mode='create_savepoint')
        app = FastAPI()
        app.include_router(public_router, prefix='/api')
        app.include_router(admin_router, prefix='/api/admin')
        async def db():
            yield session
        app.dependency_overrides[get_db] = db
        app.dependency_overrides[get_current_admin_id] = lambda: 'integration-admin'
        seed = json.loads((Path(__file__).resolve().parents[2] / 'app' / 'seed_spaces.json').read_text())[0]
        sample = {**seed, 'id': f'test-{uuid.uuid4().hex[:12]}', 'image': f'/integration/{uuid.uuid4().hex}.jpg'}
        sample['textures'] = [{**texture, 'image': sample['image']} for texture in seed['textures']]
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            count = len((await client.get('/api/spaces')).json())
            assert (await client.post('/api/admin/spaces', json=sample)).status_code == 201
            assert len((await client.get('/api/spaces')).json()) == count + 1
            sample['title'] = 'Тестовое изменение'
            assert (await client.put(f"/api/admin/spaces/{sample['id']}", json=sample)).json()['title'] == sample['title']
            assert any(row['title'] == sample['title'] for row in (await client.get('/api/spaces')).json())
            assert (await client.delete(f"/api/admin/spaces/{sample['id']}")).status_code == 204
            assert len((await client.get('/api/spaces')).json()) == count
            page = (await client.get('/api/spaces/page')).json()
            assert (await client.put('/api/admin/spaces/page', json={'heading': 'Проверка', 'intro': page['intro']})).status_code == 200
            assert (await client.get('/api/spaces/page')).json()['heading'] == 'Проверка'
        await session.close()
        await transaction.rollback()
    async with engine.connect() as verify:
        assert (await verify.execute(text('select count(*) from space_interiors'))).scalar() == count
