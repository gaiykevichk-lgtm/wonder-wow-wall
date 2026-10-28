"""Allow multiple mono and combination images for each texture selection."""

from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")
revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A row with equal texture ids represents a mono image. Several rows may
    # point to the same mono texture or unordered texture pair.
    op.drop_constraint(
        "uq_texture_combination_images_pair",
        "texture_combination_images",
        type_="unique",
    )
    op.drop_constraint(
        "ck_texture_combination_images_ordered_pair",
        "texture_combination_images",
        type_="check",
    )
    op.create_check_constraint(
        "ck_texture_combination_images_ordered_pair",
        "texture_combination_images",
        "texture_id_1 <= texture_id_2",
    )
    # Preserve the former mono-image library in the unified gallery. Reusing
    # the legacy UUID is safe because it came from a separate table; the
    # NOT EXISTS guard makes the migration idempotent for manually repaired
    # production databases.
    op.execute(
        """
        INSERT INTO texture_combination_images
            (id, texture_id_1, texture_id_2, image_path, created_at)
        SELECT
            visualization.id,
            visualization.texture_id,
            visualization.texture_id,
            visualization.media_url,
            visualization.created_at
        FROM texture_visualizations AS visualization
        WHERE visualization.media_url <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM texture_combination_images AS image
              WHERE image.texture_id_1 = visualization.texture_id
                AND image.texture_id_2 = visualization.texture_id
                AND image.image_path = visualization.media_url
          )
        """
    )


def downgrade() -> None:
    # Downgrade is intentionally strict: duplicate pairs and mono rows must be
    # resolved before restoring the legacy one-image-per-distinct-pair model.
    op.drop_constraint(
        "ck_texture_combination_images_ordered_pair",
        "texture_combination_images",
        type_="check",
    )
    op.create_check_constraint(
        "ck_texture_combination_images_ordered_pair",
        "texture_combination_images",
        "texture_id_1 < texture_id_2",
    )
    op.create_unique_constraint(
        "uq_texture_combination_images_pair",
        "texture_combination_images",
        ["texture_id_1", "texture_id_2"],
    )
