"""Additive: human-readable execution name on panel variants."""
from importlib import import_module
import sqlalchemy as sa
op = import_module('alembic.op')
revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('panel_variants', sa.Column('name', sa.String(160), nullable=False, server_default=''))

def downgrade():
    op.drop_column('panel_variants', 'name')
