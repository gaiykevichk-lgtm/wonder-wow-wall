"""Spaces payload invariants and admin guard are independent of DB availability."""
import json
from pathlib import Path
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.infrastructure.api.spaces import Space


def seed():
    return json.loads((Path(__file__).resolve().parents[2] / 'app' / 'seed_spaces.json').read_text())


def test_seed_valid():
    assert all(Space.model_validate(row) for row in seed())


def test_reject_foreign_scene():
    row = seed()[0]
    row['textures'][0]['image'] = '/other.jpg'
    try:
        Space.model_validate(row)
    except ValidationError:
        pass
    else:
        raise AssertionError('Foreign scene accepted')


def test_admin_writes_require_auth():
    client = TestClient(app)
    for method, url in [('post', '/api/admin/spaces'), ('put', '/api/admin/spaces/test'), ('delete', '/api/admin/spaces/test')]:
        response = getattr(client, method)(url, json=seed()[0]) if method != 'delete' else client.delete(url)
        assert response.status_code in (401, 403)


def test_texture_images_payload_maps_admin_rows():
    # Публичный источник фото для «Пространств» — строки админской вкладки «Изображения».
    import asyncio
    from types import SimpleNamespace
    from typing import Any, cast

    from app.infrastructure.api.spaces import list_space_texture_images

    class _Result:
        def scalars(self):
            return self

        def all(self):
            return [SimpleNamespace(id='row-1', texture_id_1='tex-a', texture_id_2='tex-b', image_path='MISC/x.jpg')]

    class _Db:
        async def execute(self, _stmt):
            return _Result()

    rows = asyncio.run(list_space_texture_images(db=cast(Any, _Db())))
    assert rows[0].model_dump() == {'id': 'row-1', 'textureId1': 'tex-a', 'textureId2': 'tex-b', 'image': 'MISC/x.jpg'}


def test_space_cards_skip_unpublished_rows():
    # Публичный endpoint карточек отдаёт только оформленные строки (с названием),
    # незаполненные пропускает, чтобы админ мог заполнять вкладку постепенно.
    import asyncio
    from types import SimpleNamespace
    from typing import Any, cast

    from app.infrastructure.api.spaces import list_space_cards

    class _Result:
        def __init__(self, rows):
            self._rows = rows

        def scalars(self):
            return self

        def all(self):
            return self._rows

    class _Db:
        def __init__(self, rows):
            self._rows = rows

        async def execute(self, _stmt):
            return _Result(self._rows)

    rows = [
        SimpleNamespace(id='filled', texture_id_1='tex-a', texture_id_2='tex-b', image_path='MISC/x.jpg', card={'title': 'Современная гостиная', 'subtitle': 'Современный · Текстиль · моно', 'price': 'от 196 460 ₽', 'area': 'Стена 8.4 м²'}),
        SimpleNamespace(id='empty', texture_id_1='tex-c', texture_id_2='tex-c', image_path='MISC/y.jpg', card={}),
    ]
    cards = asyncio.run(list_space_cards(db=cast(Any, _Db(rows))))
    assert [c.id for c in cards] == ['filled']
    card = cards[0]
    assert card.mode == 'combined'
    assert card.title == 'Современная гостиная'
    assert card.price == 'от 196 460 ₽'
