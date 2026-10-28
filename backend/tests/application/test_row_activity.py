from types import SimpleNamespace as NS
from typing import cast
from sqlalchemy.ext.asyncio import AsyncSession
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from app.infrastructure.api.admin.panel_variants import (
    UpdatePanelVariantRowActivityRequest, update_panel_variant_row_activity_admin,
    PanelVariantGroupRequest, duplicate_panel_variant_group_admin,
)

class RowActionsTest(IsolatedAsyncioTestCase):
    async def test_activity_empty_and_populated(self):
        for count in (0, 2):
            row = NS(is_active=True)
            variants = [NS(is_active=True) for _ in range(count)]
            session = NS(execute=AsyncMock(side_effect=[
                NS(scalar_one_or_none=lambda: row),
                NS(scalars=lambda: NS(all=lambda: variants)),
            ]), flush=AsyncMock())
            result = await update_panel_variant_row_activity_admin(
                UpdatePanelVariantRowActivityRequest(panel_id='p', texture_id='t', is_active=False),
                'admin', cast(AsyncSession, session))
            self.assertEqual(result.status_code, 204)
            self.assertTrue(all(not item.is_active for item in [row, *variants]))
            session.flush.assert_awaited_once()

    async def test_activity_missing(self):
        session = NS(execute=AsyncMock(return_value=NS(scalar_one_or_none=lambda: None)))
        with self.assertRaises(HTTPException) as raised:
            await update_panel_variant_row_activity_admin(
                UpdatePanelVariantRowActivityRequest(panel_id='p', texture_id='t', is_active=False),
                'admin', cast(AsyncSession, session))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_duplicate_empty_inactive_row(self):
        source = NS(slug='panel', name='Panel', size=None, base_price=1,
                    description='', photo_path=None, photo_paths=[], form_preview_path=None, is_active=True)
        row = NS(sort_order=1, is_active=False)
        added = []
        session = NS(execute=AsyncMock(side_effect=[
            NS(scalar_one_or_none=lambda: row),
            NS(scalars=lambda: NS(all=lambda: [row])),
            NS(scalar_one_or_none=lambda: None),
        ]), add=added.append)
        repo = NS(list_by_panel=AsyncMock(return_value=[]))
        panel_repo = NS(get_by_id=AsyncMock(return_value=source))
        with patch('app.application.catalog.panel_use_cases.CreatePanelAdmin.execute',
                   new=AsyncMock(return_value=NS(id='copy', name='Panel', slug='panel'))) as create:
            result = await duplicate_panel_variant_group_admin(
                PanelVariantGroupRequest(panel_id='p', texture_id='t'), 'admin', repo, panel_repo, cast(AsyncSession, session))
        self.assertEqual(result.variants, [])
        call = create.await_args
        assert call is not None
        self.assertEqual(call.kwargs['name'], 'Panel')
        self.assertEqual(call.kwargs['slug'], 'panel')
        self.assertEqual(added[0].panel_id, 'copy')
        self.assertFalse(added[0].is_active)
        self.assertTrue(added[0].is_catalog_row)
