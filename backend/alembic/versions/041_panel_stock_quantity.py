"""Add available stock quantity to panel SKUs."""
from alembic import op
import sqlalchemy as sa

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "panels",
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("panels", "stock_quantity")
