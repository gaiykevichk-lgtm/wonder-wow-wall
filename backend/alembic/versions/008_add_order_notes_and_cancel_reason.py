"""Phase 4B — admin order detail: notes table + cancel_reason on orders.

Two changes shipped together because they're both required by the same
front-end page (`AdminOrderDetailPage`):

1. `orders.cancel_reason` (TEXT NULL) — populated by `Order.cancel(reason)`
   and `Order.refund(reason)`. Single column reused for both verbs because
   the states are mutually exclusive (terminal). NULL for any non-terminated
   order.

2. `order_notes` table — internal admin annotations on an order. Cascaded
   on parent delete so removing an order also removes its notes (no
   orphan rows). Indexed on `order_id` for the detail page's "load all
   notes for this order" query.

`downgrade()` drops the column and the table cleanly. No data migration
needed: legacy orders simply have NULL `cancel_reason` and zero notes.

Revision ID: 008
Revises: 007
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) cancel_reason on orders. NULL is the only safe default — legacy
    # rows pre-Phase-4B have no termination context. Long-form text since
    # admins may paste call summaries.
    op.add_column(
        "orders",
        sa.Column("cancel_reason", sa.Text(), nullable=True),
    )

    # 2) order_notes table. ON DELETE CASCADE mirrors the SQLAlchemy
    # `cascade="all, delete-orphan"` so DB-level deletion (e.g. raw SQL)
    # behaves the same as ORM-level deletion.
    op.create_table(
        "order_notes",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "order_id",
            sa.String(36),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "idx_order_notes_order_id", "order_notes", ["order_id"], if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_order_notes_order_id", table_name="order_notes", if_exists=True)
    op.drop_table("order_notes")
    # batch-mode is configured in alembic/env.py for SQLite; postgres
    # drops the column natively.
    op.drop_column("orders", "cancel_reason")
