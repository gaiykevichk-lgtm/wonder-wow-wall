"""Phase 5B repository tests for the Visualizer bounded context.

Two layers covered here:

1. **InMemory** repo — exercised directly without any DB; verifies the
   optimistic-lock semantics that both backends share. Pure-python, fast.

2. **SQL** repo — round-tripped against an in-process SQLite (via
   `aiosqlite`) so we can prove the typed VOs (`ScaleCalibration`,
   the `version` column, the auto-detected flags) survive a real
   serialize → DB → deserialize cycle. Skipped if `sqlalchemy`/`aiosqlite`
   aren't installed (matches Phase 5A's `test_alembic.py` pattern for
   stripped sandboxes).
"""

from __future__ import annotations

from pathlib import Path

import pytest

# Optional deps — keep collection-friendly in stripped envs (mirrors test_alembic).
pytest.importorskip("sqlalchemy")
pytest.importorskip("aiosqlite")
pytest_asyncio = pytest.importorskip("pytest_asyncio")  # noqa: F841

import sqlalchemy as sa  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.domain.visualizer.entities import (  # noqa: E402
    PlacedPanelData,
    VisualizationProject,
)
from app.domain.visualizer.exceptions import StaleSceneVersionError  # noqa: E402
from app.domain.visualizer.value_objects import ScaleCalibration  # noqa: E402
from app.infrastructure.persistence.database import Base  # noqa: E402
from app.infrastructure.persistence.models import UserModel  # noqa: E402
from app.infrastructure.persistence.repositories.visualization_repo import (  # noqa: E402
    InMemoryVisualizationProjectRepository,
    SqlVisualizationProjectRepository,
)


# ═══════════════════════════════════════════════════════════════════════
# In-Memory — covers shared optimistic-lock semantics
# ═══════════════════════════════════════════════════════════════════════

class TestInMemoryOptimisticLock:
    """Both repo backends share optimistic-lock contract; assert it once
    in-memory (cheap), then re-run the stale-version case against SQL."""

    @pytest.mark.asyncio
    async def test_save_then_update_increments_version(self):
        repo = InMemoryVisualizationProjectRepository()
        proj = VisualizationProject(name="P", user_id="u1")
        await repo.save(proj)
        assert proj.version == 1  # save() leaves caller's version untouched

        proj.name = "P-renamed"
        updated = await repo.update(proj)
        assert updated.version == 2

        # Round-tripping the same in-flight entity again must succeed
        # because update() already bumped the entity's `version` to match.
        updated.name = "P-twice"
        again = await repo.update(updated)
        assert again.version == 3

    @pytest.mark.asyncio
    async def test_update_with_stale_version_raises(self):
        repo = InMemoryVisualizationProjectRepository()
        proj = VisualizationProject(name="P", user_id="u1")
        await repo.save(proj)

        # Tab A reads → bumps to v2.
        a = await repo.get_by_id(proj.id)
        assert a is not None
        a.name = "from tab A"
        await repo.update(a)

        # Tab B held the old v1 view; trying to update raises.
        b = VisualizationProject(name="from tab B", id=proj.id, user_id="u1", version=1)
        with pytest.raises(StaleSceneVersionError, match="server version 2"):
            await repo.update(b)


# ═══════════════════════════════════════════════════════════════════════
# SQL — proves typed VOs round-trip through real serialization
# ═══════════════════════════════════════════════════════════════════════

@pytest.fixture
async def sql_session(tmp_path: Path):
    """Spin up an aiosqlite-backed AsyncSession with a freshly created schema.

    Uses `Base.metadata.create_all` (not Alembic) — schema correctness is
    Phase 5A's `test_alembic.py` job; here we just need a valid schema.
    """
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'repo_test.db'}"
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        # Seed a user — FK constraint requires it on most engines, and even
        # if SQLite skips FK enforcement it documents the realistic shape.
        session.add(UserModel(id="u1", email="u@x", password_hash="h", name="U"))
        await session.commit()
        yield session
    await engine.dispose()


class TestSqlRoundTrip:
    @pytest.mark.asyncio
    async def test_round_trip_preserves_phase5b_fields(self, sql_session):
        repo = SqlVisualizationProjectRepository(sql_session)
        cal = ScaleCalibration(
            method="reference", pixels_per_cm=6.7, wall_width_cm=300.0
        )
        original = VisualizationProject(
            name="Round-trip",
            user_id="u1",
            photo_url="data:image/png;base64,...",
            photo_width=1024,
            photo_height=768,
            calibration_pixels_per_cm=6.7,  # legacy mirror
            calibration=cal,                 # typed VO
            perspective_corners=[
                {"x": 10, "y": 10}, {"x": 100, "y": 10},
                {"x": 100, "y": 100}, {"x": 10, "y": 100},
            ],
            perspective_auto_detected=True,
            calibration_auto_detected=True,
            panels=[PlacedPanelData(design_id="d1", x=5, y=5)],
        )
        await repo.save(original)
        await sql_session.commit()

        loaded = await repo.get_by_id(original.id)
        assert loaded is not None
        # Phase 5B fields — assert byte-for-byte identity through JSON.
        assert loaded.calibration == cal
        assert loaded.perspective_auto_detected is True
        assert loaded.calibration_auto_detected is True
        assert loaded.version == 1
        # Existing legacy fields still flow through.
        assert loaded.calibration_pixels_per_cm == 6.7
        assert loaded.perspective_corners is not None
        assert len(loaded.perspective_corners) == 4

    @pytest.mark.asyncio
    async def test_sql_update_stale_version_raises(self, sql_session):
        repo = SqlVisualizationProjectRepository(sql_session)
        proj = VisualizationProject(name="P", user_id="u1")
        await repo.save(proj)
        await sql_session.commit()

        # Tab A bumps to v2.
        a = await repo.get_by_id(proj.id)
        assert a is not None
        a.name = "A"
        await repo.update(a)
        await sql_session.commit()

        # Tab B sends v1.
        b = VisualizationProject(name="B", id=proj.id, user_id="u1", version=1)
        with pytest.raises(StaleSceneVersionError):
            await repo.update(b)

    @pytest.mark.asyncio
    async def test_legacy_row_without_calibration_loads_as_none(self, sql_session):
        """Rows written before 5C (no `calibration` JSON) must load with
        `entity.calibration is None` — no NPE in the mapper."""
        repo = SqlVisualizationProjectRepository(sql_session)
        proj = VisualizationProject(
            name="Legacy",
            user_id="u1",
            calibration_pixels_per_cm=5.0,
            calibration=None,
        )
        await repo.save(proj)
        await sql_session.commit()
        loaded = await repo.get_by_id(proj.id)
        assert loaded is not None
        assert loaded.calibration is None
        assert loaded.calibration_pixels_per_cm == 5.0
