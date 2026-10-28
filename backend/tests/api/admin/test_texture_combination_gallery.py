"""Texture combination image CREATE behaviour: one card per texture pair,
multiple uploads become the card gallery instead of duplicate cards."""

from datetime import datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest import IsolatedAsyncioTestCase

from fastapi import HTTPException

from app.infrastructure.api.admin.textures import (
    TextureCombinationImageCreate,
    create_texture_combination_image_admin,
)


class _Result:
    def __init__(self, modes: list[Any]) -> None:
        self._modes = modes
        self._i = 0

    def scalars(self) -> "_Result":
        return self

    def all(self) -> list[Any]:
        return self._modes[0]

    def first(self) -> Any:
        return self._modes[1] if len(self._modes) > 1 else None


class _Session:
    """Fake session: first execute returns texture ids, second returns the
    existing row for the pair (or None); ``panels`` queries yield known
    base slugs (``reika-300x300``, ``arka-300x300``)."""

    def __init__(
        self,
        texture_ids: list[str],
        existing_row: Any = None,
        panel_slugs: list[str] | None = None,
    ) -> None:
        self.texture_ids = texture_ids
        self.existing_row = existing_row
        self.panel_slugs = panel_slugs if panel_slugs is not None else [
            "reika-300x300", "reika-300x600", "arka-300x300",
        ]
        self.created: list[Any] = []
        self.flush_count = 0

    async def execute(self, statement: Any) -> _Result:
        text = str(statement)
        if "panels" in text:
            return _Result([self.panel_slugs])
        if "textures" in text:
            return _Result([self.texture_ids, self.existing_row])
        return _Result([[], self._match_existing(statement)])

    async def get(self, model: Any, ident: Any) -> Any:
        name = getattr(model, "__name__", "")
        if name == "PanelVariantModel":
            return SimpleNamespace(id=ident, is_active=True) if ident == "exec-1" else None
        return None

    def _match_existing(self, statement: Any) -> Any:
        """Возвращает existing_row, только если WHERE совпадает с его парой.

        Пара включает panel_family_1/2 — та же пара текстур с другой базовой
        панелью должна дать новую строку, а не дописывание в существующую.
        """
        if self.existing_row is None:
            return None
        try:
            params = statement.compile().params
        except Exception:
            return self.existing_row

        def value(prefix: str) -> str:
            for key, val in params.items():
                if key.startswith(prefix):
                    return str(val)
            return ""

        row = self.existing_row
        if (
            value("texture_id_1") == str(getattr(row, "texture_id_1", ""))
            and value("texture_id_2") == str(getattr(row, "texture_id_2", ""))
            and value("panel_family_1") == str(getattr(row, "panel_family_1", ""))
            and value("panel_family_2") == str(getattr(row, "panel_family_2", ""))
        ):
            return row
        return None

    def add(self, row: Any) -> None:
        self.created.append(row)

    async def flush(self) -> None:
        self.flush_count += 1


class TextureCombinationImageCreateGalleryTest(IsolatedAsyncioTestCase):
    def _body(
        self,
        texture_id_1: str,
        texture_id_2: str,
        image_path: str = "",
        image_paths: list[str] | None = None,
        panel_family_1: str = "",
        panel_family_2: str = "",
        execution_variant_id: str = "exec-1",
    ) -> TextureCombinationImageCreate:
        return TextureCombinationImageCreate(
            texture_id_1=texture_id_1,
            texture_id_2=texture_id_2,
            panel_family_1=panel_family_1,
            panel_family_2=panel_family_2,
            image_path=image_path,
            image_paths=image_paths or [],
            card={"title": "Тест", "execution_variant_id": execution_variant_id, "subtitle": "", "price": "", "area": "", "category": "home"},
        )

    async def test_creates_one_card_with_gallery(self) -> None:
        session = _Session(["tex-a"])
        response = await create_texture_combination_image_admin(
            body=self._body(
                "tex-a",
                "tex-a",
                image_paths=["a.webp", "b.webp", "c.webp"],
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )

        self.assertEqual(len(session.created), 1)
        self.assertEqual(response.image_path, "a.webp")
        self.assertEqual(response.image_paths, ["a.webp", "b.webp", "c.webp"])
        self.assertEqual(session.created[0].image_paths, ["a.webp", "b.webp", "c.webp"])

    async def test_append_photos_to_existing_card_keeps_one_row(self) -> None:
        existing = SimpleNamespace(
            id="card-1",
            texture_id_1="tex-a",
            texture_id_2="tex-a",
            panel_family_1="reika",
            panel_family_2="reika",
            image_path="first.webp",
            image_paths=["first.webp", "second.webp"],
            created_at=datetime(2026, 9, 18, 10, 0, 0),
            card={"title": "Гостиная", "subtitle": "", "price": "", "area": "", "category": "home"},
        )
        session = _Session(["tex-a"], existing_row=existing)

        # Повторная загрузка для той же текстуры и базовой панели: строка не
        # дублируется, фото дописываются в галерею той же карточки.
        response = await create_texture_combination_image_admin(
            body=self._body(
                "tex-a",
                "tex-a",
                panel_family_1="reika",
                panel_family_2="reika",
                image_paths=["third.webp", "first.webp"],
                image_path="third.webp",
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )

        self.assertEqual(len(session.created), 0, "не должна создаваться новая строка")
        self.assertEqual(response.id, "card-1")
        self.assertEqual(
            response.image_paths,
            ["first.webp", "second.webp", "third.webp"],
        )
        self.assertEqual(existing.image_paths, ["first.webp", "second.webp", "third.webp"])
        # Тексты из формы перезаписывают черновик, только если заполнено название.
        self.assertEqual(existing.card["title"], "Гостиная")

    async def test_rejects_unknown_texture(self) -> None:
        session = _Session(["tex-a"])
        with self.assertRaises(HTTPException) as raised:
            await create_texture_combination_image_admin(
                body=self._body(
                    "tex-a",
                    "missing",
                    image_paths=["x.webp"],
                ),
                _admin_id="admin-1",
                session=cast(Any, session),
            )
        self.assertEqual(raised.exception.status_code, 404)

    async def test_rejects_empty_gallery(self) -> None:
        session = _Session(["tex-a"])
        with self.assertRaises(HTTPException) as raised:
            await create_texture_combination_image_admin(
                body=self._body("tex-a", "tex-a"),
                _admin_id="admin-1",
                session=cast(Any, session),
            )
        self.assertEqual(raised.exception.status_code, 422)

    async def test_rejects_missing_execution(self) -> None:
        session = _Session(["tex-a"])
        with self.assertRaises(HTTPException) as raised:
            await create_texture_combination_image_admin(
                body=self._body("tex-a", "tex-a", image_paths=["a.webp"], execution_variant_id=""),
                _admin_id="admin-1",
                session=cast(Any, session),
            )
        self.assertEqual(raised.exception.status_code, 422)

    async def test_mono_card_stores_panel_family(self) -> None:
        # Моно: одна текстура + одно семейство базовой формы. Размер не участвует.
        session = _Session(["tex-a"])
        response = await create_texture_combination_image_admin(
            body=self._body(
                "tex-a",
                "tex-a",
                panel_family_1="reika",
                panel_family_2="reika",
                image_paths=["a.webp"],
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )
        self.assertEqual(session.created[0].panel_family_1, "reika")
        self.assertEqual(session.created[0].panel_family_2, "reika")
        self.assertEqual(response.panel_family_1, "reika")
        self.assertEqual(response.panel_family_2, "reika")

    async def test_combined_card_stores_two_panel_families(self) -> None:
        # Комбо: две разные текстуры + два разных семейства базовых форм.
        # Пара неупорядоченная — хранится в лексикографическом порядке.
        session = _Session(["tex-a", "tex-b"])
        response = await create_texture_combination_image_admin(
            body=self._body(
                "tex-a",
                "tex-b",
                panel_family_1="reika",
                panel_family_2="arka",
                image_paths=["a.webp"],
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )
        self.assertEqual(session.created[0].panel_family_1, "arka")
        self.assertEqual(session.created[0].panel_family_2, "reika")
        self.assertEqual(response.panel_family_1, "arka")
        self.assertEqual(response.panel_family_2, "reika")

    async def test_unknown_panel_family_rejected(self) -> None:
        session = _Session(["tex-a"], panel_slugs=["reika-300x300"])
        with self.assertRaises(HTTPException) as raised:
            await create_texture_combination_image_admin(
                body=self._body(
                    "tex-a",
                    "tex-a",
                    panel_family_1="arka",
                    panel_family_2="arka",
                    image_paths=["a.webp"],
                ),
                _admin_id="admin-1",
                session=cast(Any, session),
            )
        self.assertEqual(raised.exception.status_code, 404)

    async def test_same_textures_different_panel_creates_new_row(self) -> None:
        # Та же пара текстур, но другая базовая панель — это новая карточка,
        # а не дописывание в существующую.
        existing = SimpleNamespace(
            id="card-1",
            texture_id_1="tex-a",
            texture_id_2="tex-a",
            panel_family_1="reika",
            panel_family_2="reika",
            image_path="first.webp",
            image_paths=["first.webp"],
            created_at=datetime(2026, 9, 18, 10, 0, 0),
            card={},
        )
        session = _Session(["tex-a"], existing_row=existing)

        await create_texture_combination_image_admin(
            body=self._body(
                "tex-a",
                "tex-a",
                panel_family_1="arka",
                panel_family_2="arka",
                image_paths=["x.webp"],
            ),
            _admin_id="admin-1",
            session=cast(Any, session),
        )

        self.assertEqual(len(session.created), 1, "другая панель — новая карточка")
        self.assertEqual(session.created[0].panel_family_1, "arka")
        self.assertEqual(session.created[0].panel_family_2, "arka")