"""Phase 12 — textures, texture_colors, variant_images tables + preview_image on designs.

Supports the new panel configurator hierarchy:
  Design (form/shape) → Texture (material) → TextureColor → VariantImage (photo).

Also adds `preview_image` to the `designs` table (white silhouette for catalog grid)
and `texture_name`, `texture_id`, `color_id` to `order_items` for new order format.

All new columns use server_default="" so existing rows are unaffected.

Revision ID: 018
Revises: 017
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Textures table ---
    op.create_table(
        "textures",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("swatch_image", sa.String(500), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_textures_slug"),
    )
    op.create_index("idx_textures_slug", "textures", ["slug"])
    op.create_index("idx_textures_is_active", "textures", ["is_active"])

    # --- Texture colors table ---
    op.create_table(
        "texture_colors",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "texture_id", sa.String(36),
            sa.ForeignKey("textures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("hex", sa.String(7), nullable=False, server_default=""),
        sa.Column("swatch_image", sa.String(500), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_texture_colors_texture_id", "texture_colors", ["texture_id"])

    # --- Variant images table ---
    op.create_table(
        "variant_images",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "design_id", sa.String(36),
            sa.ForeignKey("designs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "texture_id", sa.String(36),
            sa.ForeignKey("textures.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "color_id", sa.String(36),
            sa.ForeignKey("texture_colors.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("image_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "design_id", "texture_id", "color_id",
            name="uq_variant_images_combination",
        ),
    )
    op.create_index("idx_variant_images_design_id", "variant_images", ["design_id"])
    op.create_index("idx_variant_images_texture_id", "variant_images", ["texture_id"])

    # --- Add preview_image to designs ---
    op.add_column(
        "designs",
        sa.Column("preview_image", sa.String(500), nullable=False, server_default=""),
    )

    # --- Extend order_items for texture/color tracking ---
    op.add_column(
        "order_items",
        sa.Column("texture_name", sa.String(255), nullable=False, server_default=""),
    )
    op.add_column(
        "order_items",
        sa.Column("texture_id", sa.String(36), nullable=False, server_default=""),
    )
    op.add_column(
        "order_items",
        sa.Column("color_id", sa.String(36), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("order_items", "color_id")
    op.drop_column("order_items", "texture_id")
    op.drop_column("order_items", "texture_name")
    op.drop_column("designs", "preview_image")
    op.drop_index("idx_variant_images_texture_id", table_name="variant_images")
    op.drop_index("idx_variant_images_design_id", table_name="variant_images")
    op.drop_table("variant_images")
    op.drop_index("idx_texture_colors_texture_id", table_name="texture_colors")
    op.drop_table("texture_colors")
    op.drop_index("idx_textures_is_active", table_name="textures")
    op.drop_index("idx_textures_slug", table_name="textures")
    op.drop_table("textures")
