"""Complete public projection must include panels beyond the first 100 variants."""
from unittest import IsolatedAsyncioTestCase
from types import SimpleNamespace
from typing import cast
from app.domain.catalog.repositories import PanelVariantRepository, PanelRepository, TextureRepository
from app.application.catalog.panel_variant_use_cases import ListPanelVariantsPublic


class TestPublicVariantPagination(IsolatedAsyncioTestCase):
    async def test_all_pages_before_visibility_filter_and_texture_filter(self):
        variants = [SimpleNamespace(id=str(i), name='Рейка Природный камень' if i == 0 else f'вариант {i}', slug=f'variant-{i}', panel_id='column' if i >= 100 else 'other', texture_id='wood', color_id=None, color_hex='', image_paths=[], design_image_paths=[], recommendation_image_paths=[], sort_order=i, is_active=True) for i in range(139)]
        class Repo:
            calls = []
            async def list_all(self, is_active, offset, limit):
                self.calls.append(offset)
                return variants[offset:offset+limit], len(variants)
            async def filter_allowed_variants(self, items):
                return [v for v in items if v.id != '101']
        class Panels:
            async def get_by_id(self, id):
                return SimpleNamespace(name=id, is_active=True, size=SimpleNamespace(label='30×30 см'))
        class Textures:
            async def get_by_id(self, id):
                return SimpleNamespace(name=id, is_active=True)
        repo = Repo()
        items, total = await ListPanelVariantsPublic(cast(PanelVariantRepository, repo), cast(PanelRepository, Panels()), cast(TextureRepository, Textures())).execute(texture_id='wood')
        self.assertEqual(repo.calls, [0, 100])
        self.assertEqual(total, 138)
        self.assertEqual(sum(v['panel_id'] == 'column' for v in items), 38)
        self.assertIn('138', [v['id'] for v in items])
        named_variant = next(v for v in items if v['id'] == '0')
        self.assertEqual(named_variant['name'], 'Рейка Природный камень')
        self.assertEqual(named_variant['slug'], 'variant-0')
