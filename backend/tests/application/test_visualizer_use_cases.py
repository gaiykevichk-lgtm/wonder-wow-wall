import pytest
from app.domain.visualizer.entities import VisualizationProject, PlacedPanelData
from app.application.visualizer.use_cases import (
    SaveVisualizationProject,
    GetVisualizationProjects,
    GetVisualizationProject,
    UpdateVisualizationProject,
    DeleteVisualizationProject,
)
from app.infrastructure.persistence.repositories.visualization_repo import (
    InMemoryVisualizationProjectRepository,
)


@pytest.fixture
def repo():
    return InMemoryVisualizationProjectRepository()


class TestSaveVisualizationProject:
    @pytest.mark.asyncio
    async def test_save(self, repo):
        uc = SaveVisualizationProject(repo)
        project = VisualizationProject(name="My Project", photo_url="data:image/png;base64,abc")
        saved = await uc.execute("user-1", project)
        assert saved.id
        assert saved.user_id == "user-1"
        assert saved.name == "My Project"

    @pytest.mark.asyncio
    async def test_save_with_panels(self, repo):
        uc = SaveVisualizationProject(repo)
        panels = [PlacedPanelData(design_id="d1", x=10, y=20)]
        project = VisualizationProject(name="With Panels", panels=panels)
        saved = await uc.execute("user-1", project)
        assert len(saved.panels) == 1
        assert saved.panels[0].design_id == "d1"


class TestGetVisualizationProjects:
    @pytest.mark.asyncio
    async def test_empty(self, repo):
        uc = GetVisualizationProjects(repo)
        result = await uc.execute("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_only_user_projects(self, repo):
        save_uc = SaveVisualizationProject(repo)
        await save_uc.execute("user-1", VisualizationProject(name="P1"))
        await save_uc.execute("user-2", VisualizationProject(name="P2"))
        await save_uc.execute("user-1", VisualizationProject(name="P3"))

        uc = GetVisualizationProjects(repo)
        result = await uc.execute("user-1")
        assert len(result) == 2
        names = {p.name for p in result}
        assert names == {"P1", "P3"}


class TestGetVisualizationProject:
    @pytest.mark.asyncio
    async def test_get_own_project(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))

        uc = GetVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-1")
        assert result is not None
        assert result.name == "P1"

    @pytest.mark.asyncio
    async def test_cannot_get_other_users_project(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))

        uc = GetVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-2")
        assert result is None

    @pytest.mark.asyncio
    async def test_not_found(self, repo):
        uc = GetVisualizationProject(repo)
        result = await uc.execute("nonexistent", "user-1")
        assert result is None


class TestUpdateVisualizationProject:
    @pytest.mark.asyncio
    async def test_update(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="Original"))

        uc = UpdateVisualizationProject(repo)
        updated_data = VisualizationProject(name="Updated", calibration_pixels_per_cm=10.0)
        result = await uc.execute(saved.id, "user-1", updated_data)
        assert result is not None
        assert result.name == "Updated"
        assert result.calibration_pixels_per_cm == 10.0

    @pytest.mark.asyncio
    async def test_cannot_update_other_users_project(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))

        uc = UpdateVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-2", VisualizationProject(name="Hacked"))
        assert result is None

    @pytest.mark.asyncio
    async def test_preserves_created_at(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))
        original_created = saved.created_at

        uc = UpdateVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-1", VisualizationProject(name="Updated"))
        assert result is not None
        assert result.created_at == original_created


class TestDeleteVisualizationProject:
    @pytest.mark.asyncio
    async def test_delete(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))

        uc = DeleteVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-1")
        assert result is True

        # Verify deleted
        get_uc = GetVisualizationProject(repo)
        assert await get_uc.execute(saved.id, "user-1") is None

    @pytest.mark.asyncio
    async def test_cannot_delete_other_users_project(self, repo):
        save_uc = SaveVisualizationProject(repo)
        saved = await save_uc.execute("user-1", VisualizationProject(name="P1"))

        uc = DeleteVisualizationProject(repo)
        result = await uc.execute(saved.id, "user-2")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, repo):
        uc = DeleteVisualizationProject(repo)
        result = await uc.execute("nonexistent", "user-1")
        assert result is False
