"""Phase 8B — `banners` table for homepage promo rotation.

Holds admin-managed image+CTA cards. No FKs in or out — banners are
independent of products / orders / subscriptions.

Schema notes:
  * `position` is a free-form `String(32)` rather than a Postgres ENUM.
    The domain enum (`BannerPosition`) is the source of truth; storing
    the literal string keeps the migration portable across SQLite (used
    in alembic round-trip tests) and Postgres without a CREATE TYPE.
  * Composite index `(position, is_active, priority)` covers the public
    list query `WHERE position = ? AND is_active = TRUE ORDER BY
    priority` — single index scan instead of full table sort.
  * `is_active` defaults TRUE so a freshly inserted row is publishable
    immediately (the admin form decides whether the row is "draft" by
    leaving `image_path` blank, which the use case rejects on activate).

Seed data: NONE. Banners are admin-curated and an empty rotation is a
valid initial state (the public `/api/shop/banners` endpoint just
returns `[]`). Same posture as `recommendations` (Phase 10).

`downgrade()` drops the table.

Revision ID: 016
Revises: 015
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "banners",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subtitle", sa.String(500), nullable=False, server_default=""),
        sa.Column("image_path", sa.String(500), nullable=False, server_default=""),
        sa.Column("cta_label", sa.String(100), nullable=False, server_default=""),
        sa.Column("cta_url", sa.String(500), nullable=False, server_default=""),
        sa.Column(
            "position", sa.String(32), nullable=False,
            server_default="homepage_hero",
        ),
        sa.Column(
            "priority", sa.Integer(), nullable=False, server_default="0",
        ),
        # `"1"` (not `sa.true()`) keeps the literal portable across
        # SQLite/Postgres — same trick as `panels.is_active`.
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1"),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "idx_banners_position_active_priority",
        "banners",
        ["position", "is_active", "priority"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_banners_position_active_priority",
        table_name="banners",
        if_exists=True,
    )
    op.drop_table("banners")
