"""Isolated public projection tests; no product database is touched."""
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock

from app.application.catalog.panel_variant_use_cases import ListPanelVariantsPublic
from app.domain.catalog.panel import Panel
from app.domain.catalog.texture import Texture
from app.domain.catalog.panel_variant import PanelVariant
from app.domain.catalog.value_objects import PanelSize


class AssignmentVisibilityTests(IsolatedAsyncioTestCase):
    async def test_disabled_assignment_hides_then_restores_without_mutation(self):
        panel = Panel(id='p', name='Fixture', slug='fixture', size=PanelSize(300, 300, '30'), base_price=1)
        texture = Texture(id='t', name='Fixture', slug='fixture')
        variant = PanelVariant(panel_id='p', texture_id='t', image_paths=['product'], design_image_paths=['interior'])
        repo = AsyncMock()
        repo.list_by_panel.return_value = [variant]
        repo.filter_allowed_variants.return_value = []
        panels, textures = AsyncMock(), AsyncMock()
        panels.get_by_id.return_value = panel
        textures.get_by_id.return_value = texture
        public = ListPanelVariantsPublic(repo, panels, textures)
        self.assertEqual(await public.execute(panel_id='p'), ([], 0))
        repo.filter_allowed_variants.return_value = [variant]
        items, count = await public.execute(panel_id='p')
        self.assertEqual(count, 1)
        self.assertEqual(items[0]['id'], variant.id)
        self.assertEqual(items[0]['design_image_paths'], ['interior'])
        self.assertEqual(variant.image_paths, ['product'])
        self.assertTrue(variant.is_active)
        repo.update.assert_not_called()
        repo.delete.assert_not_called()

    async def test_inactive_texture_is_not_public(self):
        repo = AsyncMock()
        variant = PanelVariant(panel_id='p', texture_id='t')
        repo.list_by_panel.return_value = [variant]
        repo.filter_allowed_variants.return_value = [variant]
        panels, textures = AsyncMock(), AsyncMock()
        panels.get_by_id.return_value = Panel(id='p', name='Fixture', slug='fixture', size=PanelSize(300,300,'30'), base_price=1)
        textures.get_by_id.return_value = Texture(id='t', name='Fixture', slug='fixture', is_active=False)
        self.assertEqual(await ListPanelVariantsPublic(repo, panels, textures).execute(panel_id='p'), ([], 0))
