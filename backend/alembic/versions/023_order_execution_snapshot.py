"""Preserve exact execution identity in order lines, including after catalog edits."""
from importlib import import_module
import sqlalchemy as sa
op = import_module('alembic.op')
revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('order_items', sa.Column('variant_id', sa.String(36), nullable=False, server_default=''))
    op.add_column('order_items', sa.Column('execution_name', sa.String(160), nullable=False, server_default=''))

def downgrade():
    op.drop_column('order_items', 'execution_name')
    op.drop_column('order_items', 'variant_id')
