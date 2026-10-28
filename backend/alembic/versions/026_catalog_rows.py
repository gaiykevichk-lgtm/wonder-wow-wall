"""Separate catalog table rows from generic panel/texture assignments."""
from importlib import import_module
import sqlalchemy as sa

op = import_module("alembic.op")
revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "panel_texture_assignments",
        sa.Column("is_catalog_row", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("""
        UPDATE panel_texture_assignments AS assignment
        SET is_catalog_row = TRUE, is_active = TRUE
        WHERE EXISTS (
            SELECT 1 FROM panel_variants AS variant
            WHERE variant.panel_id = assignment.panel_id
              AND variant.texture_id = assignment.texture_id
        )
    """)
    op.execute("""
        INSERT INTO panel_texture_assignments
            (id, panel_id, texture_id, is_active, is_catalog_row, created_at, updated_at)
        SELECT gen_random_uuid()::text, variant.panel_id, variant.texture_id,
               TRUE, TRUE, now(), now()
        FROM panel_variants AS variant
        LEFT JOIN panel_texture_assignments AS assignment
          ON assignment.panel_id = variant.panel_id
         AND assignment.texture_id = variant.texture_id
        WHERE assignment.id IS NULL
        GROUP BY variant.panel_id, variant.texture_id
    """)


def downgrade() -> None:
    op.drop_column("panel_texture_assignments", "is_catalog_row")
