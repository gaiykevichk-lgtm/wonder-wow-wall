"""Gallery column for texture combination cards (one card = many photos)."""

from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "texture_combination_images",
        sa.Column("image_paths", sa.JSON(), nullable=False, server_default="[]"),
    )
    # Обратная совместимость: у всех существующих строк галерея из одного фото.
    # JSON-колонка в PG не поддерживает оператор =, сравниваем через text.
    op.execute(
        """
        UPDATE texture_combination_images
        SET image_paths = json_build_array(image_path)
        WHERE image_paths::text = '[]' OR image_paths IS NULL
        """
    )


def downgrade():
    op.drop_column("texture_combination_images", "image_paths")
