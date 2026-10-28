"""Allow several panel rows to share the slug of their base form.

Revision ID: 032
Revises: 031
"""
from importlib import import_module

import sqlalchemy as sa

op = import_module("alembic.op")

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_panels_slug", "panels", type_="unique")
    # idx_panels_slug from 011 remains for searches/group lookups.


def downgrade() -> None:
    connection = op.get_bind()
    panels = sa.table("panels", sa.column("slug", sa.String()))
    duplicates = connection.execute(
        sa.select(panels.c.slug).group_by(panels.c.slug)
        .having(sa.func.count() > 1).limit(1)
    ).first()
    if duplicates:
        raise RuntimeError("Cannot restore unique panel slug while duplicate slugs exist")
    op.create_unique_constraint("uq_panels_slug", "panels", ["slug"])
