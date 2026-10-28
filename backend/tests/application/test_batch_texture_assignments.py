"""Batch endpoint orchestration with isolated collaborators, no database writes."""
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.infrastructure.api.admin.panel_texture_assignments import BatchAssignmentsRequest, batch_panel_texture_assignments

class BatchAssignmentTests(IsolatedAsyncioTestCase):
    async def run_batch(self, mode):
        session = AsyncMock()
        result = MagicMock()
        row = MagicMock(texture_id='existing')
        result.scalars.return_value.all.return_value = [row]
        session.execute.return_value = result
        panels, textures = AsyncMock(), AsyncMock()
        with patch('app.infrastructure.api.admin.panel_texture_assignments.replace_panel_texture_assignments', new_callable=AsyncMock) as replace:
            result = await batch_panel_texture_assignments(BatchAssignmentsRequest(panel_ids=['b','a','a'], texture_ids=['new'], mode=mode), 'admin', session, panels, textures)
            self.assertEqual(result, {'updated_panels': 2})
            self.assertEqual([call.kwargs['panel_id'] for call in replace.call_args_list], ['a','b'])
            return replace.call_args.kwargs['body'].texture_ids

    async def test_add_preserves_existing(self):
        self.assertEqual(await self.run_batch('add'), ['existing','new'])

    async def test_remove_preserves_unselected(self):
        self.assertEqual(await self.run_batch('remove'), ['existing'])

    async def test_replace_is_explicit(self):
        self.assertEqual(await self.run_batch('replace'), ['new'])

    async def test_missing_panel_prevents_writes(self):
        session, panels, textures = AsyncMock(), AsyncMock(), AsyncMock()
        panels.get_by_id.return_value = None
        with self.assertRaises(HTTPException):
            await batch_panel_texture_assignments(BatchAssignmentsRequest(panel_ids=['missing'], texture_ids=['new'], mode='add'), 'admin', session, panels, textures)
        session.execute.assert_not_awaited()
