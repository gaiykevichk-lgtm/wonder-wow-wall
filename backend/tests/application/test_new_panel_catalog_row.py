"""Новый вариант обязан появиться в строке каталога."""
from types import SimpleNamespace as NS
from typing import Any, cast
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from app.infrastructure.api.admin.panel_variants import CreatePanelVariantRequest, create_panel_variant_admin


class NewPanelCatalogRowTest(IsolatedAsyncioTestCase):
    async def test_variant_creation_marks_existing_assignment_as_catalog_row(self):
        assignment = NS(is_catalog_row=False, is_active=True)
        session = NS(execute=AsyncMock(side_effect=[NS(), NS(scalar_one_or_none=lambda: assignment)]),
                     flush=AsyncMock(), add=MagicMock())
        panel_repo = NS(get_by_id=AsyncMock(return_value=NS(id="p")))
        texture_repo = NS(get_by_id=AsyncMock(return_value=NS(id="t")))
        variant = NS(id="v", panel_id="p", texture_id="t", name="V", slug="v", color_id=None,
                     color_hex=None, image_paths=[], design_image_paths=[], recommendation_image_paths=[],
                     sort_order=0, is_active=True,
                     created_at=NS(isoformat=lambda: "created"), updated_at=NS(isoformat=lambda: "updated"))
        with patch("app.infrastructure.api.admin.panel_variants.CreatePanelVariantAdmin") as creator:
            creator.return_value.execute = AsyncMock(return_value=variant)
            result = await create_panel_variant_admin(
                CreatePanelVariantRequest(panel_id="p", texture_id="t", name="V"),
                "admin", NS(), panel_repo, texture_repo, cast(Any, session),
            )
        self.assertEqual(result.id, "v")
        self.assertTrue(assignment.is_catalog_row)
        session.add.assert_not_called()
        session.flush.assert_awaited_once()
