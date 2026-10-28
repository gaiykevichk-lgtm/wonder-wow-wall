"""Add explicit panel-to-texture assignments.

Assignments describe which textures a moderator allows for a panel. Product
variants and their image galleries remain independent rows in panel_variants.

Revision ID: 021
Revises: 020
"""
from importlib import import_module
from typing import Sequence, Union

import sqlalchemy as sa

# Alembic exposes ``op`` as a runtime proxy module rather than a statically
# exported package symbol. Loading that module explicitly keeps migrations
# conventional while allowing static analyzers to resolve the import.
op = import_module("alembic.op")

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "panel_texture_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "panel_id",
            sa.String(36),
            sa.ForeignKey("panels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "texture_id",
            sa.String(36),
            sa.ForeignKey("textures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "panel_id", "texture_id", name="uq_panel_texture_assignment"
        ),
    )
    op.create_index(
        "ix_panel_texture_assignment_panel",
        "panel_texture_assignments",
        ["panel_id"],
    )
    op.create_index(
        "ix_panel_texture_assignment_texture",
        "panel_texture_assignments",
        ["texture_id"],
    )

    # Existing panel variants are already evidence of an assignment. The
    # additive migration preserves every product and does not touch photos.
    op.execute(
        """
        INSERT INTO panel_texture_assignments
            (id, panel_id, texture_id, is_active, created_at, updated_at)
        SELECT
            md5(panel_id || ':' || texture_id),
            panel_id,
            texture_id,
            bool_or(is_active),
            min(created_at),
            max(updated_at)
        FROM panel_variants
        GROUP BY panel_id, texture_id
        ON CONFLICT (panel_id, texture_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_panel_texture_assignment_texture",
        table_name="panel_texture_assignments",
    )
    op.drop_index(
        "ix_panel_texture_assignment_panel",
        table_name="panel_texture_assignments",
    )
    op.drop_table("panel_texture_assignments")
