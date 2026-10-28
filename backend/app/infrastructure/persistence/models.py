"""SQLAlchemy ORM models — mapped to domain entities."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, CheckConstraint, UniqueConstraint, Index, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid4())


class SpacesPageSettingsModel(Base):
    __tablename__ = "spaces_page_settings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    heading: Mapped[str] = mapped_column(String(255), nullable=False)
    intro: Mapped[str] = mapped_column(Text, nullable=False)


class SpaceInteriorModel(Base):
    __tablename__ = "space_interiors"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)


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
    # Phase 7A — admin-controlled soft-hide. `default=True` covers the
    # `Base.metadata.create_all()` test rig; `server_default=true()`
    # backfills production rows on `alembic upgrade` so the NOT NULL
    # constraint is satisfied. Same pattern as `PanelModel.is_active`
    # (Phase 7B) and `UserModel.is_blocked` (Phase 5).
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    # Phase 12 — white silhouette for the forms catalog grid.
    preview_image: Mapped[str] = mapped_column(String(500), default="", server_default="")
    # PC-CARD-GALLERY — дополнительные фото для слайдера на /product/:id.
    gallery_images: Mapped[list] = mapped_column(
        JSON, default=list, server_default="[]"
    )
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

    variant_id: Mapped[str] = mapped_column(String(36), default="", server_default="")
    execution_name: Mapped[str] = mapped_column(String(160), default="", server_default="")

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), nullable=False)
    design_id: Mapped[str] = mapped_column(String(36), default="")
    design_name: Mapped[str] = mapped_column(String(255), default="")
    design_image: Mapped[str] = mapped_column(String(500), default="")
    size_key: Mapped[str] = mapped_column(String(20), default="")
    color: Mapped[str] = mapped_column(String(100), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, default=0)

    # Phase 12 — configurator texture/color tracking.
    texture_name: Mapped[str] = mapped_column(String(255), default="", server_default="")
    texture_id: Mapped[str] = mapped_column(String(36), default="", server_default="")
    color_id: Mapped[str] = mapped_column(String(36), default="", server_default="")

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

class PanelAvailabilityStatusModel(Base):
    __tablename__ = "panel_availability_statuses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#dc2626")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    panels: Mapped[list["PanelModel"]] = relationship(back_populates="availability_status")


class PanelModel(Base):
    """Phase 7B — physical SKU mounted on the wall.

    `slug` groups panels of the same base form; only `id` identifies a row.
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
        String(120), nullable=False, index=True,
    )
    width_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    height_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    # Display label cached on the row so the public listing endpoint can
    # render "30×60 см" without re-deriving the cm-formatted string from
    # mm dimensions on every request. The admin form pre-fills it from
    # the size picker; admins can override for special-case SKUs.
    size_label: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    base_price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="Available inventory reduced on customer checkout")
    availability_status_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("panel_availability_statuses.id", ondelete="SET NULL"), nullable=True, index=True)
    availability_status: Mapped[PanelAvailabilityStatusModel | None] = relationship(back_populates="panels")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Технические характеристики панели (миграция 035): редактируются в
    # админке и показываются в карточке каталога. Держим здесь, чтобы
    # `models.py` совпадал со схемой БД и `/api/panels` не падал.
    thickness_mm: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    execution: Mapped[str] = mapped_column(String(500), nullable=False, default="Архитектурное декоративное покрытие")
    mounting_system: Mapped[str] = mapped_column(String(500), nullable=False, default="Запатентованная система быстрой замены")
    base_material: Mapped[str] = mapped_column(String(500), nullable=False, default="Ультралёгкий композит высокой плотности")
    packaging: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    # Catalog gallery. `photo_path` stays the single "primary" pointer for
    # every legacy consumer (order items, admin table thumbnail); this JSON
    # list carries the full ordered set the catalog card renders, so an
    # admin can publish two shots (e.g. straight-on + angled) per panel.
    # Invariant kept by the use case, not the column: when non-empty its
    # first element always equals `photo_path`.
    photo_paths: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    # Базовый силуэт формы панели (белый PNG, например
    # `/forms/30x30/<slug>-front.png`). Используется как превью
    # в карточках каталога. Заполняется админом в визарде.
    form_preview_path: Mapped[str] = mapped_column(
        String(500), nullable=False, default="", server_default=""
    )
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


# ─── Banners (Phase 8B) ─────────────────────────────────────────────


class BannerModel(Base):
    """Phase 8B — homepage promo rotation.

    `position` is stored as the literal enum string (`homepage_hero`,
    `catalog_top`, `footer`) so DB rows stay human-readable and a
    future enum reorder doesn't shuffle FKs (there are none — banners
    aren't referenced by any other entity).

    `image_path` is a soft pointer to `media_assets.path` (no FK) —
    same trade-off as `Panel.photo_path`. A deleted MediaAsset 404s
    in the public preview but doesn't cascade-null the banner row.

    Composite index `(position, is_active, priority)` covers the public
    list query `WHERE position = ? AND is_active = TRUE ORDER BY
    priority` — single index scan instead of a sort over the table.
    """

    __tablename__ = "banners"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    image_path: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    cta_label: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    cta_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    position: Mapped[str] = mapped_column(
        String(32), nullable=False, default="homepage_hero",
    )
    priority: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true(),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    __table_args__ = (
        Index(
            "idx_banners_position_active_priority",
            "position", "is_active", "priority",
        ),
    )


# ─── Subscription Plans (Phase 8C) ──────────────────────────────────


class SubscriptionPlanModel(Base):
    """Phase 8C — admin-editable subscription tariffs.

    Replaces the hardcoded `SUBSCRIPTION_PLANS` module-level list. The
    domain entity (`app/domain/subscription/entities.SubscriptionPlan`)
    keeps its shape; only the source-of-truth moves to the DB so an
    admin can adjust prices without a deploy.

    `id` is a slug-style string (`starter`, `popular`, `business`)
    rather than a UUID because:
      * existing `Subscription.plan_id` rows reference `"starter"` etc.
        — a UUID migration would require a backfill,
      * the public catalog URL `/subscription/{plan_id}` reads better
        with `starter` than with a UUID.

    `features` is JSON because the list shape is stable and we never
    query INTO it. `is_active` lets the admin retire a plan without
    breaking historic `Subscription` rows that reference it.
    """

    __tablename__ = "subscription_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    period: Mapped[str] = mapped_column(
        String(32), nullable=False, default="мес",
    )
    area_limit_m2: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0",
    )
    popular: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false(),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true(),
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    features: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )


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


# ─── Phase 12 — Textures & Variant Images ──────────────────────────

class TextureModel(Base):
    __tablename__ = "textures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    swatch_image: Mapped[str] = mapped_column(String(500), default="", server_default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    colors: Mapped[list["TextureColorModel"]] = relationship(
        back_populates="texture", cascade="all, delete-orphan",
    )


class TextureColorModel(Base):
    __tablename__ = "texture_colors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    texture_id: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hex: Mapped[str] = mapped_column(String(7), default="", server_default="")
    swatch_image: Mapped[str] = mapped_column(String(500), default="", server_default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    texture: Mapped["TextureModel"] = relationship(back_populates="colors")


class TextureCombinationImageModel(Base):
    """Карточка «Пространств» для одной текстуры или неупорядоченной пары.

    Equal texture ids represent mono cards. Одна строка — одна карточка
    страницы: галерея фото хранится в ``image_paths`` (первое фото — обложка),
    а название/детали/цена/площадь — в ``card``. Несколько строк на одну пару
    текстур не создаются: повторная загрузка дописывает фото в ту же строку.

    ``panel_family_1``/``panel_family_2`` — семейства базовых форм (slug без
    суффикса размера, например ``arka``). Моно — одно семейство (оба поля
    равны), комбо — два разных. Старые строки хранят пустые значения и
    продолжают работать как раньше.
    """

    __tablename__ = "texture_combination_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    texture_id_1: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="CASCADE"), nullable=False, index=True)
    texture_id_2: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="CASCADE"), nullable=False, index=True)
    # Семейство базовой формы без суффикса размера (например "arka" вместо
    # "arka-300x300"). Пустая строка — строка создана до привязки к панелям.
    panel_family_1: Mapped[str] = mapped_column(String(120), nullable=False, default="", server_default="")
    panel_family_2: Mapped[str] = mapped_column(String(120), nullable=False, default="", server_default="")
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    # Галерея карточки: все фото, первое — обложка (дублирует image_path).
    # Существующие строки получают одноэлементный список через миграцию 037.
    image_paths: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default='[]')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Карточка «Пространств»: название/детали/цена/площадь вводятся в админке
    # на той же строке «Изображений». Пустой dict — карточка без текста.
    card: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default='{}')

    __table_args__ = (
        CheckConstraint("texture_id_1 <= texture_id_2", name="ck_texture_combination_images_ordered_pair"),
        CheckConstraint("panel_family_1 <= panel_family_2", name="ck_texture_combination_images_ordered_panels"),
    )


class VariantImageModel(Base):
    __tablename__ = "variant_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    design_id: Mapped[str] = mapped_column(ForeignKey("designs.id", ondelete="CASCADE"), nullable=False)
    texture_id: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="RESTRICT"), nullable=False)
    color_id: Mapped[str] = mapped_column(ForeignKey("texture_colors.id", ondelete="RESTRICT"), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "design_id", "texture_id", "color_id",
            name="uq_variant_images_combination",
        ),
    )


# ─── Panel texture assignments / variants ──────────────────────────

class PanelTextureAssignmentModel(Base):
    """A moderator-approved texture for a panel.

    The assignment is deliberately independent from ``PanelVariantModel``:
    enabling a texture must not create an empty product or copy image galleries.
    """

    __tablename__ = "panel_texture_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    panel_id: Mapped[str] = mapped_column(ForeignKey("panels.id", ondelete="CASCADE"), nullable=False, index=True)
    texture_id: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    is_catalog_row: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "panel_id", "texture_id", name="uq_panel_texture_assignment"
        ),
    )


class PanelVariantModel(Base):
    """Phase 12 — panel variant: panel size + texture + images.

    Represents a specific configuration that customers can order.
    For example: Panel "30×30" + Texture "Oak" + Images ["oak-1.jpg", ...].

    `color_id` / `color_hex` are legacy: colour was removed from the product
    model because the photos already communicate the finish. Both stay
    nullable so historical rows keep loading; new rows leave them NULL.
    """

    __tablename__ = "panel_variants"

    slug: Mapped[str] = mapped_column(String(160), nullable=False, default="", server_default="")

    name: Mapped[str] = mapped_column(String(160), nullable=False, default="", server_default="")

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    panel_id: Mapped[str] = mapped_column(ForeignKey("panels.id", ondelete="CASCADE"), nullable=False, index=True)
    texture_id: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="RESTRICT"), nullable=False, index=True)
    color_id: Mapped[str] = mapped_column(ForeignKey("texture_colors.id", ondelete="SET NULL"), nullable=True)
    color_hex: Mapped[str] = mapped_column(String(7), nullable=True, default="", server_default="")
    image_paths: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    design_image_paths: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    recommendation_image_paths: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Legacy constraint from the colour era. Postgres treats each NULL
        # as distinct, so with colour removed (`color_id IS NULL`) this no
        # longer restricts anything and several photo-sets per
        # panel+texture are allowed. Kept to avoid a destructive migration
        # on live data.
        UniqueConstraint(
            "panel_id", "texture_id", "color_id",
            name="uq_panel_variant_unique",
        ),
        Index("ix_panel_variant_panel_texture", "panel_id", "texture_id"),
        Index("ix_panel_variant_group_order", "panel_id", "texture_id", "sort_order"),
    )


# ─── Texture Visualization (WWW в дизайне) ─────────────────────────

class TextureVisualizationModel(Base):
    """Визуализация фактуры для интерактивного блока «WWW в дизайне»."""

    __tablename__ = "texture_visualizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    texture_id: Mapped[str] = mapped_column(ForeignKey("textures.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    media_type: Mapped[str] = mapped_column(String(20), default="image", server_default="image")
    media_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    poster_url: Mapped[str] = mapped_column(String(1000), default="", server_default="")
    bg_image_url: Mapped[str] = mapped_column(String(1000), default="", server_default="")
    title: Mapped[str] = mapped_column(String(255), default="", server_default="")
    subtitle: Mapped[str] = mapped_column(String(255), default="", server_default="")
    scroll_hint: Mapped[str] = mapped_column(String(255), default="Листайте вверх", server_default="Листайте вверх")
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
