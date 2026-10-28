from types import SimpleNamespace as NS
from typing import cast
from sqlalchemy.ext.asyncio import AsyncSession
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from app.infrastructure.api.admin.panels import duplicate_unassigned_panel_admin


class DuplicateUnassignedPanelTest(IsolatedAsyncioTestCase):
    async def test_copies_base_panel_without_assignment(self):
        source = NS(id='p', slug='shape', name='Shape', size=NS(width_mm=300, height_mm=300, label='30x30'),
                    base_price=12, description='note', photo_path='photo', photo_paths=['photo'],
                    form_preview_path='silhouette', is_active=False)
        copy = NS(**{**vars(source), 'id': 'copy'})
        copy.created_at = NS(isoformat=lambda: '2026-01-01')
        repo = NS(get_by_id=AsyncMock(return_value=source))
        session = NS(scalar=AsyncMock(return_value=None))
        with patch('app.infrastructure.api.admin.panels.CreatePanelAdmin') as creator:
            creator.return_value.execute = AsyncMock(return_value=copy)
            result = await duplicate_unassigned_panel_admin('p', 'admin', repo, cast(AsyncSession, session))
            self.assertEqual(result.id, 'copy')
            self.assertEqual(result.slug, 'shape')
            self.assertEqual(result.name, 'Shape')
            creator.return_value.execute.assert_awaited_once()
            call = creator.return_value.execute.await_args
            assert call is not None
            self.assertFalse(call.kwargs['is_active'])
            self.assertEqual(call.kwargs['name'], 'Shape')
            self.assertEqual(call.kwargs['slug'], 'shape')
            self.assertEqual(call.kwargs['form_preview_path'], 'silhouette')

    async def test_rejects_panel_with_catalog_row(self):
        repo = NS(get_by_id=AsyncMock(return_value=NS(id='p')))
        session = NS(scalar=AsyncMock(return_value='assignment'))
        with self.assertRaises(HTTPException) as raised:
            await duplicate_unassigned_panel_admin('p', 'admin', repo, cast(AsyncSession, session))
        self.assertEqual(raised.exception.status_code, 409)
