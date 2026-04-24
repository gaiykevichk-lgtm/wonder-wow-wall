"""Phase 5C — `UpdateCalibration` use case.

Mirrors `test_update_perspective.py`. Additionally checks the legacy float
mirror (`calibration_pixels_per_cm`) is kept in sync — pre-5C clients depend
on it and Phase 5C is not removing the field.
"""

import pytest

from app.application.visualizer.use_cases import (
    SaveVisualizationProject,
    UpdateCalibration,
)
from app.domain.visualizer.entities import VisualizationProject
from app.domain.visualizer.exceptions import StaleSceneVersionError
from app.domain.visualizer.value_objects import ScaleCalibration
from app.infrastructure.persistence.repositories.visualization_repo import (
    InMemoryVisualizationProjectRepository,
)


@pytest.fixture
def repo():
    return InMemoryVisualizationProjectRepository()


class TestUpdateCalibration:
    async def test_happy_path(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute(
            "user-1",
            VisualizationProject(name="P", calibration_auto_detected=True),
        )
        uc = UpdateCalibration(repo)
        new_cal = ScaleCalibration(
            method="manual", pixels_per_cm=7.5, wall_width_cm=300.0,
        )
        result = await uc.execute(saved.id, "user-1", new_cal, version=1)

        assert result is not None
        assert result.calibration == new_cal
        # Legacy float mirror updated — older clients reading
        # `calibration_pixels_per_cm` see the same value.
        assert result.calibration_pixels_per_cm == 7.5
        # Manual edit clears the "auto" badge.
        assert result.calibration_auto_detected is False
        assert result.version == 2

    async def test_stale_version_raises(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute("user-1", VisualizationProject(name="P"))
        uc = UpdateCalibration(repo)
        with pytest.raises(StaleSceneVersionError):
            await uc.execute(
                saved.id,
                "user-1",
                ScaleCalibration(method="manual", pixels_per_cm=5.0),
                version=42,
            )

    async def test_missing_project_returns_none(self, repo):
        uc = UpdateCalibration(repo)
        result = await uc.execute(
            "does-not-exist",
            "user-1",
            ScaleCalibration(method="manual", pixels_per_cm=5.0),
            version=1,
        )
        assert result is None

    async def test_cross_user_returns_none(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute("user-1", VisualizationProject(name="P"))
        uc = UpdateCalibration(repo)
        result = await uc.execute(
            saved.id,
            "user-2",
            ScaleCalibration(method="manual", pixels_per_cm=5.0),
            version=1,
        )
        assert result is None
