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
    # All non-Optional ORM fields get an explicit `nullable=False` so the BD
    # schema matches `Mapped[str]/int/float` semantics (B22 in audit).
    # `server_default` still protects partial INSERTs.
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
        sa.Column("photo_url", sa.Text, nullable=False, server_default=""),
        sa.Column("photo_width", sa.Integer, nullable=False, server_default="0"),
        sa.Column("photo_height", sa.Integer, nullable=False, server_default="0"),
        sa.Column("wall_mask_base64", sa.Text, nullable=False, server_default=""),
        sa.Column("calibration_pixels_per_cm", sa.Float, nullable=False, server_default="5.0"),
        sa.Column("panels_json", sa.JSON, nullable=False, server_default="[]"),
        # `perspective_corners` is the only nullable column — ORM has
        # `Mapped[dict | None]` (Phase 5B will harden this into a typed VO).
        sa.Column("perspective_corners", sa.JSON, nullable=True),
        sa.Column("placement_mode", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("visualization_projects")
