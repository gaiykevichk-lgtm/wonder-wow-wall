"""Regression coverage for panel-variant interior design photos."""

from unittest import IsolatedAsyncioTestCase

from app.application.catalog.panel_variant_use_cases import (
    CreatePanelVariantAdmin,
    ListPanelVariantsPublic,
    UpdatePanelVariantAdmin,
)
from app.domain.catalog.panel import Panel
from app.domain.catalog.texture import Texture
from app.domain.catalog.value_objects import PanelSize
from app.infrastructure.persistence.panel_variant_repo import (
    InMemoryPanelVariantRepository,
)


class _PanelLookupRepository:
    """Minimal collaborator required by ``ListPanelVariantsPublic``."""

    def __init__(self, panel: Panel) -> None:
        self._panel = panel

    async def get_by_id(self, panel_id: str) -> Panel | None:
        return self._panel if self._panel.id == panel_id else None


class _TextureLookupRepository:
    """Minimal collaborator required by ``ListPanelVariantsPublic``."""

    def __init__(self, texture: Texture) -> None:
        self._texture = texture

    async def get_by_id(self, texture_id: str) -> Texture | None:
        return self._texture if self._texture.id == texture_id else None


class TestPanelVariantDesignImages(IsolatedAsyncioTestCase):
    async def test_update_keeps_design_photos_separate_from_execution_photos(
        self,
    ) -> None:
        variant_repo = InMemoryPanelVariantRepository()
        variant = await CreatePanelVariantAdmin(variant_repo).execute(
            panel_id="panel-1",
            texture_id="texture-1",
            image_paths=["execution.webp"],
        )

        updated = await UpdatePanelVariantAdmin(variant_repo).execute(
            variant_id=variant.id,
            design_image_paths=["interior.webp"],
        )

        self.assertEqual(updated.image_paths, ["execution.webp"])
        self.assertEqual(updated.design_image_paths, ["interior.webp"])
        stored = await variant_repo.get_by_id(variant.id)
        if stored is None:
            self.fail("updated panel variant disappeared from repository")
        self.assertEqual(stored.design_image_paths, ["interior.webp"])

    async def test_public_variant_includes_design_photos_for_its_texture(
        self,
    ) -> None:
        variant_repo = InMemoryPanelVariantRepository()
        panel = Panel(
            id="panel-1",
            name="ДЕМО 1",
            slug="demo-1",
            size=PanelSize(300, 300, "30×30 см"),
            base_price=1200,
        )
        texture = Texture(
            id="texture-1",
            name="Текстиль",
            slug="textile",
        )
        await CreatePanelVariantAdmin(variant_repo).execute(
            panel_id=panel.id,
            texture_id=texture.id,
            image_paths=["execution.webp"],
            design_image_paths=["interior-1.webp", "interior-2.webp"],
        )

        items, total = await ListPanelVariantsPublic(
            variant_repo,
            _PanelLookupRepository(panel),
            _TextureLookupRepository(texture),
        ).execute(panel_id=panel.id, texture_id=texture.id)

        self.assertEqual(total, 1)
        self.assertEqual(items[0]["image_paths"], ["execution.webp"])
        self.assertEqual(
            items[0]["design_image_paths"],
            ["interior-1.webp", "interior-2.webp"],
        )
