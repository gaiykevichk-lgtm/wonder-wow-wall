"""Add `panels.photo_paths` gallery + drop the colour NOT-NULL posture on variants.

Two related changes that together remove colour from the panel product
model and let the catalog card show more than one photo per panel:

1. `panels.photo_paths` (JSON list) — the ordered catalog gallery. The
   existing scalar `photo_path` stays as the single "primary" pointer so
   every legacy reader (order items, admin thumbnails) keeps working.
   Existing rows are backfilled to `[photo_path]` so nothing renders an
   empty gallery after deploy.

2. `panel_variants.color_hex` becomes explicitly nullable with no
   server_default. Colour is no longer part of the variant identity, so
   new rows leave both `color_id` and `color_hex` NULL. Historical rows
   keep their values — this is additive, not destructive.

The `uq_panel_variant_unique(panel_id, texture_id, color_id)` constraint
is intentionally left in place: Postgres treats every NULL as distinct,
so with `color_id IS NULL` it stops restricting anything and several
photo-sets per panel+texture become legal without touching live data.

Revision ID: 019
Revises: 018
Create Date: 2026-08-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. panels.photo_paths ---------------------------------------
    # server_default="[]" so the NOT NULL constraint is satisfied for
    # rows inserted by any old code path still in flight during deploy.
    op.add_column(
        "panels",
        sa.Column(
            "photo_paths",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )

    # Backfill: a panel that already has a photo gets a 1-element gallery
    # so `photo_paths[0] == photo_path` holds everywhere immediately.
    # json_build_array is Postgres-native; guarded to non-empty photos so
    # photo-less panels stay `[]` rather than `[""]`.
    op.execute(
        """
        UPDATE panels
           SET photo_paths = json_build_array(photo_path)
         WHERE photo_path IS NOT NULL
           AND photo_path <> ''
        """
    )

    # --- 2. panel_variants colour becomes optional -------------------
    # Drop the empty-string server_default: an absent colour must read as
    # NULL, not "", so the API can omit the field entirely.
    op.alter_column(
        "panel_variants",
        "color_hex",
        existing_type=sa.String(7),
        nullable=True,
        server_default=None,
    )
    # Normalise the sentinel values the old wizard wrote ("" and the
    # "#808080" fallback it used when an admin skipped the colour step)
    # to NULL so the public API stops emitting a meaningless swatch.
    op.execute(
        """
        UPDATE panel_variants
           SET color_hex = NULL
         WHERE color_hex IN ('', '0', '#808080')
        """
    )


def downgrade() -> None:
    op.alter_column(
        "panel_variants",
        "color_hex",
        existing_type=sa.String(7),
        nullable=True,
        server_default="",
    )
    op.drop_column("panels", "photo_paths")
