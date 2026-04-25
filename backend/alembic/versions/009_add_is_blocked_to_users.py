"""Phase 5 — admin can disable accounts: `users.is_blocked` flag.

`server_default=false()` backfills existing rows on `alembic upgrade` so the
NOT NULL constraint is satisfied without a manual UPDATE pass — same R5
"default True (or False)" pattern used for `users.role` in 006.

Blocked users:
  * Cannot log in (`Login.execute` raises `UserBlockedError` → 403).
  * Existing tokens stay valid until expiry, but every admin use case
    re-checks role from the DB so a blocked admin's stale JWT is harmless.
  * Last-active-admin guard (`UserRepository.count_active_admins`) treats
    a blocked admin the same as a CUSTOMER — they cannot reach
    `/api/admin/*`, so blocking the only remaining admin would brick the
    panel exactly like demoting them. The migration keeps schema-level
    invariants minimal; the guard is enforced at the use-case layer.

`downgrade()` drops the column — safe because no FK references it.

Revision ID: 009
Revises: 008
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_blocked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    # batch-mode is configured in alembic/env.py for SQLite; postgres drops
    # the column natively.
    op.drop_column("users", "is_blocked")
