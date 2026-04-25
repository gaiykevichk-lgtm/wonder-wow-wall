"""Phase 7A — add `is_published` admin-controlled visibility flag to `designs`.

The flag is the soft-hide knob the admin uses to keep a design row in the
catalog without exposing it on the public `/api/catalog/designs` endpoint.
Backfills existing rows to `True` so a fresh `alembic upgrade` does not
silently disappear any seeded design.

Schema notes:
  * `is_published BOOL NOT NULL DEFAULT TRUE`. SQLite stores booleans
    as 0/1; Postgres asyncpg accepts the same string thanks to
    SQLAlchemy bind-param coercion. The literal `"1"` keeps the
    server_default portable across both dialects (mirrors
    `panels.is_active` from migration 011).
  * Index on `is_published` so the public catalog's `WHERE is_published =
    TRUE` filter doesn't degenerate to a sequential scan once the
    design table grows. Cardinality is low (2 distinct values) but the
    public endpoint hits this filter on EVERY read — a partial index
    is the right shape long-term, but the simple one is portable.

`downgrade()` drops the column. We keep `downgrade()` because alembic's
full-test rig (`test_alembic.py`) round-trips up/down on a clean DB.

Revision ID: 015
Revises: 014
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "designs",
        sa.Column(
            "is_published",
            sa.Boolean(),
            nullable=False,
            # `"1"` instead of `sa.true()` keeps the migration portable
            # between Postgres (`TRUE`) and SQLite (`1`); same trick as
            # `panels.is_active` (migration 011) and `users.is_blocked`
            # (migration 009).
            server_default=sa.text("1"),
        ),
    )
    op.create_index(
        "idx_designs_is_published",
        "designs",
        ["is_published"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_designs_is_published", table_name="designs", if_exists=True,
    )
    op.drop_column("designs", "is_published")
