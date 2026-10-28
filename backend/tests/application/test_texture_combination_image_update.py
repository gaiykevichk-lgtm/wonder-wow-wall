from datetime import datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest import IsolatedAsyncioTestCase

from fastapi import HTTPException

from app.infrastructure.api.admin.textures import (
    TextureCombinationImageUpdate,
    update_texture_combination_image_admin,
)


class _ScalarResult:
    def __init__(self, ids: list[str]) -> None:
        self._ids = ids

    def scalars(self) -> "_ScalarResult":
        return self

    def all(self) -> list[str]:
        return self._ids


class _Session:
    def __init__(self, row: Any, texture_ids: list[str]) -> None:
        self.row = row
        self.texture_ids = texture_ids
        self.flush_count = 0

    async def get(self, model: Any, row_id: str) -> Any:
        if getattr(model, "__name__", "") == "PanelVariantModel":
            return SimpleNamespace(id=row_id, is_active=True)
        return self.row if self.row and self.row.id == row_id else None

    async def execute(self, _statement: Any) -> _ScalarResult:
        return _ScalarResult(self.texture_ids)

    async def flush(self) -> None:
        self.flush_count += 1


class TextureCombinationImageUpdateTest(IsolatedAsyncioTestCase):
    async def test_update_keeps_identity_and_normalizes_pair(self) -> None:
        created_at = datetime(2026, 9, 18, 10, 0, 0)
        row = SimpleNamespace(
            id="image-1",
            texture_id_1="texture-a",
            texture_id_2="texture-a",
            image_path="old.webp",
            image_paths=["old.webp"],
            created_at=created_at,
            card={},
        )
        session = _Session(row, ["texture-a", "texture-b"])

        response = await update_texture_combination_image_admin(
            combination_id="image-1",
            body=TextureCombinationImageUpdate(
                texture_id_1="texture-b",
                texture_id_2="texture-a",
                image_path="new.webp",
                card={"title": "Тест", "execution_variant_id": "exec-1", "subtitle": "", "price": "", "area": "", "category": "home"},
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )

        self.assertEqual(response.id, "image-1")
        self.assertEqual(response.created_at, created_at.isoformat())
        self.assertEqual(
            (response.texture_id_1, response.texture_id_2),
            ("texture-a", "texture-b"),
        )
        # Замена обложки: новое фото встаёт первым, остальная галерея сохранена.
        self.assertEqual(response.image_path, "new.webp")
        self.assertEqual(response.image_paths, ["new.webp", "old.webp"])
        self.assertEqual(session.flush_count, 1)

    async def test_update_accepts_full_gallery_replacement(self) -> None:
        row = SimpleNamespace(
            id="image-2",
            texture_id_1="texture-a",
            texture_id_2="texture-a",
            image_path="first.webp",
            image_paths=["first.webp", "second.webp"],
            created_at=datetime(2026, 9, 18, 10, 0, 0),
            card={},
        )
        session = _Session(row, ["texture-a"])

        response = await update_texture_combination_image_admin(
            combination_id="image-2",
            body=TextureCombinationImageUpdate(
                texture_id_1="texture-a",
                texture_id_2="texture-a",
                image_paths=["third.webp", "first.webp"],
                card={"title": "Тест", "execution_variant_id": "exec-1", "subtitle": "", "price": "", "area": "", "category": "home"},
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )

        self.assertEqual(response.image_path, "third.webp")
        self.assertEqual(response.image_paths, ["third.webp", "first.webp"])
        self.assertEqual(session.flush_count, 1)

    async def test_update_rejects_missing_execution(self) -> None:
        row = SimpleNamespace(
            id="image-3",
            texture_id_1="texture-a",
            texture_id_2="texture-a",
            image_path="first.webp",
            image_paths=["first.webp"],
            created_at=datetime(2026, 9, 18, 10, 0, 0),
            card={},
        )
        session = _Session(row, ["texture-a"])

        with self.assertRaises(HTTPException) as raised:
            await update_texture_combination_image_admin(
                combination_id="image-3",
                body=TextureCombinationImageUpdate(
                    texture_id_1="texture-a",
                    texture_id_2="texture-a",
                    image_paths=["first.webp"],
                ),
                _admin_id="admin-1",
                session=cast(Any, session),
            )

        self.assertEqual(raised.exception.status_code, 422)

    async def test_update_rejects_missing_row(self) -> None:
        session = _Session(None, [])

        with self.assertRaises(HTTPException) as raised:
            await update_texture_combination_image_admin(
                combination_id="missing",
                body=TextureCombinationImageUpdate(
                    texture_id_1="texture-a",
                    texture_id_2="texture-a",
                    image_path="new.webp",
                ),
                _admin_id="admin-1",
                session=cast(Any, session),
            )

        self.assertEqual(raised.exception.status_code, 404)
