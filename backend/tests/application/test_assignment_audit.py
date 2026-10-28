from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock
from app.infrastructure.api.admin.panel_texture_assignments import replace_panel_texture_assignments, ReplacePanelTextureAssignmentsRequest

class AssignmentAuditTests(IsolatedAsyncioTestCase):
    async def test_records_actor_and_before_after_without_photos(self):
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        session.execute.return_value = result
        session.add = MagicMock()
        panels, textures, audit = AsyncMock(), AsyncMock(), AsyncMock()
        await replace_panel_texture_assignments('panel-test', ReplacePanelTextureAssignmentsRequest(texture_ids=['texture-test'], expected_texture_ids=[]), 'actor-test', session, panels, textures, audit)
        entry = audit.append.call_args.args[0]
        self.assertEqual(entry.actor_id, 'actor-test')
        self.assertEqual(entry.target_id, 'panel-test')
        self.assertEqual(entry.payload, {'before_texture_ids': [], 'after_texture_ids': ['texture-test']})

    async def test_unchanged_set_has_no_audit_noise(self):
        session = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        session.execute.return_value = result
        panels, textures, audit = AsyncMock(), AsyncMock(), AsyncMock()
        await replace_panel_texture_assignments('panel-test', ReplacePanelTextureAssignmentsRequest(texture_ids=[], expected_texture_ids=[]), 'actor-test', session, panels, textures, audit)
        audit.append.assert_not_called()
