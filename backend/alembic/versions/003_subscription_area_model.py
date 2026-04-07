"""Rename overlays_used_this_month to area_used_this_month_m2 (Float) in subscriptions.

Revision ID: 003
Revises: 002
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("subscriptions", "overlays_used_this_month")
    op.add_column("subscriptions", sa.Column("area_used_this_month_m2", sa.Float, server_default="0"))


def downgrade() -> None:
    op.drop_column("subscriptions", "area_used_this_month_m2")
    op.add_column("subscriptions", sa.Column("overlays_used_this_month", sa.Integer, server_default="0"))
