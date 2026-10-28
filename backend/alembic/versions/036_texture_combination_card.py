"""Card fields for texture combination images (Spaces admin)."""

from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "texture_combination_images",
        sa.Column("card", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade():
    op.drop_column("texture_combination_images", "card")
