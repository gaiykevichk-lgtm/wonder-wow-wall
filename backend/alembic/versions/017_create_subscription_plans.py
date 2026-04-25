"""Phase 8C — `subscription_plans` table + seed of the 3 baseline tiers.

Migrates `SUBSCRIPTION_PLANS` from a hardcoded module-level constant
(`backend/app/domain/subscription/entities.py`) into an admin-editable
table. Seed values match the legacy constant verbatim so existing
`Subscription.plan_id` rows (`starter`, `popular`, `business`)
continue to resolve.

Schema notes:
  * `id` is a slug-style string (PRIMARY KEY) rather than UUID — the
    existing `subscriptions.plan_id` column already stores `starter` /
    `popular` / `business` text. Switching to UUID would require a
    backfill that doesn't add value.
  * `features` is JSON because the list shape is stable and we never
    query INTO it.
  * `is_active` lets the admin retire a plan without breaking historic
    `Subscription` rows that reference it (the constructor's
    `_get_plan` falls back to the inactive row's data).
  * `sort_order` for stable display order; admin can reorder via a
    dedicated PATCH.

`downgrade()` drops the table; the seed disappears with it. Domain
fallback (the legacy hardcoded list still lives in `entities.py` for
the duration of the migration) means the app does not crash on a
hypothetical downgrade.

Revision ID: 017
Revises: 016
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Seed values — duplicated from `app/domain/subscription/entities.py:
# SUBSCRIPTION_PLANS` so the migration is self-contained. Once Phase 8C
# is fully shipped and the constant is dropped (left for a follow-up
# release to give callers time to migrate), this list becomes the
# single source of truth at install time.
_SEED_PLANS = [
    {
        "id": "starter",
        "name": "Стартовый",
        "price": 7000,
        "period": "мес",
        "area_limit_m2": 15.0,
        "popular": False,
        "is_active": True,
        "sort_order": 0,
        "features": [
            "До 15 м² накладок в месяц",
            "Все дизайны из каталога",
            "Бесплатная доставка по Москве",
            "Замена повреждённых накладок",
            "Поддержка 9:00–18:00",
        ],
    },
    {
        "id": "popular",
        "name": "Популярный",
        "price": 12000,
        "period": "мес",
        "area_limit_m2": 30.0,
        "popular": True,
        "is_active": True,
        "sort_order": 1,
        "features": [
            "До 30 м² накладок в месяц",
            "Все дизайны + эксклюзивные коллекции",
            "Бесплатная доставка по РФ",
            "Приоритетная замена повреждённых",
            "Поддержка 8:00–22:00",
            "Персональный дизайнер",
            "Сохранение до 5 проектов",
        ],
    },
    {
        "id": "business",
        "name": "Бизнес",
        "price": 18000,
        "period": "мес",
        "area_limit_m2": 0.0,
        "popular": False,
        "is_active": True,
        "sort_order": 2,
        "features": [
            "Безлимитная площадь накладок",
            "Эксклюзивные и кастомные дизайны",
            "VIP-доставка по всей РФ",
            "Замена в течение 24 часов",
            "Поддержка 24/7",
            "Персональный менеджер",
            "Безлимитные проекты",
            "Скидка 20% на базовые панели",
        ],
    },
]


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.String(64), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("period", sa.String(32), nullable=False, server_default="мес"),
        sa.Column(
            "area_limit_m2", sa.Float(), nullable=False, server_default="0",
        ),
        sa.Column(
            "popular", sa.Boolean(), nullable=False, server_default=sa.text("0"),
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1"),
        ),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default="0",
        ),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    plans_table = sa.table(
        "subscription_plans",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("price", sa.Integer),
        sa.column("period", sa.String),
        sa.column("area_limit_m2", sa.Float),
        sa.column("popular", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("features", sa.JSON),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )
    from datetime import datetime
    now = datetime.utcnow()
    op.bulk_insert(
        plans_table,
        [{**p, "created_at": now, "updated_at": now} for p in _SEED_PLANS],
    )


def downgrade() -> None:
    op.drop_table("subscription_plans")
