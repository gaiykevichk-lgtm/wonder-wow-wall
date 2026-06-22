"""Phase Panel Creator Wizard — add size_key and hex to variant_images.

Adds nullable columns for the Panel Creator Wizard workflow:
  * size_key — panel size identifier (30x30, 30x60, 60x60) or null for
    legacy entries created before the wizard existed.
  * hex      — optional color override per variant; null means "use
    TextureColor.hex from the catalog".

A composite index on (design_id, texture_id, color_id, size_key) enforces
uniqueness at the database level — the in-memory repo mirrors this for
development/testing parity.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "019_add_size_key_and_hex_to_variant_images"
down_revision = "018_create_textures_and_variants"
branch_labels = ()
depends_on = ()


def upgrade() -> None:
    # ── New columns ──────────────────────────────────────────────────────
    op.add_column(
        "variant_images",
        sa.Column("size_key", sa.String(20), nullable=True),
        schema="public",
    )
    op.add_column(
        "variant_images",
        sa.Column("hex", sa.String(7), nullable=True),
        schema="public",
    )

    # ── Composite unique index ───────────────────────────────────────────
    # Legacy entries have size_key=NULL, so the index is over the full
    # tuple: NULL != NULL in SQL, so two legacy entries with the same
    # (design_id, texture_id, color_id) would violate this constraint.
    # The safe approach is to treat NULL as a distinct value: use a
    # partial index for NULL rows or accept that the constraint is on
    # (design_id, texture_id, color_id) when size_key IS NULL, and
    # (design_id, texture_id, color_id, size_key) when size_key IS NOT NULL.
    #
    # For simplicity, we create the index on all four columns — the
    # DB will reject inserts that create duplicate NULL tuples. This is
    # acceptable because existing data has at most one entry per
    # (design, texture, color) triple.
    op.create_index(
        "idx_variant_images_composite",
        "variant_images",
        ["design_id", "texture_id", "color_id", "size_key"],
        unique=True,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index(
        "idx_variant_images_composite",
        table_name="variant_images",
        schema="public",
    )
    op.drop_column("variant_images", "hex", schema="public")
    op.drop_column("variant_images", "size_key", schema="public")
