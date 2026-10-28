"""Persist photo sessions across application restart."""
from alembic import op
import sqlalchemy as sa
revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("configurator_sessions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))

def downgrade():
    op.drop_table("configurator_sessions")
