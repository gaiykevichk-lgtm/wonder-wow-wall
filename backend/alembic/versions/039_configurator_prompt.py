"""Persistent instruction for configurator image generation."""
from alembic import op
import sqlalchemy as sa

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "configurator_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("id = 1", name="ck_configurator_settings_singleton"),
        sa.CheckConstraint("length(trim(system_prompt)) BETWEEN 1 AND 20000", name="ck_configurator_prompt_length"),
    )
    op.execute(sa.text("INSERT INTO configurator_settings (id, system_prompt) VALUES (1, :prompt)").bindparams(
        prompt="Сохрани идентичность комнаты: та же перспектива, мебель, свет и габариты помещения, что на исходном фото."
    ))


def downgrade():
    op.drop_table("configurator_settings")
