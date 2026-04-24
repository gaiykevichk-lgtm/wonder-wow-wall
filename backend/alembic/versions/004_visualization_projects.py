"""Add visualization_projects table to match VisualizationProjectModel.

The ORM model `VisualizationProjectModel` and its SQL repository
(`SqlVisualizationProjectRepository`) were already in the codebase, but
migration 001 never created the backing table — projects only worked when
`USE_MEMORY_REPOS=true`. Phase 5A closes that gap so postgres-backed
deployments can persist visualizer scenes.

Phase 5B will *extend* this table with perspective/calibration columns;
this migration only mirrors the current model state (zero-migration baseline
for the table).

Revision ID: 004
Revises: 003
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "visualization_projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            # Mirrors `cascade="all, delete-orphan"` on UserModel.visualization_projects
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False, server_default=""),
        sa.Column("photo_url", sa.Text, server_default=""),
        sa.Column("photo_width", sa.Integer, server_default="0"),
        sa.Column("photo_height", sa.Integer, server_default="0"),
        sa.Column("wall_mask_base64", sa.Text, server_default=""),
        sa.Column("calibration_pixels_per_cm", sa.Float, server_default="5.0"),
        sa.Column("panels_json", sa.JSON, server_default="[]"),
        # `perspective_corners` is JSON to keep schema flexible while frontend
        # corner-shape still evolves (Phase 5B will harden the value-object).
        sa.Column("perspective_corners", sa.JSON, nullable=True),
        sa.Column("placement_mode", sa.String(20), server_default="manual"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("visualization_projects")
