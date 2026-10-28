"""Persist curated spaces; seed existing public cards once.

Revision ID: 033
Revises: 032
"""
import json
from pathlib import Path
from importlib import import_module
import sqlalchemy as sa

op = import_module('alembic.op')
revision = '033'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    table = op.create_table('space_interiors',
        sa.Column('id', sa.String(128), primary_key=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
    )
    seed = Path(__file__).resolve().parents[2] / 'app' / 'seed_spaces.json'
    with seed.open(encoding='utf-8') as source:
        items = json.load(source)
    op.bulk_insert(table, [dict(id=item['id'], position=i, content=item) for i, item in enumerate(items)])


def downgrade():
    op.drop_table('space_interiors')
