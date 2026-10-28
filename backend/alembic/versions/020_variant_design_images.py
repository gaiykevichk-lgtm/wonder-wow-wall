"""Separate interior photographs from finish photographs."""
from alembic import op
import sqlalchemy as sa
revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('panel_variants', sa.Column('design_image_paths', sa.JSON(), nullable=False, server_default='[]'))

def downgrade():
    op.drop_column('panel_variants', 'design_image_paths')
