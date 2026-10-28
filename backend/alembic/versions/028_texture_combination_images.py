"""Add interior images assigned to unordered pairs of textures."""
from importlib import import_module
import sqlalchemy as sa

op = import_module("alembic.op")
revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "texture_combination_images",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("texture_id_1", sa.String(36), sa.ForeignKey("textures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("texture_id_2", sa.String(36), sa.ForeignKey("textures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("texture_id_1 < texture_id_2", name="ck_texture_combination_images_ordered_pair"),
        sa.UniqueConstraint("texture_id_1", "texture_id_2", name="uq_texture_combination_images_pair"),
    )
    op.create_index("ix_texture_combination_images_texture_id_1", "texture_combination_images", ["texture_id_1"])
    op.create_index("ix_texture_combination_images_texture_id_2", "texture_combination_images", ["texture_id_2"])


def downgrade() -> None:
    op.drop_index("ix_texture_combination_images_texture_id_2", table_name="texture_combination_images")
    op.drop_index("ix_texture_combination_images_texture_id_1", table_name="texture_combination_images")
    op.drop_table("texture_combination_images")
