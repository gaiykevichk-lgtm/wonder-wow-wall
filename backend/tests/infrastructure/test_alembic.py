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

    NB: we resolve the attribute via dotted-path (`"app.config.settings.…"`)
    rather than the locally-imported `settings` reference. `tests/api/
    test_security.py::test_default_secret_rejected_in_production` does
    `importlib.reload(app.config)`, which replaces `app.config.settings`
    with a brand-new instance. Our top-of-module `from app.config import
    settings` still points at the OLD pre-reload instance, but `env.py`
    does its own `from app.config import settings` at execution time and
    sees the NEW instance — so patching the stale local reference would
    silently no-op and alembic would fall through to the postgres default.
    """
    db_path = tmp_path / "alembic_test.db"
    sqlite_url = f"sqlite+aiosqlite:///{db_path}"
    monkeypatch.setattr("app.config.settings.DATABASE_URL", sqlite_url)

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


def _index_exists(db_path: Path, name: str) -> bool:
    """Return True if the named index exists in SQLite's sqlite_master."""
    con = sqlite3.connect(db_path)
    try:
        cur = con.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?", (name,)
        )
        return cur.fetchone() is not None
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
    # head revision must equal the latest migration id (currently 012 — Phase 8A shop_settings).
    assert _current_revision(db_path) == "012"
    # 006 adds `role` to users.
    assert "role" in _column_names(db_path, "users")
    # 007 adds order list filter indexes.
    assert _index_exists(db_path, "idx_orders_status")
    assert _index_exists(db_path, "idx_orders_created_at")
    assert _index_exists(db_path, "idx_orders_user_id")
    # 008 adds order_notes table + cancel_reason column.
    assert _table_exists(db_path, "order_notes")
    assert "cancel_reason" in _column_names(db_path, "orders")
    assert _index_exists(db_path, "idx_order_notes_order_id")
    # 009 adds is_blocked to users — Phase 5.
    assert "is_blocked" in _column_names(db_path, "users")
    # 010 adds media_assets table — Phase 6.
    assert _table_exists(db_path, "media_assets")
    assert _index_exists(db_path, "idx_media_assets_path")
    assert _index_exists(db_path, "idx_media_assets_purpose")
    # 011 adds panels table + indexes — Phase 7B.
    assert _table_exists(db_path, "panels")
    assert _index_exists(db_path, "idx_panels_slug")
    assert _index_exists(db_path, "idx_panels_is_active")
    # 012 adds shop_settings singleton table — Phase 8A.
    assert _table_exists(db_path, "shop_settings")


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

    # Downgrade to 004 should drop them (and only them) cleanly. Targeting
    # by explicit revision rather than `-1` so the assertion survives new
    # migrations being added on top of 005.
    alembic_cmd.downgrade(cfg, "004")
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


def test_phase1_role_column_added_by_006(alembic_cfg):
    """Migration 006 adds `role` to `users` with a CUSTOMER server_default."""
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    assert "role" in _column_names(db_path, "users")

    # Downgrade past 006 drops the column; `users` itself remains (from 001).
    # Pinned to "005" instead of `-1` so the assertion survives new
    # migrations being stacked on top of 006 (e.g. 007 — Phase 4A indexes).
    alembic_cmd.downgrade(cfg, "005")
    assert _current_revision(db_path) == "005"
    assert _table_exists(db_path, "users")
    assert "role" not in _column_names(db_path, "users")


def test_round_trip_upgrade_downgrade_upgrade(alembic_cfg):
    """`upgrade head → downgrade to 004 → upgrade head` must succeed without errors.

    Verifies that the Phase 5B migration (005) has a working `downgrade()`
    and re-applies cleanly after a round-trip. The legacy `004` table
    (`visualization_projects`) survives the downgrade because 005 only adds
    *columns*; the table itself was created in 004.

    Target revision is pinned to "004" (not `-1`) so the invariant holds
    when more migrations are stacked on top of 005.
    """
    cfg, db_path = alembic_cfg
    alembic_cmd.upgrade(cfg, "head")
    assert _table_exists(db_path, "visualization_projects")
    cols_at_head = _column_names(db_path, "visualization_projects")
    assert "version" in cols_at_head  # added by 005

    alembic_cmd.downgrade(cfg, "004")
    # Rolling back past 005 keeps the table (created by 004) but drops 005's columns.
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
    assert _current_revision(db_path) == "012"
    for table in ("users", "designs", "subscriptions", "visualization_projects"):
        assert _table_exists(db_path, table), f"{table} should be re-created at head"
    # Phase 5B columns must be present at head after the full round-trip.
    assert "version" in _column_names(db_path, "visualization_projects")
    # Phase 4A indexes also restored.
    assert _index_exists(db_path, "idx_orders_status")
    # Phase 5 (admin panel) — is_blocked column must round-trip cleanly.
    assert "is_blocked" in _column_names(db_path, "users")
    # Phase 6 — media_assets table must round-trip cleanly.
    assert _table_exists(db_path, "media_assets")
    # Phase 7B — panels table must round-trip cleanly.
    assert _table_exists(db_path, "panels")
    # Phase 8A — shop_settings singleton table must round-trip cleanly.
    assert _table_exists(db_path, "shop_settings")
