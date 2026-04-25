"""Phase 7B — `panels` table for catalog SKU management.

Holds physical SKUs the customer mounts on their wall. Bounds with the
Phase 6 file-storage layer via `photo_path` (soft pointer to
`media_assets.path` — no FK; rationale in `PanelModel` docstring).

Seed data: the migration also inserts the three baseline SKUs
(30×30, 30×60, 60×60) so the public catalog is non-empty on a fresh
deploy. Prices match the legacy `frontend/src/shared/config/constants.
ts` BASE_PANEL_PRICES dict — the long-term goal of Phase 7B is for the
frontend to read panels via the API and stop pinning prices in code.

`downgrade()` drops the table (and the seeded rows go with it).

Revision ID: 011
Revises: 010
Create Date: 2026-04-25
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Baseline SKUs — match `frontend/src/shared/config/constants.ts`
# (PANEL_SIZES + BASE_PANEL_PRICES). Slugs chosen to be URL-friendly
# and human-readable; admin can rename later.
_SEED_PANELS = [
    {
        "slug": "small-square",
        "name": "Малая квадратная панель",
        "width_mm": 300, "height_mm": 300, "size_label": "30×30 см",
        "base_price": 890,
    },
    {
        "slug": "medium-vertical",
        "name": "Средняя вертикальная панель",
        "width_mm": 300, "height_mm": 600, "size_label": "30×60 см",
        "base_price": 1490,
    },
    {
        "slug": "large-square",
        "name": "Большая квадратная панель",
        "width_mm": 600, "height_mm": 600, "size_label": "60×60 см",
        "base_price": 2490,
    },
]


def upgrade() -> None:
    op.create_table(
        "panels",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("width_mm", sa.Integer(), nullable=False),
        sa.Column("height_mm", sa.Integer(), nullable=False),
        sa.Column("size_label", sa.String(40), nullable=False, server_default=""),
        sa.Column("base_price", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("photo_path", sa.String(500), nullable=False, server_default=""),
        # SQLite stores booleans as 0/1; Postgres asyncpg accepts the same
        # string thanks to SQLAlchemy's bind-param coercion. `true()`
        # would emit dialect-specific SQL; the literal '1' is portable.
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_panels_slug"),
    )
    op.create_index(
        "idx_panels_slug", "panels", ["slug"], if_not_exists=True,
    )
    op.create_index(
        "idx_panels_is_active", "panels", ["is_active"], if_not_exists=True,
    )

    # Seed baseline SKUs. Use op.bulk_insert so the data lives in the
    # migration (alembic round-trip restores it on every fresh upgrade).
    panels_table = sa.table(
        "panels",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("width_mm", sa.Integer),
        sa.column("height_mm", sa.Integer),
        sa.column("size_label", sa.String),
        sa.column("base_price", sa.Integer),
        sa.column("description", sa.Text),
        sa.column("photo_path", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )
    from datetime import datetime
    now = datetime.utcnow()
    op.bulk_insert(
        panels_table,
        [
            {
                "id": str(uuid4()),
                "name": p["name"],
                "slug": p["slug"],
                "width_mm": p["width_mm"],
                "height_mm": p["height_mm"],
                "size_label": p["size_label"],
                "base_price": p["base_price"],
                "description": "",
                "photo_path": "",
                "is_active": True,
                "created_at": now,
            }
            for p in _SEED_PANELS
        ],
    )


def downgrade() -> None:
    op.drop_index("idx_panels_is_active", table_name="panels", if_exists=True)
    op.drop_index("idx_panels_slug", table_name="panels", if_exists=True)
    op.drop_table("panels")
