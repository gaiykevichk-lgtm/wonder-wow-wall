"""Add editable execution slug without changing existing identifiers."""
from importlib import import_module
import sqlalchemy as sa

op = import_module("alembic.op")
revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("panel_variants", sa.Column("slug", sa.String(160), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("panel_variants", "slug")
