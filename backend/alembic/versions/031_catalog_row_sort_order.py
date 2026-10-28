"""Persist the visible admin catalog row order."""

from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "panel_texture_assignments",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_panel_texture_assignments_catalog_order",
        "panel_texture_assignments",
        ["is_catalog_row", "sort_order"],
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (ORDER BY panel_id, created_at, id) - 1 AS position
            FROM panel_texture_assignments
            WHERE is_catalog_row IS TRUE
        )
        UPDATE panel_texture_assignments AS assignment
        SET sort_order = ranked.position
        FROM ranked
        WHERE assignment.id = ranked.id
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_panel_texture_assignments_catalog_order",
        table_name="panel_texture_assignments",
    )
    op.drop_column("panel_texture_assignments", "sort_order")
