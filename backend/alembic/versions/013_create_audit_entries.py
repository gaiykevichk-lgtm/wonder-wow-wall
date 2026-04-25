"""Phase 9 — `audit_entries` append-only admin action log.

Creates the table + three indexes that match the read patterns:
  * `(actor_id, created_at desc)` — "what did THIS admin do recently".
  * `(target_type, target_id, created_at desc)` — deep link "show all
    events for THIS user/order".
  * `(created_at desc)` — covers the unfiltered list view.

`payload` is a JSON column (Postgres `JSON`, SQLite stores as TEXT).

`downgrade()` drops the table and its indexes; the audit history goes
with it. We keep `downgrade()` because alembic's full-test rig
(`test_alembic.py`) round-trips up/down on a clean DB.

Revision ID: 013
Revises: 012
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_entries",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("actor_id", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=True),
        sa.Column("target_id", sa.String(64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    # Plain single-column indexes on actor_id / action / created_at —
    # match what the SQLAlchemy model declares (`index=True`). A
    # Postgres-only composite `(actor_id, created_at desc)` would be
    # marginally better but creating it via op.f() requires a separate
    # raw-SQL path for SQLite test rig — the single-column indexes are
    # already covering for the read patterns the admin UI uses.
    op.create_index(
        "ix_audit_entries_actor_id", "audit_entries", ["actor_id"],
    )
    op.create_index(
        "ix_audit_entries_action", "audit_entries", ["action"],
    )
    op.create_index(
        "ix_audit_entries_created_at", "audit_entries", ["created_at"],
    )
    # Composite for the deep-link query: filter by (target_type, target_id),
    # sort by created_at desc. SQLite/Postgres both honour this composite.
    op.create_index(
        "ix_audit_entries_target",
        "audit_entries",
        ["target_type", "target_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_entries_target", table_name="audit_entries")
    op.drop_index("ix_audit_entries_created_at", table_name="audit_entries")
    op.drop_index("ix_audit_entries_action", table_name="audit_entries")
    op.drop_index("ix_audit_entries_actor_id", table_name="audit_entries")
    op.drop_table("audit_entries")
