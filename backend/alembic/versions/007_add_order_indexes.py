"""Phase 4A (admin panel) — order list filter indexes.

The admin orders endpoint (`GET /api/admin/orders`) supports filtering by
status, by user, and by created-at window, with default sort
`created_at DESC`. With the planned 1k+ orders dataset (and growing), a
seq-scan + filesort is unacceptable: the DoD targets <300ms for a 50-row
page over 1000 orders.

Indexes added:
  * `idx_orders_status`     — equality filter, low cardinality (5 statuses)
                              but still useful when one bucket dominates.
  * `idx_orders_created_at` — supports the default sort and the `from/to`
                              range predicate. Composite with status would
                              be marginally better but doubles write cost
                              on hot insert path; keeping them separate is
                              the conservative pick for MVP.
  * `idx_orders_user_id`    — admin "show this user's orders" + the
                              existing customer `list_by_user` query.

`if_not_exists` is used because some local SQLite test databases may have
been built via `Base.metadata.create_all()` (which already creates the
`user_id` index from the FK on PostgreSQL but not on SQLite) — the flag
keeps the upgrade idempotent on either engine.

Revision ID: 007
Revises: 006
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_orders_status", "orders", ["status"], if_not_exists=True,
    )
    op.create_index(
        "idx_orders_created_at", "orders", ["created_at"], if_not_exists=True,
    )
    op.create_index(
        "idx_orders_user_id", "orders", ["user_id"], if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_orders_user_id", table_name="orders", if_exists=True)
    op.drop_index("idx_orders_created_at", table_name="orders", if_exists=True)
    op.drop_index("idx_orders_status", table_name="orders", if_exists=True)
