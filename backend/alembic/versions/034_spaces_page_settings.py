"""Editable spaces page heading and introductory copy.

Revision ID: 034
Revises: 033
"""
from importlib import import_module
import sqlalchemy as sa

op = import_module('alembic.op')
revision = '034'
down_revision = '033'
branch_labels = None
depends_on = None


def upgrade():
    table = op.create_table('spaces_page_settings',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('heading', sa.String(255), nullable=False),
        sa.Column('intro', sa.Text(), nullable=False),
    )
    op.bulk_insert(table, [dict(id='main', heading='Время наполнять.', intro='Мы создали коллекцию интерьеров для дома, бизнеса и общественных пространств. Меняйте фактуры, комбинируйте решения и находите свой WOW!')])


def downgrade():
    op.drop_table('spaces_page_settings')
