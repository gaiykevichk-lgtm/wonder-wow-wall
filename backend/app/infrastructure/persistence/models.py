"""SQLAlchemy ORM models — mapped to domain entities."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, UniqueConstraint, Index, false, true
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
    # Phase 5 — admin can disable an account without deleting it.
    # `server_default=false()` backfills existing rows on `alembic upgrade`
    # so the NOT NULL constraint stays satisfied; `default=False` covers
    # the SQLite test rig that uses `Base.metadata.create_all()`.
    is_blocked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
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
    # Phase 4B — populated by `Order.cancel(reason)` / `refund(reason)`. NULL
    # for any non-terminated order. Single column reused for both verbs;
    # `status` disambiguates which one happened.
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["UserModel"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItemModel"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    # Phase 4B — internal admin annotations. cascade="all, delete-orphan"
    # mirrors `items` so deleting an order also deletes its notes (no
    # orphan rows in the join table).
    notes: Mapped[list["OrderNoteModel"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderNoteModel.created_at",
    )


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


class OrderNoteModel(Base):
    """Phase 4B — internal admin notes attached to an order.

    Author is a `users.id` FK so we can render the author's name in the UI;
    no FK constraint to a "deleted users" table because admins are
    permanent — a deleted admin is a corner case we don't optimise for.
    """

    __tablename__ = "order_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped["OrderModel"] = relationship(back_populates="notes")


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


# ─── Media assets (Phase 6) ─────────────────────────────────────────

class MediaAssetModel(Base):
    """Phase 6 — admin file uploads (panel photos, design previews, banners).

    `path` is storage-relative and UNIQUE — the storage adapter
    (`LocalFileStorage`) hands out `<purpose>/<uuid4>.<ext>` strings, so
    a UNIQUE constraint serves as a defense-in-depth check against a
    UUID collision (vanishingly unlikely, but free here).

    `uploaded_by` is a soft FK (no `ForeignKey()`) because we want to
    preserve audit history even if the user is later deleted. Same
    decision as `OrderNoteModel.author_id` — admins are permanent in
    practice, but the audit trail must outlive any individual account.
    """

    __tablename__ = "media_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    # Storage-relative path; nginx serves `/uploads/<path>`. UNIQUE +
    # indexed for the orphan-sweep query (`SELECT path FROM media_assets`
    # vs. directory listing) — see `DeleteMedia` use case docstring.
    path: Mapped[str] = mapped_column(
        String(500), unique=True, nullable=False, index=True,
    )
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Original filename from the upload form, sanitised (no directories)
    # by `UploadMedia._safe_original_name`. 255 char cap matches the
    # POSIX filename limit so any reasonable name fits.
    original_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    uploaded_by: Mapped[str] = mapped_column(String(36), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Panels (Phase 7B) ──────────────────────────────────────────────

class PanelModel(Base):
    """Phase 7B — physical SKU mounted on the wall.

    `slug` is UNIQUE because public catalog URLs use it (`/catalog/panels/
    small-square`) and a duplicate would silently shadow the older row.
    `width_mm` + `height_mm` are stored as plain ints (not a composite
    type) so adding a new size never requires an enum migration; the
    `PanelSize` VO at the domain layer enumerates which combinations the
    constructor actually supports.

    `photo_path` is a soft pointer to `media_assets.path` — no FK so
    deleting a `MediaAsset` doesn't cascade-null the panel column (the
    URL would 404 instead, which the admin UI already handles for
    optimistic-deleted assets). Same trade-off as `OrderItemModel.
    design_image`.

    `is_active` defaults to True so a fresh `PanelModel()` is publishable
    immediately. The admin un-checks it to hide a SKU without losing the
    row (and any stats dashboards keyed on it).
    """

    __tablename__ = "panels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(120), unique=True, nullable=False, index=True,
    )
    width_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    height_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    # Display label cached on the row so the public listing endpoint can
    # render "30×60 см" without re-deriving the cm-formatted string from
    # mm dimensions on every request. The admin form pre-fills it from
    # the size picker; admins can override for special-case SKUs.
    size_label: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    base_price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    # `default=True` covers `Base.metadata.create_all()` in the SQLite
    # test rig; `server_default=true()` backfills production rows on
    # `alembic upgrade` so the NOT NULL constraint is satisfied. Same
    # pattern as `UserModel.is_blocked` (Phase 5).
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Shop settings (Phase 8A) ───────────────────────────────────────

class ShopSettingsModel(Base):
    """Phase 8A — singleton row of admin-managed business knobs.

    There is exactly one row, with a fixed PK `"singleton"`. Modelled
    as a regular table (not a JSON column) so admin patches survive a
    schema migration unchanged and individual fields can grow indexes
    later if needed.

    Defaults match `frontend/src/shared/config/constants.ts` so the
    catalog and constructor render identically before vs after the
    Phase 8A switchover. The migration `012_create_shop_settings`
    seeds the row with these values; the runtime never inserts.
    """

    __tablename__ = "shop_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    design_overlay_price: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1200, server_default="1200",
    )
    installation_price: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    min_order_amount: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
    )
    # Phase 10 — admin-tunable cap on the «с этим покупают» rail. Default
    # mirrors `ShopSettings.recommendations_limit_per_source` (12); the
    # migration `014` backfills existing rows via `server_default="12"`.
    recommendations_limit_per_source: Mapped[int] = mapped_column(
        Integer, nullable=False, default=12, server_default="12",
    )


# ─── Banners (Phase 8B) — pending; the draft model was removed
# 2026-04-25 because shipping it without alembic migration `013` and
# container wiring caused schema-divergence between dev (Base.metadata
# create_all) and prod (alembic). Re-add with migration in the same PR.


# ─── Audit log (Phase 9) ────────────────────────────────────────────

class AuditEntryModel(Base):
    """Phase 9 — append-only admin action log.

    `payload` is a JSON column (not a child table) because:
      * the shape is action-specific — ORDER_STATUS_CHANGE carries
        `{old, new}`, USER_BLOCK carries `{reason}`, etc. — a typed
        column would force a NULLable kitchen-sink schema.
      * the read pattern is "show me everything for this row" — we
        never query INTO the JSON, only display it.

    Indexes:
      * `(actor_id, created_at desc)` — admin filter "what did THIS
        admin do recently".
      * `(target_type, target_id, created_at desc)` — admin deep link
        "show all events for THIS user/order".
      * Plain `created_at desc` index covers the unfiltered list view.

    `target_type` and `target_id` are NULLable because some future
    actions (e.g., bulk export) won't have a single target. The domain
    enforces that `target_id` cannot be set without `target_type`.
    """

    __tablename__ = "audit_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True,
    )


# ─── Recommendations (Phase 10) ─────────────────────────────────────


class RecommendationModel(Base):
    """Phase 10 — admin-curated «с этим покупают» rail per source product.

    Identity is the natural key `(source_type, source_id)` enforced by a
    UNIQUE constraint; the `id` (uuid) is kept so child rows in
    `recommendation_targets` can FK back without resolving the composite
    key. `source_id` is a soft pointer (no FK) — Designs and Panels live
    in different tables so a single FK cannot cover both, and cascade
    cleanup is handled at the application layer
    (`CleanupRecommendationsOnDelete`) which has the cross-aggregate
    visibility required.
    """

    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
    )

    targets: Mapped[list["RecommendationTargetModel"]] = relationship(
        back_populates="recommendation",
        cascade="all, delete-orphan",
        order_by="RecommendationTargetModel.position",
    )

    __table_args__ = (
        UniqueConstraint(
            "source_type", "source_id",
            name="uq_recommendations_source",
        ),
    )


class RecommendationTargetModel(Base):
    """Phase 10 — child row inside a `Recommendation` aggregate.

    `position` is the canonical display order (0-based). The application
    layer (`Recommendation.replace_all`) treats the list index as the
    authoritative position; the persistence layer translates that into
    `position = index` on save.

    UNIQUE on `(recommendation_id, target_type, target_id)` mirrors the
    aggregate's no-duplicate-targets invariant. Index on
    `(target_type, target_id)` covers the cascade-cleanup query
    `find_by_target` — a deleted product needs to find every aggregate
    that lists it.
    """

    __tablename__ = "recommendation_targets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    recommendation_id: Mapped[str] = mapped_column(
        ForeignKey("recommendations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    recommendation: Mapped["RecommendationModel"] = relationship(
        back_populates="targets",
    )

    __table_args__ = (
        UniqueConstraint(
            "recommendation_id", "target_type", "target_id",
            name="uq_recommendation_targets_unique",
        ),
        Index(
            "ix_recommendation_targets_target",
            "target_type", "target_id",
        ),
    )
