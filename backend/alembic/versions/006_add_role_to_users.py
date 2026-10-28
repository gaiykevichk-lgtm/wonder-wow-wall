"""Phase 1 (admin panel) — add `role` column to `users`.

Backfills all existing rows with `CUSTOMER` via `server_default`. After the
migration the first admin is promoted explicitly via the CLI:

    docker-compose run --rm backend python -m app.cli grant_admin <email>

`downgrade()` drops the column — safe because no FK references it.

Revision ID: 006
Revises: 005
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default keeps legacy rows valid so the NOT NULL constraint is
    # satisfied without a manual UPDATE pass (R5 — default True pattern).
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(16),
            nullable=False,
            server_default="CUSTOMER",
        ),
    )


def downgrade() -> None:
    # batch-mode is configured in alembic/env.py for SQLite; postgres drops
    # the column natively.
    op.drop_column("users", "role")
