"""SQLAlchemy ORM models — mapped to domain entities."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid4())


# ─── User ────────────────────────────────────────────────────────────

class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Phase 1 — admin panel. `server_default` backfills existing rows on
    # `alembic upgrade`; `default=` is used by `Base.metadata.create_all()`
    # in the SQLite test rig (no migrations run there).
    role: Mapped[str] = mapped_column(
        String(16), nullable=False, default="CUSTOMER", server_default="CUSTOMER"
    )

    addresses: Mapped[list["UserAddressModel"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    orders: Mapped[list["OrderModel"]] = relationship(back_populates="user")
    subscriptions: Mapped[list["SubscriptionModel"]] = relationship(back_populates="user")
    projects: Mapped[list["ProjectModel"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    visualization_projects: Mapped[list["VisualizationProjectModel"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserAddressModel(Base):
    __tablename__ = "user_addresses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    street: Mapped[str] = mapped_column(String(255), default="")
    building: Mapped[str] = mapped_column(String(50), default="")
    apartment: Mapped[str] = mapped_column(String(50), default="")
    postal_code: Mapped[str] = mapped_column(String(20), default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["UserModel"] = relationship(back_populates="addresses")


# ─── Catalog ─────────────────────────────────────────────────────────

class CategoryModel(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    image: Mapped[str] = mapped_column(String(500), default="")
    count: Mapped[int] = mapped_column(Integer, default=0)

    designs: Mapped[list["DesignModel"]] = relationship(back_populates="category")


class DesignModel(Base):
    __tablename__ = "designs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    style: Mapped[str] = mapped_column(String(100), default="")
    image: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer, default=1200)
    colors: Mapped[dict] = mapped_column(JSON, default=list)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category: Mapped["CategoryModel"] = relationship(back_populates="designs")
    reviews: Mapped[list["DesignReviewModel"]] = relationship(back_populates="design", cascade="all, delete-orphan")


class DesignReviewModel(Base):
    __tablename__ = "design_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    design_id: Mapped[str] = mapped_column(ForeignKey("designs.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    user_name: Mapped[str] = mapped_column(String(255), default="")
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    design: Mapped["DesignModel"] = relationship(back_populates="reviews")


# ─── Orders ──────────────────────────────────────────────────────────

class OrderModel(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="placed")
    address: Mapped[str] = mapped_column(Text, default="")
    total: Mapped[int] = mapped_column(Integer, default=0)
    installation_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["UserModel"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItemModel"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItemModel(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), nullable=False)
    design_id: Mapped[str] = mapped_column(String(36), default="")
    design_name: Mapped[str] = mapped_column(String(255), default="")
    design_image: Mapped[str] = mapped_column(String(500), default="")
    size_key: Mapped[str] = mapped_column(String(20), default="")
    color: Mapped[str] = mapped_column(String(100), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, default=0)

    order: Mapped["OrderModel"] = relationship(back_populates="items")


# ─── Subscriptions ───────────────────────────────────────────────────

class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    plan_id: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    area_used_this_month_m2: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["UserModel"] = relationship(back_populates="subscriptions")


# ─── Projects ────────────────────────────────────────────────────────

class ProjectModel(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    wall_cols: Mapped[int] = mapped_column(Integer, default=5)
    wall_rows: Mapped[int] = mapped_column(Integer, default=3)
    wall_color: Mapped[str] = mapped_column(String(20), default="#ffffff")
    panels: Mapped[dict] = mapped_column(JSON, default=list)
    total_price: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["UserModel"] = relationship(back_populates="projects")


# ─── Visualization Projects ─────────────────────────────────────────

class VisualizationProjectModel(Base):
    __tablename__ = "visualization_projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    # ondelete=CASCADE mirrors migration 004 + relationship(cascade="all, delete-orphan").
    # index=True for `get_by_user`-style lookups (FK without index ⇒ full scan).
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    photo_url: Mapped[str] = mapped_column(Text, default="")
    photo_width: Mapped[int] = mapped_column(Integer, default=0)
    photo_height: Mapped[int] = mapped_column(Integer, default=0)
    wall_mask_base64: Mapped[str] = mapped_column(Text, default="")
    calibration_pixels_per_cm: Mapped[float] = mapped_column(Float, default=5.0)
    panels_json: Mapped[dict] = mapped_column(JSON, default=list)
    perspective_corners: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    placement_mode: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # ─── Phase 5B additions (migration 005) ──────────────────────────
    # Typed calibration VO serialized as JSON (`{"method", "pixels_per_cm",
    # "wall_width_cm?", "wall_height_cm?"}`). NULL until 5C frontend writes it.
    calibration: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    # Provenance flags — drive frontend banners.
    # `sa.false()` (not `"0"`) — matches migration 005's `server_default=sa.false()`
    # and renders as `FALSE` on PG, `0` on SQLite. B30 closure.
    perspective_auto_detected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    calibration_auto_detected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    # Optimistic-lock counter — see `SqlVisualizationProjectRepository.update`.
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )

    user: Mapped["UserModel"] = relationship(back_populates="visualization_projects")
