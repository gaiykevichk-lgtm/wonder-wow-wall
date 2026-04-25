"""Phase 10 — `recommendations` + `recommendation_targets` + add the
`recommendations_limit_per_source` column to `shop_settings`.

Three changes shipped in one revision because they form an atomic
feature: the rail is unusable without all three pieces (the parent
table, the child rows, and the runtime-tunable cap).

Schema notes:
  * `recommendations(source_type, source_id)` UNIQUE — matches the
    aggregate's natural key. The app pre-checks for a friendlier 409,
    the constraint is the last line of defence on a concurrent insert.
  * `recommendation_targets` has a `position` int (0-based) — the SQL
    layer materialises the aggregate's list index into a column so the
    `ORDER BY position` read returns the admin-curated order. The app
    rewrites `position = index` on every save so a reordered list
    cannot drift.
  * `(target_type, target_id)` index — covers the cascade-cleanup
    query `find_by_target` (when a product is deleted, find every
    aggregate that lists it as a target).
  * `ON DELETE CASCADE` on `recommendation_targets.recommendation_id`
    so dropping a parent row drops its targets atomically — matches
    the SQLAlchemy `cascade="all, delete-orphan"` on the relationship.

`shop_settings.recommendations_limit_per_source` is added with
`server_default="12"` so the existing seeded singleton row picks up the
new field without a manual UPDATE; the SQLAlchemy `default=12` covers
the test rig that uses `Base.metadata.create_all()`.

`downgrade()` drops both new tables and the new settings column. We
keep `downgrade()` because alembic's full-test rig (`test_alembic.py`)
round-trips up/down on a clean DB.

Revision ID: 014
Revises: 013
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── shop_settings: new admin-tunable column ────────────────────
    # `server_default` backfills the seeded singleton row. The default
    # `12` matches `ShopSettings.recommendations_limit_per_source` and
    # `DEFAULT_RECOMMENDATIONS_LIMIT` so existing deployments behave
    # identically to a fresh install on first read.
    op.add_column(
        "shop_settings",
        sa.Column(
            "recommendations_limit_per_source",
            sa.Integer(),
            nullable=False,
            server_default="12",
        ),
    )

    # ─── recommendations (parent aggregate) ─────────────────────────
    op.create_table(
        "recommendations",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("source_type", sa.String(16), nullable=False),
        sa.Column("source_id", sa.String(36), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "source_type", "source_id",
            name="uq_recommendations_source",
        ),
    )

    # ─── recommendation_targets (child rows) ────────────────────────
    op.create_table(
        "recommendation_targets",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "recommendation_id", sa.String(36),
            sa.ForeignKey("recommendations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(16), nullable=False),
        sa.Column("target_id", sa.String(36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint(
            "recommendation_id", "target_type", "target_id",
            name="uq_recommendation_targets_unique",
        ),
    )

    # FK index — cascade joins on parent delete need a covering index
    # to avoid a sequential scan of the child table per parent row.
    op.create_index(
        "ix_recommendation_targets_recommendation_id",
        "recommendation_targets",
        ["recommendation_id"],
    )
    # Cascade-cleanup index — `find_by_target` filters by the target
    # composite when a deleted product needs to be pruned from every
    # aggregate that recommends it. Without this index the scan grows
    # linearly with the total number of target rows (across all sources).
    op.create_index(
        "ix_recommendation_targets_target",
        "recommendation_targets",
        ["target_type", "target_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recommendation_targets_target",
        table_name="recommendation_targets",
    )
    op.drop_index(
        "ix_recommendation_targets_recommendation_id",
        table_name="recommendation_targets",
    )
    op.drop_table("recommendation_targets")
    op.drop_table("recommendations")
    op.drop_column("shop_settings", "recommendations_limit_per_source")
