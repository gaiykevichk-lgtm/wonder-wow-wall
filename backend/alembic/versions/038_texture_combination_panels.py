"""Panel family binding for texture combination cards (Spaces admin).

Вариант А: уникальность карточки = пара текстур + пара семейств базовых
форм. Моно — одна текстура + одно семейство, комбо — две текстуры + два
семейства. Размер панели не участвует: хранится только семейство формы
(slug без суффикса размера, например ``arka`` вместо ``arka-300x300``).

Старые строки получают пустые значения и продолжают работать как раньше.
"""

from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "texture_combination_images",
        sa.Column("panel_family_1", sa.String(120), nullable=False, server_default=""),
    )
    op.add_column(
        "texture_combination_images",
        sa.Column("panel_family_2", sa.String(120), nullable=False, server_default=""),
    )
    op.create_check_constraint(
        "ck_texture_combination_images_ordered_panels",
        "texture_combination_images",
        "panel_family_1 <= panel_family_2",
    )


def downgrade():
    op.drop_constraint(
        "ck_texture_combination_images_ordered_panels",
        "texture_combination_images",
        type_="check",
    )
    op.drop_column("texture_combination_images", "panel_family_2")
    op.drop_column("texture_combination_images", "panel_family_1")
