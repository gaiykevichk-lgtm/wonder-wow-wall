"""Phase 6 — `media_assets` table for admin file uploads.

Holds metadata about files persisted to `FileStorage`. The actual bytes
live on the filesystem (or S3 later); this table is the source of truth
for "what files exist". Orphan-sweep is `SELECT path FROM media_assets`
vs. directory listing — see `DeleteMedia` use case for the rationale of
"file delete, then row delete" ordering.

`path` is UNIQUE to defend against UUID collision (vanishingly unlikely
but free) and is indexed for orphan sweeps. `purpose` is indexed because
future Phase 7A/7B endpoints will list-by-purpose ("show me all banners").

`downgrade()` drops the table; the `/var/uploads/` volume is
intentionally NOT removed by the migration — file lifecycle is
out-of-band from schema migrations.

Revision ID: 010
Revises: 009
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("mime", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("uploaded_by", sa.String(36), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("path", name="uq_media_assets_path"),
    )
    op.create_index(
        "idx_media_assets_path", "media_assets", ["path"], if_not_exists=True,
    )
    op.create_index(
        "idx_media_assets_purpose", "media_assets", ["purpose"], if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_media_assets_purpose", table_name="media_assets", if_exists=True)
    op.drop_index("idx_media_assets_path", table_name="media_assets", if_exists=True)
    op.drop_table("media_assets")
