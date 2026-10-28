"""Add recommendation images owned by a panel variant."""
from importlib import import_module
import sqlalchemy as sa

op = import_module("alembic.op")
revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "panel_variants",
        sa.Column(
            "recommendation_image_paths",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("panel_variants", "recommendation_image_paths")
