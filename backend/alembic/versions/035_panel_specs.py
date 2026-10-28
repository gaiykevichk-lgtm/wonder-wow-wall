"""Editable panel technical specifications.

Revision ID: 035
Revises: 034
"""
from importlib import import_module
import sqlalchemy as sa

op = import_module('alembic.op')
revision = '035'
down_revision = '034'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('panels', sa.Column('thickness_mm', sa.Integer(), nullable=False, server_default='3'))
    for column, default in (
        ('execution', 'Архитектурное декоративное покрытие'),
        ('mounting_system', 'Запатентованная система быстрой замены'),
        ('base_material', 'Ультралёгкий композит высокой плотности'),
        ('packaging', ''),
    ):
        op.add_column('panels', sa.Column(column, sa.String(500), nullable=False, server_default=default))


def downgrade():
    for column in ('packaging', 'base_material', 'mounting_system', 'execution', 'thickness_mm'):
        op.drop_column('panels', column)
