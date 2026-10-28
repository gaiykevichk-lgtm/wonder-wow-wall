"""Add panel_variants table for Phase 12.

Revision ID: 013
Revises: 012
Create Date: 2026-07-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Panel variants: stores panel + texture + color + images combinations
    op.create_table(
        "panel_variants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("panel_id", sa.String(36), sa.ForeignKey("panels.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("texture_id", sa.String(36), sa.ForeignKey("textures.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("color_id", sa.String(36), sa.ForeignKey("texture_colors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("color_hex", sa.String(7), nullable=True, server_default=""),
        sa.Column("image_paths", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("panel_id", "texture_id", "color_id", name="uq_panel_variant_unique"),
    )
    
    # Index for faster lookups by panel + texture
    op.create_index("ix_panel_variant_panel_texture", "panel_variants", ["panel_id", "texture_id"])


def downgrade() -> None:
    op.drop_index("ix_panel_variant_panel_texture", table_name="panel_variants")
    op.drop_table("panel_variants")
