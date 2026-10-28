"""Add editable colored panel availability statuses."""
from alembic import op
import sqlalchemy as sa

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "panel_availability_statuses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("color", sa.String(7), nullable=False, server_default="#dc2626"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("panels", sa.Column("availability_status_id", sa.String(36), nullable=True))
    op.create_index("ix_panels_availability_status_id", "panels", ["availability_status_id"])
    op.create_foreign_key(
        "fk_panels_availability_status_id", "panels", "panel_availability_statuses",
        ["availability_status_id"], ["id"], ondelete="SET NULL",
    )
    statuses = sa.table("panel_availability_statuses",
        sa.column("id", sa.String), sa.column("name", sa.String),
        sa.column("color", sa.String), sa.column("sort_order", sa.Integer))
    op.bulk_insert(statuses, [
        {"id": "status-out-of-stock", "name": "Нет в наличии", "color": "#dc2626", "sort_order": 1},
        {"id": "status-awaiting-delivery", "name": "Ожидает поставки", "color": "#d97706", "sort_order": 2},
    ])


def downgrade():
    op.drop_constraint("fk_panels_availability_status_id", "panels", type_="foreignkey")
    op.drop_index("ix_panels_availability_status_id", table_name="panels")
    op.drop_column("panels", "availability_status_id")
    op.drop_table("panel_availability_statuses")
