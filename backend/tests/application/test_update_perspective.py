"""Phase 5C — `UpdatePerspective` use case.

Verifies the partial-update path used by the frontend's debounced corner-drag
PATCH:
* happy path → corners persisted, `perspective_auto_detected` cleared, version bumped.
* `corners=None` → perspective cleared.
* degenerate quad → `CollinearCornersError` (mapped to 422 by the API layer).
* stale version → `StaleSceneVersionError` (mapped to 409 by the API layer).
* missing project / cross-user access → `None`.
"""

import pytest

from app.application.visualizer.use_cases import (
    SaveVisualizationProject,
    UpdatePerspective,
)
from app.domain.visualizer.entities import VisualizationProject
from app.domain.visualizer.exceptions import (
    CollinearCornersError,
    StaleSceneVersionError,
)
from app.domain.visualizer.value_objects import PerspectiveCorners, Point
from app.infrastructure.persistence.repositories.visualization_repo import (
    InMemoryVisualizationProjectRepository,
)


@pytest.fixture
def repo():
    return InMemoryVisualizationProjectRepository()


def _square(side: float = 100.0) -> PerspectiveCorners:
    return PerspectiveCorners(
        top_left=Point(0, 0),
        top_right=Point(side, 0),
        bottom_right=Point(side, side),
        bottom_left=Point(0, side),
    )


class TestUpdatePerspective:
    async def test_happy_path_sets_corners_and_clears_auto_flag(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute(
            "user-1",
            VisualizationProject(name="P", perspective_auto_detected=True),
        )
        assert saved.version == 1

        uc = UpdatePerspective(repo)
        result = await uc.execute(saved.id, "user-1", _square(), version=1)

        assert result is not None
        assert result.perspective_corners == [
            {"x": 0, "y": 0}, {"x": 100, "y": 0},
            {"x": 100, "y": 100}, {"x": 0, "y": 100},
        ]
        # User edits clear the auto-detected banner unconditionally — the green
        # "we detected this for you" UI only applies to detector output.
        assert result.perspective_auto_detected is False
        # repo.update bumps version after the optimistic-lock check.
        assert result.version == 2

    async def test_clearing_corners(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute(
            "user-1",
            VisualizationProject(name="P", perspective_corners=_square().as_dicts()),
        )
        uc = UpdatePerspective(repo)
        result = await uc.execute(saved.id, "user-1", None, version=1)
        assert result is not None
        assert result.perspective_corners is None

    async def test_degenerate_quad_raises_collinear(self, repo):
        # The use case never sees a CollinearCornersError directly because the
        # API layer constructs the VO. Verify the VO-level guard separately so
        # if anyone introduces a "construct VO inside the UC" path they still
        # get the same protection.
        with pytest.raises(CollinearCornersError):
            PerspectiveCorners(
                top_left=Point(0, 0), top_right=Point(0, 0),
                bottom_right=Point(0, 0), bottom_left=Point(0, 0),
            )

    async def test_stale_version_raises(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute("user-1", VisualizationProject(name="P"))
        uc = UpdatePerspective(repo)
        with pytest.raises(StaleSceneVersionError):
            # Client thinks it's on v=99 but server is on v=1 → conflict.
            await uc.execute(saved.id, "user-1", _square(), version=99)

    async def test_missing_project_returns_none(self, repo):
        uc = UpdatePerspective(repo)
        result = await uc.execute("does-not-exist", "user-1", _square(), version=1)
        assert result is None

    async def test_cross_user_returns_none(self, repo):
        save = SaveVisualizationProject(repo)
        saved = await save.execute("user-1", VisualizationProject(name="P"))
        uc = UpdatePerspective(repo)
        result = await uc.execute(saved.id, "user-2", _square(), version=1)
        assert result is None
