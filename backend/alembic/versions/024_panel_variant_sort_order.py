"""Persist execution order inside each panel and texture group."""
from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "panel_variants",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_panel_variant_group_order",
        "panel_variants",
        ["panel_id", "texture_id", "sort_order"],
    )
    op.execute("""
        WITH ranked AS (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY panel_id, texture_id
                       ORDER BY created_at DESC, id
                   ) - 1 AS position
            FROM panel_variants
        )
        UPDATE panel_variants AS target
        SET sort_order = ranked.position
        FROM ranked
        WHERE target.id = ranked.id
    """)


def downgrade() -> None:
    op.drop_index("ix_panel_variant_group_order", table_name="panel_variants")
    op.drop_column("panel_variants", "sort_order")
