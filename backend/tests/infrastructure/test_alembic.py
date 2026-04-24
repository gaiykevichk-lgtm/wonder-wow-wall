"""Alembic smoke-tests for the migration chain (Phase 5A baseline + 5B columns).

Strategy
────────
Run the migration chain against a throw-away **SQLite** database via
`aiosqlite` so the test rig works without a postgres server. Production
still runs on postgres + asyncpg (see `app.config.settings.DATABASE_URL`).

The pg-only DDL in migration 001 (`CREATE SEQUENCE`) is guarded by a
dialect check so this round-trip succeeds on SQLite. Everything else is
portable.

Coverage at a glance:
- Phase 5A: full upgrade head, `head → base → head`, downgrade-to-base.
- Phase 5B: migration 005 adds `calibration`, `*_auto_detected`, `version`
  columns to `visualization_projects`; downgrade -1 drops them but keeps
  the table (created by 004).

The three explicit dependencies (`alembic`, `sqlalchemy`, `aiosqlite`) are
declared in `requirements.txt`; if they aren't installed in the current
interpreter (e.g. lightweight sandbox), the whole module is skipped rather
than failing — CI installs the pinned set and runs these tests for real.
"""

from __future__ import annotations

from pathlib import Path

import pytest

# Skip-if-missing instead of import-error: lets the test file load in stripped
# environments without breaking collection.
alembic_cmd = pytest.importorskip("alembic.command")
alembic_cfg_mod = pytest.importorskip("alembic.config")
pytest.importorskip("sqlalchemy")
pytest.importorskip("aiosqlite")

import sqlite3  # noqa: E402  (after importorskip on sqlalchemy)

from app.config import settings  # noqa: E402

BACKEND_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def alembic_cfg(tmp_path, monkeypatch):
    """Build an Alembic Config pointing at a temp SQLite DB.

    `env.py` re-reads `settings.DATABASE_URL` and overrides the cfg's URL
    on every invocation, so we mutate the live `settings` singleton — that
    is the only knob `env.py` consults.
    """
    db_path = tmp_path / "alembic_test.db"
    sqlite_url = f"sqlite+aiosqlite:///{db_path}"
    monkeypatch.setattr(settings, "DATABASE_URL", sqlite_url)

    cfg = alembic_cfg_mod.Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", sqlite_url)
    return cfg, db_path


def _table_exists(db_path: Path, name: str) -> bool:
    con = sqlite3.connect(db_path)
    try:
        cur = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)
        )
        return cur.fetchone() is not None
    finally:
        con.close()


def _column_names(db_path: Path, table: str) -> set[str]:
    """Return the set of column names on `table` (SQLite PRAGMA)."""
    con = sqlite3.connect(db_path)
    try:
        cur = con.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cur.fetchall()}
    finally:
        con.close()


def _current_revision(db_path: Path) -> str | None:
    """Read the head revision recorded by Alembic in `alembic_version`."""
    con = sqlite3.connect(db_path)
    try:
        cur = con.execute("SELECT version_num FROM alembic_version")
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        con.close()


def test_upgrade_head_creates_all_core_tables(alembic_cfg):
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    # Spot-check tables from each migration in the chain.
    for table in (
        "users",                   # 001
        "designs",                 # 001
        "orders",                  # 001 (+ 002 adds installation_date col)
        "subscriptions",           # 001 (+ 003 swaps overlays→area_used)
        "visualization_projects",  # 004 — Phase 5A new
    ):
        assert _table_exists(db_path, table), f"{table} should exist after upgrade head"
    # head revision must equal the latest migration id (currently 005 — Phase 5B).
    assert _current_revision(db_path) == "005"


def test_phase5b_columns_added_by_005(alembic_cfg):
    """Migration 005 adds typed perspective/calibration + version columns."""
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    cols = _column_names(db_path, "visualization_projects")
    for new_col in (
        "calibration",
        "perspective_auto_detected",
        "calibration_auto_detected",
        "version",
    ):
        assert new_col in cols, f"005 should add column `{new_col}`"

    # Downgrade -1 should drop them (and only them) cleanly.
    alembic_cmd.downgrade(cfg, "-1")
    assert _current_revision(db_path) == "004"
    cols_after = _column_names(db_path, "visualization_projects")
    for dropped in (
        "calibration",
        "perspective_auto_detected",
        "calibration_auto_detected",
        "version",
    ):
        assert dropped not in cols_after, f"005 downgrade should drop `{dropped}`"
    # 004's table is still here.
    assert "calibration_pixels_per_cm" in cols_after


def test_round_trip_upgrade_downgrade_upgrade(alembic_cfg):
    """`upgrade head → downgrade -1 → upgrade head` must succeed without errors.

    Verifies that the head migration (currently 005 — Phase 5B) has a
    working `downgrade()` and re-applies cleanly. The legacy `004` table
    (`visualization_projects`) survives a `-1` from `head=005` because
    005 only adds *columns*; the table itself was created in 004.
    """
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    assert _table_exists(db_path, "visualization_projects")
    cols_at_head = _column_names(db_path, "visualization_projects")
    assert "version" in cols_at_head  # added by 005

    alembic_cmd.downgrade(cfg, "-1")
    # Rolling back 005 keeps the table (created by 004) but drops 005's columns.
    assert _table_exists(db_path, "visualization_projects")
    assert "version" not in _column_names(db_path, "visualization_projects")
    assert _table_exists(db_path, "users")

    alembic_cmd.upgrade(cfg, "head")
    assert "version" in _column_names(db_path, "visualization_projects")


def test_downgrade_to_base_drops_everything(alembic_cfg):
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    alembic_cmd.downgrade(cfg, "base")
    for table in ("users", "designs", "visualization_projects"):
        assert not _table_exists(db_path, table), f"{table} should be dropped at base"
    # alembic_version row is gone (or the table itself dropped) at base.
    assert _current_revision(db_path) is None


def test_full_round_trip_head_base_head(alembic_cfg):
    """Full round-trip `head → base → head` (B26 in audit).

    `test_round_trip_upgrade_downgrade_upgrade` only walks one step down/up;
    this asserts that the *entire* downgrade chain is followed by a clean
    upgrade — catches a broken `upgrade()` in any migration once it's been
    rolled back, which the prior test misses.
    """
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    alembic_cmd.downgrade(cfg, "base")
    assert _current_revision(db_path) is None
    alembic_cmd.upgrade(cfg, "head")
    assert _current_revision(db_path) == "005"
    for table in ("users", "designs", "subscriptions", "visualization_projects"):
        assert _table_exists(db_path, table), f"{table} should be re-created at head"
    # Phase 5B columns must be present at head after the full round-trip.
    assert "version" in _column_names(db_path, "visualization_projects")
