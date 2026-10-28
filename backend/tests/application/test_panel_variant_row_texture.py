from types import SimpleNamespace
from typing import Any, cast
from unittest import IsolatedAsyncioTestCase

from app.infrastructure.api.admin.panel_variants import (
    UpdatePanelVariantRowTextureRequest,
    update_panel_variant_row_texture_admin,
)


class _Scalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Result:
    def __init__(self, *, one=None, rows=None):
        self._one = one
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._one

    def scalars(self):
        return _Scalars(self._rows)


class _Session:
    def __init__(self, assignment, variants):
        self.assignment = assignment
        self.variants = variants
        self.calls = 0
        self.flush_count = 0

    async def execute(self, _query):
        self.calls += 1
        if self.calls == 1:
            return _Result(one=self.assignment)
        if self.calls == 2:
            return _Result(one=None)
        return _Result(rows=self.variants)

    async def flush(self):
        self.flush_count += 1


class _TextureRepo:
    async def get_by_id(self, texture_id):
        return SimpleNamespace(id=texture_id)


class PanelVariantRowTextureTest(IsolatedAsyncioTestCase):
    async def test_new_panel_creates_catalog_row_for_texture(self):
        from unittest.mock import AsyncMock, MagicMock
        panel = SimpleNamespace(is_active=True)
        result = _Result(one=None)
        session = SimpleNamespace(
            execute=AsyncMock(side_effect=[_Result(one=panel), result, _Result(rows=[])]),
            add=MagicMock(), flush=AsyncMock(),
        )
        response = await update_panel_variant_row_texture_admin(
            UpdatePanelVariantRowTextureRequest(panel_id="new-panel", texture_id="new"),
            "admin", _TextureRepo(), cast(Any, session),
        )
        self.assertEqual(response, [])
        created = session.add.call_args.args[0]
        self.assertEqual((created.panel_id, created.texture_id, created.sort_order), ("new-panel", "new", -1))
        self.assertTrue(created.is_catalog_row)
        session.flush.assert_awaited_once()

    async def test_empty_existing_row_changes_texture(self):
        assignment = SimpleNamespace(texture_id="old", updated_at=None)
        session = _Session(assignment, [])
        response = await update_panel_variant_row_texture_admin(
            UpdatePanelVariantRowTextureRequest(panel_id="panel-1", current_texture_id="old", texture_id="new"),
            "admin", _TextureRepo(), cast(Any, session),
        )
        self.assertEqual(response, [])
        self.assertEqual(assignment.texture_id, "new")
        self.assertEqual(session.flush_count, 1)

    async def test_updates_assignment_and_every_execution(self):
        assignment = SimpleNamespace(texture_id="old", updated_at=None)
        variants = [
            SimpleNamespace(
                id=f"variant-{index}", name="", slug="", panel_id="panel-1",
                texture_id="old", color_id=None, color_hex=None,
                image_paths=[], design_image_paths=[], recommendation_image_paths=[],
                sort_order=index, is_active=True,
                created_at=SimpleNamespace(isoformat=lambda: "created"),
                updated_at=SimpleNamespace(isoformat=lambda: "updated"),
            )
            for index in range(2)
        ]
        session = _Session(assignment, variants)

        response = await update_panel_variant_row_texture_admin(
            body=UpdatePanelVariantRowTextureRequest(
                panel_id="panel-1", current_texture_id="old", texture_id="new",
            ),
            _admin_id="admin-1",
            texture_repo=_TextureRepo(),
            session=cast(Any, session),
        )

        self.assertEqual(assignment.texture_id, "new")
        self.assertEqual([item.texture_id for item in variants], ["new", "new"])
        self.assertEqual([item.texture_id for item in response], ["new", "new"])
        self.assertEqual(session.flush_count, 1)
