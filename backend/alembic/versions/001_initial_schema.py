"""Initial schema — all tables for MVP.

Revision ID: 001
Revises: None
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Users ────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "user_addresses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), server_default=""),
        sa.Column("city", sa.String(100), server_default=""),
        sa.Column("street", sa.String(255), server_default=""),
        sa.Column("building", sa.String(50), server_default=""),
        sa.Column("apartment", sa.String(50), server_default=""),
        sa.Column("postal_code", sa.String(20), server_default=""),
        sa.Column("is_default", sa.Boolean, server_default=sa.text("false")),
    )

    # ── Catalog ──────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("image", sa.String(500), server_default=""),
        sa.Column("count", sa.Integer, server_default="0"),
    )

    op.create_table(
        "designs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False),
        sa.Column("category_id", sa.String(36), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("style", sa.String(100), server_default=""),
        sa.Column("image", sa.String(500), server_default=""),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("price", sa.Integer, server_default="1200"),
        sa.Column("colors", sa.JSON, server_default="[]"),
        sa.Column("rating", sa.Float, server_default="0.0"),
        sa.Column("reviews_count", sa.Integer, server_default="0"),
        sa.Column("is_new", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_popular", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "design_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("design_id", sa.String(36), sa.ForeignKey("designs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_name", sa.String(255), server_default=""),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # ── Orders ───────────────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("number", sa.String(50), unique=True, nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="placed"),
        sa.Column("address", sa.Text, server_default=""),
        sa.Column("total", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "order_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("design_id", sa.String(36), server_default=""),
        sa.Column("design_name", sa.String(255), server_default=""),
        sa.Column("design_image", sa.String(500), server_default=""),
        sa.Column("size_key", sa.String(20), server_default=""),
        sa.Column("color", sa.String(100), server_default=""),
        sa.Column("quantity", sa.Integer, server_default="1"),
        sa.Column("unit_price", sa.Integer, server_default="0"),
    )

    # ── Subscriptions ────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_id", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("overlays_used_this_month", sa.Integer, server_default="0"),
        sa.Column("started_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )

    # ── Sequences ─────────────────────────────────────────────────────
    # Postgres-only: SQLite has no SEQUENCE concept (test rigs that target
    # `sqlite+aiosqlite:///:memory:` would otherwise fail here). On postgres
    # this branch is unchanged from the original migration.
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1"))

    # ── Projects ─────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("wall_cols", sa.Integer, server_default="5"),
        sa.Column("wall_rows", sa.Integer, server_default="3"),
        sa.Column("wall_color", sa.String(20), server_default="#ffffff"),
        sa.Column("panels", sa.JSON, server_default="[]"),
        sa.Column("total_price", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("DROP SEQUENCE IF EXISTS order_number_seq"))
    op.drop_table("projects")
    op.drop_table("subscriptions")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("design_reviews")
    op.drop_table("designs")
    op.drop_table("categories")
    op.drop_table("user_addresses")
    op.drop_table("users")
