"""Phase 8A — `shop_settings` singleton row for runtime business knobs.

Creates a single-row table seeded with defaults that match the legacy
`frontend/src/shared/config/constants.ts` constants — the long-term goal
of Phase 8A is for the constructor + catalog to read these values via
`/api/shop/settings` (TanStack Query, 5-min cache) instead of pinning
them in the JS bundle.

Schema is one ordinary table (not a JSON column) so each knob can grow
its own validator/index/migration independently. The PK is the literal
string `"singleton"` — there is exactly one row.

`downgrade()` drops the table; the seeded row goes with it.

Revision ID: 012
Revises: 011
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Defaults match `frontend/src/shared/config/constants.ts`
# (`DESIGN_OVERLAY_PRICE = 1200`). `installation_price` and
# `min_order_amount` are admin-toggleable; both default to 0 so existing
# deployments behave identically to pre-Phase-8 builds.
_SINGLETON_ID = "singleton"
_SEED = {
    "id": _SINGLETON_ID,
    "design_overlay_price": 1200,
    "installation_price": 0,
    "min_order_amount": 0,
}


def upgrade() -> None:
    op.create_table(
        "shop_settings",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "design_overlay_price", sa.Integer(),
            nullable=False, server_default="1200",
        ),
        sa.Column(
            "installation_price", sa.Integer(),
            nullable=False, server_default="0",
        ),
        sa.Column(
            "min_order_amount", sa.Integer(),
            nullable=False, server_default="0",
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Seed the singleton row. Use op.bulk_insert so `alembic upgrade
    # head` from a fresh DB always lands on a queryable singleton (the
    # SqlShopSettingsRepository.get() raises if the row is missing —
    # see its docstring).
    settings_table = sa.table(
        "shop_settings",
        sa.column("id", sa.String),
        sa.column("design_overlay_price", sa.Integer),
        sa.column("installation_price", sa.Integer),
        sa.column("min_order_amount", sa.Integer),
        sa.column("updated_at", sa.DateTime),
    )
    from datetime import datetime
    op.bulk_insert(settings_table, [{**_SEED, "updated_at": datetime.utcnow()}])


def downgrade() -> None:
    op.drop_table("shop_settings")
