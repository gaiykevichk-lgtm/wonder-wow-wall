"""SQL repository implementations — SQLAlchemy async, mapped to domain entities."""

import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.panel import Panel
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.domain.catalog.repositories import (
    DesignRepository, CategoryRepository, ReviewRepository, PanelRepository,
    RecommendationFilters, RecommendationRepository,
)
from app.domain.catalog.value_objects import Color, PanelSize
from app.domain.order.entities import Order, OrderItem, OrderNote
from app.domain.order.filters import OrderFilters
from app.domain.order.repositories import OrderRepository
from app.domain.order.value_objects import OrderStatus, Address
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.subscription.value_objects import SubscriptionStatus
from app.domain.user.entities import User, UserAddress
from app.domain.user.filters import UserFilters
from app.domain.user.repositories import UserRepository
from app.domain.user.value_objects import UserRole
from app.domain.media.entities import MediaAsset
from app.domain.media.repositories import MediaAssetRepository
from app.domain.media.value_objects import MediaPurpose
from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.repositories import (
    BannerRepository,
    ShopSettingsRepository,
)
from app.domain.shop.settings import SHOP_SETTINGS_SINGLETON_ID, ShopSettings
from app.domain.subscription.entities import SubscriptionPlan
from app.domain.subscription.repositories import SubscriptionPlanRepository
from app.domain.audit.entities import AuditEntry
from app.domain.audit.filters import AuditFilters
from app.domain.audit.repositories import AuditEntryRepository
from app.domain.audit.value_objects import AuditAction, AuditTargetType

from app.infrastructure.persistence.models import (
    DesignModel,
    CategoryModel,
    DesignReviewModel,
    OrderModel,
    OrderItemModel,
    OrderNoteModel,
    SubscriptionModel,
    SubscriptionPlanModel,
    UserModel,
    UserAddressModel,
    ProjectModel,
    MediaAssetModel,
    PanelModel,
    ShopSettingsModel,
    BannerModel,
    AuditEntryModel,
    RecommendationModel,
    RecommendationTargetModel,
)


# ═══════════════════════════════════════════════════════════════════════
# Mappers: ORM ↔ Domain
# ═══════════════════════════════════════════════════════════════════════

def _design_to_domain(m: DesignModel) -> Design:
    colors_raw = m.colors if isinstance(m.colors, list) else []
    colors = [Color(hex=c.get("hex", ""), name=c.get("name", "")) for c in colors_raw]
    return Design(
        id=m.id, name=m.name, slug=m.slug, category_id=m.category_id,
        style=m.style, image=m.image, description=m.description, price=m.price,
        colors=colors, rating=m.rating, reviews_count=m.reviews_count,
        is_new=m.is_new, is_popular=m.is_popular,
        # Phase 7A — `getattr` shields tests that build a fake `DesignModel`
        # without the column (e.g., a hand-rolled stub) from `AttributeError`.
        # Production rows always have it (NOT NULL with `server_default=true()`).
        is_published=bool(getattr(m, "is_published", True)),
        created_at=m.created_at,
    )


def _category_to_domain(m: CategoryModel) -> Category:
    return Category(id=m.id, name=m.name, slug=m.slug, image=m.image, count=m.count)


def _review_to_domain(m: DesignReviewModel) -> DesignReview:
    return DesignReview(
        id=m.id, design_id=m.design_id, user_id=m.user_id,
        user_name=m.user_name, rating=m.rating, text=m.text, created_at=m.created_at,
    )


def _order_to_domain(m: OrderModel) -> Order:
    items = [
        OrderItem(
            id=it.id, design_id=it.design_id, design_name=it.design_name,
            design_image=it.design_image, size_key=it.size_key, color=it.color,
            quantity=it.quantity, unit_price=it.unit_price,
        )
        for it in (m.items or [])
    ]
    # Phase 4B — notes are eagerly loaded by `selectinload` on the read
    # paths that need them. Iterating `m.notes` without a load attempt
    # would trigger lazy IO inside the mapper (forbidden under async).
    notes = [
        OrderNote(
            id=n.id, author_id=n.author_id, text=n.text, created_at=n.created_at,
        )
        for n in (m.notes or [])
    ]
    # Parse address from stored JSON string
    addr_data = {}
    if m.address:
        try:
            addr_data = json.loads(m.address)
        except (ValueError, TypeError):
            addr_data = {}
    address = Address(
        city=addr_data.get("city", ""),
        street=addr_data.get("street", ""),
        building=addr_data.get("building", ""),
        apartment=addr_data.get("apartment", ""),
        postal_code=addr_data.get("postal_code", ""),
    )
    return Order(
        id=m.id, number=m.number, user_id=m.user_id,
        status=OrderStatus(m.status), items=items, address=address,
        installation_date=m.installation_date,
        cancel_reason=m.cancel_reason,
        notes=notes,
        created_at=m.created_at, updated_at=m.updated_at,
    )


def _address_to_json(a: Address) -> str:
    return json.dumps({
        "city": a.city, "street": a.street, "building": a.building,
        "apartment": a.apartment, "postal_code": a.postal_code,
    }, ensure_ascii=False)


def _subscription_to_domain(m: SubscriptionModel) -> Subscription:
    return Subscription(
        id=m.id, user_id=m.user_id, plan_id=m.plan_id,
        status=SubscriptionStatus(m.status),
        area_used_this_month_m2=m.area_used_this_month_m2,
        started_at=m.started_at, expires_at=m.expires_at,
    )


def _user_to_domain(m: UserModel) -> User:
    addresses = [
        UserAddress(
            id=a.id, label=a.label, city=a.city, street=a.street,
            building=a.building, apartment=a.apartment,
            postal_code=a.postal_code, is_default=a.is_default,
        )
        for a in (m.addresses or [])
    ]
    # `m.role` comes from the DB as a plain string; tolerate unknown values
    # (e.g. row manually edited) by falling back to CUSTOMER instead of
    # crashing the profile endpoint.
    try:
        role = UserRole(m.role)
    except ValueError:
        role = UserRole.CUSTOMER
    return User(
        id=m.id, email=m.email, password_hash=m.password_hash,
        name=m.name, phone=m.phone, addresses=addresses, created_at=m.created_at,
        role=role,
        # Phase 5 — `is_blocked` defaults to False at the column level so
        # existing rows remain unblocked after the migration backfills.
        is_blocked=bool(m.is_blocked),
    )


# ═══════════════════════════════════════════════════════════════════════
# SQL Repository Implementations
# ═══════════════════════════════════════════════════════════════════════

class SqlDesignRepository(DesignRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_designs(
        self, category_id: str | None = None, search: str | None = None,
        sort_by: str = "name", offset: int = 0, limit: int = 20,
        *, color: str | None = None, style: str | None = None, is_new: bool | None = None,
        is_published: bool | None = True,
    ) -> tuple[list[Design], int]:
        query = select(DesignModel)
        count_query = select(func.count()).select_from(DesignModel)

        if category_id:
            query = query.where(DesignModel.category_id == category_id)
            count_query = count_query.where(DesignModel.category_id == category_id)

        if search:
            pattern = f"%{search.lower()}%"
            search_filter = or_(
                func.lower(DesignModel.name).like(pattern),
                func.lower(DesignModel.description).like(pattern),
                func.lower(DesignModel.style).like(pattern),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        if color:
            # JSON array search: colors column contains objects with "name" key
            from sqlalchemy import cast, String
            safe_color = color.lower().replace('%', r'\%').replace('_', r'\_')
            color_filter = func.lower(cast(DesignModel.colors, String)).like(f'%{safe_color}%', escape='\\')
            query = query.where(color_filter)
            count_query = count_query.where(color_filter)

        if style:
            style_filter = func.lower(DesignModel.style) == style.lower()
            query = query.where(style_filter)
            count_query = count_query.where(style_filter)

        if is_new is not None:
            query = query.where(DesignModel.is_new == is_new)
            count_query = count_query.where(DesignModel.is_new == is_new)

        # Phase 7A — public catalog passes `True`; admin passes `None` to
        # see everything. Idiomatic `.is_(True)` matches both Postgres and
        # SQLite (where booleans are stored as 0/1).
        if is_published is not None:
            query = query.where(DesignModel.is_published.is_(is_published))
            count_query = count_query.where(DesignModel.is_published.is_(is_published))

        sort_map = {
            "name": asc(DesignModel.name),
            "price_asc": asc(DesignModel.price),
            "price_desc": desc(DesignModel.price),
            "rating": desc(DesignModel.rating),
            "popular": desc(DesignModel.reviews_count),
            "new": desc(DesignModel.created_at),
        }
        query = query.order_by(sort_map.get(sort_by, asc(DesignModel.name)))
        query = query.offset(offset).limit(limit)

        total = (await self._session.execute(count_query)).scalar() or 0
        result = await self._session.execute(query)
        designs = [_design_to_domain(row) for row in result.scalars().all()]
        return designs, total

    async def get_by_id(self, design_id: str) -> Design | None:
        result = await self._session.execute(
            select(DesignModel).where(DesignModel.id == design_id)
        )
        row = result.scalar_one_or_none()
        return _design_to_domain(row) if row else None

    async def get_by_slug(self, slug: str) -> Design | None:
        result = await self._session.execute(
            select(DesignModel).where(DesignModel.slug == slug)
        )
        row = result.scalar_one_or_none()
        return _design_to_domain(row) if row else None

    async def update(self, design: Design) -> Design:
        model = await self._session.get(DesignModel, design.id)
        if model:
            # Phase 7A — admin patch must be able to mutate every field
            # (not just the review-derived rating/reviews_count from the
            # original review-add code path). Keeping the assignment list
            # exhaustive is cheaper than splitting two repo methods.
            model.name = design.name
            model.slug = design.slug
            model.category_id = design.category_id
            model.style = design.style
            model.image = design.image
            model.description = design.description
            model.price = design.price
            model.rating = design.rating
            model.reviews_count = design.reviews_count
            model.is_new = design.is_new
            model.is_popular = design.is_popular
            model.is_published = design.is_published
            model.colors = [{"hex": c.hex, "name": c.name} for c in design.colors]
        await self._session.flush()
        return design

    async def create(self, design: Design) -> Design:
        model = DesignModel(
            id=design.id,
            name=design.name,
            slug=design.slug,
            category_id=design.category_id,
            style=design.style,
            image=design.image,
            description=design.description,
            price=design.price,
            colors=[{"hex": c.hex, "name": c.name} for c in design.colors],
            rating=design.rating,
            reviews_count=design.reviews_count,
            is_new=design.is_new,
            is_popular=design.is_popular,
            is_published=design.is_published,
            created_at=design.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return design

    async def delete(self, design_id: str) -> bool:
        row = await self._session.get(DesignModel, design_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True


class SqlCategoryRepository(CategoryRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_all(self) -> list[Category]:
        result = await self._session.execute(select(CategoryModel).order_by(CategoryModel.name))
        return [_category_to_domain(row) for row in result.scalars().all()]

    async def get_by_id(self, category_id: str) -> Category | None:
        result = await self._session.execute(
            select(CategoryModel).where(CategoryModel.id == category_id)
        )
        row = result.scalar_one_or_none()
        return _category_to_domain(row) if row else None

    async def get_by_slug(self, slug: str) -> Category | None:
        result = await self._session.execute(
            select(CategoryModel).where(CategoryModel.slug == slug)
        )
        row = result.scalar_one_or_none()
        return _category_to_domain(row) if row else None

    async def create(self, category: Category) -> Category:
        model = CategoryModel(
            id=category.id,
            name=category.name,
            slug=category.slug,
            image=category.image,
            count=category.count,
        )
        self._session.add(model)
        await self._session.flush()
        return category

    async def update(self, category: Category) -> Category:
        row = await self._session.get(CategoryModel, category.id)
        if row is None:
            raise LookupError(f"Category {category.id} not found")
        row.name = category.name
        row.slug = category.slug
        row.image = category.image
        row.count = category.count
        await self._session.flush()
        return category

    async def delete(self, category_id: str) -> bool:
        row = await self._session.get(CategoryModel, category_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True

    async def count_designs(self, category_id: str) -> int:
        # Pure count query — avoids materialising the full design list
        # just to take its length. Mirrors the SQL the admin list view
        # would do anyway when rendering the «N дизайнов» column.
        result = await self._session.execute(
            select(func.count())
            .select_from(DesignModel)
            .where(DesignModel.category_id == category_id)
        )
        return int(result.scalar_one())


class SqlReviewRepository(ReviewRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_by_design(
        self, design_id: str, offset: int = 0, limit: int = 20,
    ) -> list[DesignReview]:
        result = await self._session.execute(
            select(DesignReviewModel)
            .where(DesignReviewModel.design_id == design_id)
            .order_by(desc(DesignReviewModel.created_at))
            .offset(offset).limit(limit)
        )
        return [_review_to_domain(row) for row in result.scalars().all()]

    async def add(self, review: DesignReview) -> DesignReview:
        model = DesignReviewModel(
            id=review.id, design_id=review.design_id, user_id=review.user_id,
            user_name=review.user_name, rating=review.rating,
            text=review.text, created_at=review.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return review


class SqlOrderRepository(OrderRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, order: Order) -> Order:
        model = OrderModel(
            id=order.id, number=order.number, user_id=order.user_id,
            status=order.status.value, address=_address_to_json(order.address),
            total=order.total, installation_date=order.installation_date,
            created_at=order.created_at, updated_at=order.updated_at,
        )
        self._session.add(model)
        for item in order.items:
            item_model = OrderItemModel(
                id=item.id, order_id=order.id, design_id=item.design_id,
                design_name=item.design_name, design_image=item.design_image,
                size_key=item.size_key, color=item.color,
                quantity=item.quantity, unit_price=item.unit_price,
            )
            self._session.add(item_model)
        await self._session.flush()
        return order

    async def get_by_id(self, order_id: str) -> Order | None:
        # Phase 4B — eager-load `notes` so the detail mapper sees them
        # without lazy IO. Customer endpoints use the same method but
        # ignore the notes field (they're admin-only at the API layer).
        result = await self._session.execute(
            select(OrderModel)
            .options(
                selectinload(OrderModel.items),
                selectinload(OrderModel.notes),
            )
            .where(OrderModel.id == order_id)
        )
        row = result.scalar_one_or_none()
        return _order_to_domain(row) if row else None

    async def list_by_user(
        self, user_id: str, offset: int = 0, limit: int = 20,
    ) -> list[Order]:
        # Phase 4B — `_order_to_domain` iterates `m.notes` unconditionally;
        # without selectinload here the customer's order history endpoint
        # raises `MissingGreenlet` on the first row (lazy load forbidden in
        # async). `notes` is admin-internal data the customer never sees,
        # but loading it keeps the mapper a single code path.
        result = await self._session.execute(
            select(OrderModel)
            .options(
                selectinload(OrderModel.items),
                selectinload(OrderModel.notes),
            )
            .where(OrderModel.user_id == user_id)
            .order_by(desc(OrderModel.created_at))
            .offset(offset).limit(limit)
        )
        return [_order_to_domain(row) for row in result.scalars().all()]

    async def update(self, order: Order) -> Order:
        model = await self._session.get(OrderModel, order.id)
        if model:
            model.status = order.status.value
            model.address = _address_to_json(order.address)
            model.total = order.total
            model.installation_date = order.installation_date
            model.cancel_reason = order.cancel_reason
            model.updated_at = datetime.utcnow()
        await self._session.flush()
        return order

    async def add_note(self, order_id: str, note: OrderNote) -> OrderNote:
        # Phase 4B — append a single note without re-writing the parent
        # order row. Caller is responsible for having created the note
        # via `Order.add_note(...)` first; this just persists it.
        model = OrderNoteModel(
            id=note.id,
            order_id=order_id,
            author_id=note.author_id,
            text=note.text,
            created_at=note.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return note

    async def generate_order_number(self) -> str:
        from sqlalchemy import text
        result = await self._session.execute(text("SELECT nextval('order_number_seq')"))
        seq = result.scalar()
        return f"WOW-{seq:06d}"

    async def find_paginated(
        self, filters: OrderFilters, page: int = 1, size: int = 50,
    ) -> tuple[list[Order], int]:
        # Build the WHERE clause once, applied to both items and count
        # queries to keep them in sync.
        conditions = []
        if filters.status is not None:
            conditions.append(OrderModel.status == filters.status.value)
        if filters.user_id is not None:
            conditions.append(OrderModel.user_id == filters.user_id)
        if filters.date_from is not None:
            conditions.append(OrderModel.created_at >= filters.date_from)
        if filters.date_to is not None:
            conditions.append(OrderModel.created_at < filters.date_to)

        items_query = (
            select(OrderModel)
            # Phase 4B — selectinload(notes) is required because the mapper
            # iterates `m.notes` unconditionally; without it any row from
            # the admin list endpoint would trigger `MissingGreenlet` on
            # the first lazy-load attempt under AsyncSession.
            .options(
                selectinload(OrderModel.items),
                selectinload(OrderModel.notes),
            )
        )
        count_query = select(func.count()).select_from(OrderModel)

        # Search joins users so the admin can locate orders by either the
        # printed order number ("WOW-000123") or the customer's email/name.
        # Both queries must apply the same join+predicate; otherwise total
        # would count more rows than the items page returns.
        if filters.search is not None:
            pattern = f"%{filters.search.lower()}%"
            items_query = items_query.join(
                UserModel, UserModel.id == OrderModel.user_id, isouter=True
            )
            count_query = count_query.join(
                UserModel, UserModel.id == OrderModel.user_id, isouter=True
            )
            search_predicate = or_(
                func.lower(OrderModel.number).like(pattern),
                func.lower(UserModel.email).like(pattern),
                func.lower(UserModel.name).like(pattern),
            )
            conditions.append(search_predicate)

        for c in conditions:
            items_query = items_query.where(c)
            count_query = count_query.where(c)

        # Sort + paginate. `created_at DESC` matches the contract on
        # `OrderRepository.find_paginated`.
        offset = (page - 1) * size
        items_query = items_query.order_by(desc(OrderModel.created_at)).offset(offset).limit(size)

        items_result = await self._session.execute(items_query)
        rows = items_result.scalars().unique().all()
        count_result = await self._session.execute(count_query)
        total = int(count_result.scalar() or 0)
        return [_order_to_domain(row) for row in rows], total


class SqlSubscriptionRepository(SubscriptionRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_active_by_user(self, user_id: str) -> Subscription | None:
        result = await self._session.execute(
            select(SubscriptionModel)
            .where(
                SubscriptionModel.user_id == user_id,
                SubscriptionModel.status == "active",
            )
            .order_by(desc(SubscriptionModel.started_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return _subscription_to_domain(row) if row else None

    async def create(self, subscription: Subscription) -> Subscription:
        model = SubscriptionModel(
            id=subscription.id, user_id=subscription.user_id,
            plan_id=subscription.plan_id, status=subscription.status.value,
            area_used_this_month_m2=subscription.area_used_this_month_m2,
            started_at=subscription.started_at, expires_at=subscription.expires_at,
        )
        self._session.add(model)
        await self._session.flush()
        return subscription

    async def update(self, subscription: Subscription) -> Subscription:
        model = await self._session.get(SubscriptionModel, subscription.id)
        if model:
            model.status = subscription.status.value
            model.area_used_this_month_m2 = subscription.area_used_this_month_m2
        await self._session.flush()
        return subscription

    async def count_active_by_plan(self, plan_id: str) -> int:
        # Phase 8C — `DeleteSubscriptionPlanAdmin` cascade-guard.
        result = await self._session.execute(
            select(func.count())
            .select_from(SubscriptionModel)
            .where(
                SubscriptionModel.plan_id == plan_id,
                SubscriptionModel.status == "active",
            )
        )
        return int(result.scalar_one())


class SqlUserRepository(UserRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, user: User) -> User:
        model = UserModel(
            id=user.id, email=user.email, password_hash=user.password_hash,
            name=user.name, phone=user.phone, created_at=user.created_at,
            role=user.role.value,
            is_blocked=user.is_blocked,
        )
        self._session.add(model)
        for addr in user.addresses:
            addr_model = UserAddressModel(
                id=addr.id, user_id=user.id, label=addr.label, city=addr.city,
                street=addr.street, building=addr.building, apartment=addr.apartment,
                postal_code=addr.postal_code, is_default=addr.is_default,
            )
            self._session.add(addr_model)
        await self._session.flush()
        return user

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self._session.execute(
            select(UserModel)
            .options(selectinload(UserModel.addresses))
            .where(UserModel.id == user_id)
        )
        row = result.scalar_one_or_none()
        return _user_to_domain(row) if row else None

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel)
            .options(selectinload(UserModel.addresses))
            .where(UserModel.email == email)
        )
        row = result.scalar_one_or_none()
        return _user_to_domain(row) if row else None

    async def update(self, user: User) -> User:
        # Eager-load addresses so the `for old_addr in list(model.addresses)`
        # iteration below doesn't trigger a lazy SELECT under async (the
        # MissingGreenlet trap that bit us in Phase 4B with `notes`).
        result = await self._session.execute(
            select(UserModel)
            .options(selectinload(UserModel.addresses))
            .where(UserModel.id == user.id)
        )
        model = result.scalar_one_or_none()
        if model:
            model.name = user.name
            model.phone = user.phone
            model.email = user.email
            model.role = user.role.value
            model.is_blocked = user.is_blocked
            # Sync addresses: delete all, re-create
            for old_addr in list(model.addresses):
                await self._session.delete(old_addr)
            await self._session.flush()
            for addr in user.addresses:
                addr_model = UserAddressModel(
                    id=addr.id, user_id=user.id, label=addr.label, city=addr.city,
                    street=addr.street, building=addr.building, apartment=addr.apartment,
                    postal_code=addr.postal_code, is_default=addr.is_default,
                )
                self._session.add(addr_model)
        await self._session.flush()
        return user

    async def count_admins(self) -> int:
        # Compare against the enum value rather than a hardcoded literal so a
        # future rename of `UserRole.ADMIN.value` surfaces as a single-file
        # change instead of a silent query mismatch.
        result = await self._session.execute(
            select(func.count())
            .select_from(UserModel)
            .where(UserModel.role == UserRole.ADMIN.value)
        )
        return int(result.scalar_one())

    # ─── Phase 5 — admin user list ───────────────────────────────────

    async def count_active_admins(self) -> int:
        # `NOT is_blocked` mirrors the in-memory variant. A blocked admin
        # cannot log in, so functionally there's no admin presence; the
        # last-active-admin guard treats them the same as a CUSTOMER.
        result = await self._session.execute(
            select(func.count())
            .select_from(UserModel)
            .where(
                UserModel.role == UserRole.ADMIN.value,
                UserModel.is_blocked.is_(False),
            )
        )
        return int(result.scalar_one())

    async def find_paginated(
        self, filters: UserFilters, page: int = 1, size: int = 50,
    ) -> tuple[list[User], int]:
        # `selectinload(addresses)` matches `get_by_id` so the mapper's
        # iteration over `m.addresses` doesn't trigger lazy IO under
        # async (same MissingGreenlet trap as Phase 4B's order notes).
        query = select(UserModel).options(selectinload(UserModel.addresses))
        count_query = select(func.count()).select_from(UserModel)

        if filters.role is not None:
            query = query.where(UserModel.role == filters.role.value)
            count_query = count_query.where(UserModel.role == filters.role.value)
        if filters.is_blocked is not None:
            query = query.where(UserModel.is_blocked.is_(filters.is_blocked))
            count_query = count_query.where(UserModel.is_blocked.is_(filters.is_blocked))
        if filters.search is not None:
            pattern = f"%{filters.search.lower()}%"
            search_filter = or_(
                func.lower(UserModel.email).like(pattern),
                func.lower(UserModel.name).like(pattern),
                func.lower(UserModel.phone).like(pattern),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total = int((await self._session.execute(count_query)).scalar_one())

        offset = (page - 1) * size
        query = query.order_by(desc(UserModel.created_at)).offset(offset).limit(size)
        rows = (await self._session.execute(query)).scalars().all()
        return [_user_to_domain(r) for r in rows], total


# ─── Media (Phase 6) ─────────────────────────────────────────────────


def _media_to_domain(m: MediaAssetModel) -> MediaAsset:
    return MediaAsset(
        id=m.id,
        path=m.path,
        mime=m.mime,
        size_bytes=m.size_bytes,
        original_name=m.original_name or "",
        uploaded_by=m.uploaded_by,
        # Defensive: a `purpose` value that no longer maps to the enum
        # would surface as a `ValueError` here (loud failure) instead of
        # silently coercing to `MISC` — same posture as `UserRole(...)`
        # in `_user_to_domain`.
        purpose=MediaPurpose(m.purpose),
        uploaded_at=m.uploaded_at,
    )


class SqlMediaAssetRepository(MediaAssetRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, asset: MediaAsset) -> MediaAsset:
        model = MediaAssetModel(
            id=asset.id,
            path=asset.path,
            mime=asset.mime,
            size_bytes=asset.size_bytes,
            original_name=asset.original_name,
            uploaded_by=asset.uploaded_by,
            purpose=asset.purpose.value,
            uploaded_at=asset.uploaded_at,
        )
        self._session.add(model)
        # `flush` (not `commit`) — the request-scoped session
        # (`get_db_session`) commits on success. If anything downstream
        # raises, the row rolls back together with the rest of the unit
        # of work. This matches every other repo in this file.
        await self._session.flush()
        return asset

    async def get_by_id(self, asset_id: str) -> MediaAsset | None:
        result = await self._session.execute(
            select(MediaAssetModel).where(MediaAssetModel.id == asset_id)
        )
        row = result.scalar_one_or_none()
        return _media_to_domain(row) if row else None

    async def delete(self, asset_id: str) -> bool:
        result = await self._session.execute(
            select(MediaAssetModel).where(MediaAssetModel.id == asset_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True


# ─── Panels (Phase 7B) ──────────────────────────────────────────────


def _panel_to_domain(m: PanelModel) -> Panel:
    # Reconstruct the `PanelSize` VO from the three flat columns. Keeping
    # `width_mm`/`height_mm` separate from `size_label` (rather than e.g.
    # storing JSON) means SQL-level filtering by dimension is trivial if
    # we ever need it.
    size = PanelSize(
        width_mm=m.width_mm,
        height_mm=m.height_mm,
        label=m.size_label,
    )
    return Panel(
        id=m.id,
        name=m.name,
        slug=m.slug,
        size=size,
        base_price=m.base_price,
        description=m.description or "",
        photo_path=m.photo_path or "",
        is_active=m.is_active,
        created_at=m.created_at,
    )


class SqlPanelRepository(PanelRepository):
    """SQLAlchemy mirror of `InMemoryPanelRepository`.

    Slug-uniqueness is enforced at the DB level via the UNIQUE index
    declared in `PanelModel`. The use-case layer pre-checks for a
    friendlier 409 → `PanelSlugConflictError`; if a concurrent insert
    races past the pre-check, the IntegrityError surfaces as a 500 — same
    posture as the rest of the repos in this file.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_panels(
        self,
        *,
        include_inactive: bool = False,
        is_active: bool | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Panel], int]:
        query = select(PanelModel)
        count_query = select(func.count()).select_from(PanelModel)
        if not include_inactive:
            query = query.where(PanelModel.is_active.is_(True))
            count_query = count_query.where(PanelModel.is_active.is_(True))
        # Phase 7B remediation 2 (FE-B) — explicit `is_active`/`search`
        # filters. Both predicates are applied to BOTH the items query
        # and the count query so paginated `total` matches the visible
        # set (Phase 4A audit lesson — count must mirror filter).
        if is_active is not None:
            query = query.where(PanelModel.is_active.is_(is_active))
            count_query = count_query.where(PanelModel.is_active.is_(is_active))
        if search:
            # Escape SQL LIKE wildcards in the user input to avoid an
            # admin-supplied `%` matching unintended rows. Same
            # `\\` escape posture as `SqlDesignRepository.list_designs`
            # (color filter) — keeps the dialect quirk consistent.
            safe = search.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{safe}%"
            search_predicate = or_(
                func.lower(PanelModel.name).like(pattern, escape="\\"),
                func.lower(PanelModel.slug).like(pattern, escape="\\"),
            )
            query = query.where(search_predicate)
            count_query = count_query.where(search_predicate)
        total = int((await self._session.execute(count_query)).scalar_one())
        query = (
            query.order_by(desc(PanelModel.created_at))
            .offset(offset)
            .limit(limit)
        )
        rows = (await self._session.execute(query)).scalars().all()
        return [_panel_to_domain(r) for r in rows], total

    async def get_by_id(self, panel_id: str) -> Panel | None:
        result = await self._session.execute(
            select(PanelModel).where(PanelModel.id == panel_id)
        )
        row = result.scalar_one_or_none()
        return _panel_to_domain(row) if row else None

    async def get_by_slug(self, slug: str) -> Panel | None:
        result = await self._session.execute(
            select(PanelModel).where(PanelModel.slug == slug)
        )
        row = result.scalar_one_or_none()
        return _panel_to_domain(row) if row else None

    async def create(self, panel: Panel) -> Panel:
        model = PanelModel(
            id=panel.id,
            name=panel.name,
            slug=panel.slug,
            width_mm=panel.size.width_mm,
            height_mm=panel.size.height_mm,
            size_label=panel.size.label,
            base_price=panel.base_price,
            description=panel.description,
            photo_path=panel.photo_path,
            is_active=panel.is_active,
            created_at=panel.created_at,
        )
        self._session.add(model)
        # `flush` (not `commit`) — request-scoped session commits on
        # success; same UoW pattern as the other repos.
        await self._session.flush()
        return panel

    async def update(self, panel: Panel) -> Panel:
        result = await self._session.execute(
            select(PanelModel).where(PanelModel.id == panel.id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise LookupError(f"Panel {panel.id} not found")
        row.name = panel.name
        row.slug = panel.slug
        row.width_mm = panel.size.width_mm
        row.height_mm = panel.size.height_mm
        row.size_label = panel.size.label
        row.base_price = panel.base_price
        row.description = panel.description
        row.photo_path = panel.photo_path
        row.is_active = panel.is_active
        await self._session.flush()
        return panel

    async def delete(self, panel_id: str) -> bool:
        result = await self._session.execute(
            select(PanelModel).where(PanelModel.id == panel_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True


# ═══════════════════════════════════════════════════════════════════════
# Shop settings (Phase 8A)
# ═══════════════════════════════════════════════════════════════════════


def _shop_settings_to_domain(m: ShopSettingsModel) -> ShopSettings:
    return ShopSettings(
        id=m.id,
        design_overlay_price=m.design_overlay_price,
        installation_price=m.installation_price,
        min_order_amount=m.min_order_amount,
        recommendations_limit_per_source=m.recommendations_limit_per_source,
        updated_at=m.updated_at,
    )


class SqlShopSettingsRepository(ShopSettingsRepository):
    """SQLAlchemy mirror of `InMemoryShopSettingsRepository`.

    The singleton row is seeded by alembic migration `012`. If a deploy
    somehow has an empty `shop_settings` table (e.g., the migration was
    skipped), `get()` raises rather than synthesizing — silently
    inserting at runtime would mask a real configuration error.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(self) -> ShopSettings:
        result = await self._session.execute(
            select(ShopSettingsModel).where(
                ShopSettingsModel.id == SHOP_SETTINGS_SINGLETON_ID
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise RuntimeError(
                "shop_settings singleton row is missing — "
                "did migration 012_create_shop_settings run?"
            )
        return _shop_settings_to_domain(row)

    async def update(self, settings: ShopSettings) -> ShopSettings:
        result = await self._session.execute(
            select(ShopSettingsModel).where(
                ShopSettingsModel.id == settings.id
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise RuntimeError(
                f"shop_settings row {settings.id!r} missing on update"
            )
        row.design_overlay_price = settings.design_overlay_price
        row.installation_price = settings.installation_price
        row.min_order_amount = settings.min_order_amount
        row.recommendations_limit_per_source = settings.recommendations_limit_per_source
        row.updated_at = settings.updated_at
        await self._session.flush()
        return settings


# Banners (Phase 8B) — pending; see app/domain/shop/__init__.py.


# ═══════════════════════════════════════════════════════════════════════
# Audit log (Phase 9)
# ═══════════════════════════════════════════════════════════════════════


def _audit_entry_to_domain(m: AuditEntryModel) -> AuditEntry:
    return AuditEntry(
        id=m.id,
        actor_id=m.actor_id,
        # Storing as the literal string in DB; map back to enum here so
        # the domain stays typed. A row with an unknown action raises
        # `ValueError` rather than silently mis-categorising — better
        # to have one row in the read API explode than to corrupt an
        # incident investigation.
        action=AuditAction(m.action),
        target_type=AuditTargetType(m.target_type) if m.target_type else None,
        target_id=m.target_id,
        payload=m.payload or {},
        ip=m.ip,
        created_at=m.created_at,
    )


class SqlAuditEntryRepository(AuditEntryRepository):
    """SQLAlchemy mirror of `InMemoryAuditEntryRepository`.

    Append-only: only `append()` writes; `find_paginated()` reads with
    DESC sort by `created_at`. The composite indexes on
    `(actor_id, created_at)` and `(target_type, target_id, created_at)`
    are created in migration `013_create_audit_entries`.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def append(self, entry: AuditEntry) -> AuditEntry:
        model = AuditEntryModel(
            id=entry.id,
            actor_id=entry.actor_id,
            action=entry.action.value,
            target_type=entry.target_type.value if entry.target_type else None,
            target_id=entry.target_id,
            payload=entry.payload,
            ip=entry.ip,
            created_at=entry.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return entry

    async def find_paginated(
        self,
        filters: AuditFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[AuditEntry], int]:
        query = select(AuditEntryModel)
        count_query = select(func.count()).select_from(AuditEntryModel)

        if filters.action is not None:
            query = query.where(AuditEntryModel.action == filters.action.value)
            count_query = count_query.where(AuditEntryModel.action == filters.action.value)
        if filters.actor_id is not None:
            query = query.where(AuditEntryModel.actor_id == filters.actor_id)
            count_query = count_query.where(AuditEntryModel.actor_id == filters.actor_id)
        if filters.target_type is not None:
            query = query.where(AuditEntryModel.target_type == filters.target_type.value)
            count_query = count_query.where(AuditEntryModel.target_type == filters.target_type.value)
        if filters.target_id is not None:
            query = query.where(AuditEntryModel.target_id == filters.target_id)
            count_query = count_query.where(AuditEntryModel.target_id == filters.target_id)
        if filters.date_from is not None:
            query = query.where(AuditEntryModel.created_at >= filters.date_from)
            count_query = count_query.where(AuditEntryModel.created_at >= filters.date_from)
        if filters.date_to is not None:
            query = query.where(AuditEntryModel.created_at <= filters.date_to)
            count_query = count_query.where(AuditEntryModel.created_at <= filters.date_to)

        total = int((await self._session.execute(count_query)).scalar_one())
        query = (
            query.order_by(desc(AuditEntryModel.created_at))
            .offset(offset)
            .limit(limit)
        )
        rows = (await self._session.execute(query)).scalars().all()
        return [_audit_entry_to_domain(r) for r in rows], total


# ═══════════════════════════════════════════════════════════════════════
# Recommendations (Phase 10)
# ═══════════════════════════════════════════════════════════════════════


def _recommendation_to_domain(m: RecommendationModel) -> Recommendation:
    """Reconstruct the aggregate from the eager-loaded ORM rows.

    `targets` are already ordered by `position` thanks to the
    relationship's `order_by=` declaration; the list index in the
    domain object becomes the new authoritative position on the next
    save (no in-domain `position` field — see recommendation.py
    docstring on why).
    """
    return Recommendation(
        id=m.id,
        source_type=RecommendationSourceType(m.source_type),
        source_id=m.source_id,
        targets=[
            RecommendationTarget(
                target_type=RecommendationTargetType(t.target_type),
                target_id=t.target_id,
            )
            for t in m.targets
        ],
        updated_at=m.updated_at,
    )


class SqlRecommendationRepository(RecommendationRepository):
    """SQLAlchemy mirror of `InMemoryRecommendationRepository`.

    Uses `selectinload(targets)` on every read so the aggregate comes
    out of the session fully populated — the domain layer never lazy-
    loads. The natural-key UNIQUE constraint
    (`uq_recommendations_source`) is enforced at the DB level; the use
    case pre-checks for a friendlier 409 path, but a concurrent insert
    races into the constraint as the last line of defence.

    Saves are read-modify-write — `save()` either updates the existing
    parent + child rows (replacing the target set) or inserts both
    fresh. Replacing the target set instead of computing a diff keeps
    the code path identical to the aggregate's `replace_all` semantics
    and matches what the admin UI sends (the editor PUTs a full list).
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_by_source(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> Recommendation | None:
        result = await self._session.execute(
            select(RecommendationModel)
            .options(selectinload(RecommendationModel.targets))
            .where(
                RecommendationModel.source_type == source_type.value,
                RecommendationModel.source_id == source_id,
            )
        )
        row = result.scalar_one_or_none()
        return _recommendation_to_domain(row) if row else None

    async def save(self, recommendation: Recommendation) -> Recommendation:
        # Look up by natural key — `recommendation.id` may differ from
        # the persisted row's id when a use case constructs a fresh
        # aggregate over an existing source. The natural key is the
        # contract; the surrogate uuid is opaque.
        existing = (
            await self._session.execute(
                select(RecommendationModel)
                .options(selectinload(RecommendationModel.targets))
                .where(
                    RecommendationModel.source_type == recommendation.source_type.value,
                    RecommendationModel.source_id == recommendation.source_id,
                )
            )
        ).scalar_one_or_none()

        if existing is None:
            model = RecommendationModel(
                id=recommendation.id,
                source_type=recommendation.source_type.value,
                source_id=recommendation.source_id,
                updated_at=recommendation.updated_at,
            )
            for index, t in enumerate(recommendation.targets):
                model.targets.append(
                    RecommendationTargetModel(
                        target_type=t.target_type.value,
                        target_id=t.target_id,
                        position=index,
                    )
                )
            self._session.add(model)
            await self._session.flush()
            # Mirror the persisted id back into the returned aggregate
            # so the caller (the use case) can read it.
            return _recommendation_to_domain(model)

        # Update path — replace the target set wholesale. Clearing the
        # list relies on `cascade="all, delete-orphan"` to issue the
        # deletes; SQLAlchemy then tracks the freshly-appended rows.
        existing.updated_at = recommendation.updated_at
        existing.targets.clear()
        # Flush the deletes before re-inserting so the UNIQUE
        # `(recommendation_id, target_type, target_id)` constraint
        # doesn't trip on a same-key insert that would technically
        # collide with the row about to be deleted.
        await self._session.flush()
        for index, t in enumerate(recommendation.targets):
            existing.targets.append(
                RecommendationTargetModel(
                    target_type=t.target_type.value,
                    target_id=t.target_id,
                    position=index,
                )
            )
        await self._session.flush()
        return _recommendation_to_domain(existing)

    async def delete(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> bool:
        result = await self._session.execute(
            select(RecommendationModel).where(
                RecommendationModel.source_type == source_type.value,
                RecommendationModel.source_id == source_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False
        # `ON DELETE CASCADE` on the FK handles the child rows. We
        # still go through the ORM so the unit-of-work tracks the
        # change — a future caller in the same session sees the row
        # gone on a follow-up query.
        await self._session.delete(row)
        await self._session.flush()
        return True

    async def list_paginated(
        self,
        filters: RecommendationFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Recommendation], int]:
        query = (
            select(RecommendationModel)
            .options(selectinload(RecommendationModel.targets))
        )
        count_query = select(func.count()).select_from(RecommendationModel)

        if filters.source_type is not None:
            query = query.where(
                RecommendationModel.source_type == filters.source_type.value
            )
            count_query = count_query.where(
                RecommendationModel.source_type == filters.source_type.value
            )
        if filters.has_manual is not None:
            # `has_manual` filters by "at least one target row exists for
            # this aggregate". A correlated EXISTS keeps the parent-row
            # count accurate even when the same aggregate has many
            # targets (a JOIN would multiply rows pre-DISTINCT).
            sub = (
                select(RecommendationTargetModel.recommendation_id)
                .where(
                    RecommendationTargetModel.recommendation_id
                    == RecommendationModel.id
                )
                .exists()
            )
            if filters.has_manual:
                query = query.where(sub)
                count_query = count_query.where(sub)
            else:
                query = query.where(~sub)
                count_query = count_query.where(~sub)
        if filters.search:
            # Phase 10 LOW-6 + REC-N1 — case-insensitive substring on
            # source_id OR on any target_id (so an admin can find every
            # aggregate that recommends a given product). Spec-chars are
            # escaped with `\` so admin-supplied `%` / `_` aren't
            # interpreted as wildcards (same defence as panels.search).
            needle = (
                filters.search.lower()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            pattern = f"%{needle}%"
            source_predicate = func.lower(RecommendationModel.source_id).like(
                pattern, escape="\\",
            )
            target_match = (
                select(RecommendationTargetModel.recommendation_id)
                .where(
                    RecommendationTargetModel.recommendation_id
                    == RecommendationModel.id,
                    func.lower(RecommendationTargetModel.target_id).like(
                        pattern, escape="\\",
                    ),
                )
                .exists()
            )
            predicate = or_(source_predicate, target_match)
            query = query.where(predicate)
            count_query = count_query.where(predicate)

        total = int((await self._session.execute(count_query)).scalar_one())
        query = (
            query.order_by(desc(RecommendationModel.updated_at))
            .offset(offset)
            .limit(limit)
        )
        rows = (await self._session.execute(query)).scalars().all()
        return [_recommendation_to_domain(r) for r in rows], total

    async def find_by_target(
        self,
        target_type: RecommendationTargetType,
        target_id: str,
    ) -> list[Recommendation]:
        # Two-step: first find the parent ids whose target rows match
        # the (target_type, target_id), then load the parents with their
        # full target collections eagerly — the cleanup caller needs the
        # complete aggregate to call `remove_target` on it.
        parent_ids = (
            await self._session.execute(
                select(RecommendationTargetModel.recommendation_id)
                .where(
                    RecommendationTargetModel.target_type == target_type.value,
                    RecommendationTargetModel.target_id == target_id,
                )
            )
        ).scalars().all()
        if not parent_ids:
            return []
        rows = (
            await self._session.execute(
                select(RecommendationModel)
                .options(selectinload(RecommendationModel.targets))
                .where(RecommendationModel.id.in_(parent_ids))
            )
        ).scalars().all()
        return [_recommendation_to_domain(r) for r in rows]


# ═══════════════════════════════════════════════════════════════════════
# Banners (Phase 8B)
# ═══════════════════════════════════════════════════════════════════════


def _banner_to_domain(m: BannerModel) -> Banner:
    return Banner(
        id=m.id, title=m.title, subtitle=m.subtitle,
        image_path=m.image_path, cta_label=m.cta_label, cta_url=m.cta_url,
        position=BannerPosition(m.position),
        priority=m.priority, is_active=bool(m.is_active),
        created_at=m.created_at, updated_at=m.updated_at,
    )


class SqlBannerRepository(BannerRepository):
    """SQLAlchemy mirror of `InMemoryBannerRepository`."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_banners(self, *, position: BannerPosition | None = None, active_only: bool = False) -> list[Banner]:
        query = select(BannerModel)
        if position is not None:
            query = query.where(BannerModel.position == position.value)
        if active_only:
            query = query.where(BannerModel.is_active.is_(True))
        query = query.order_by(asc(BannerModel.priority), asc(BannerModel.created_at))
        rows = (await self._session.execute(query)).scalars().all()
        return [_banner_to_domain(r) for r in rows]

    async def get_by_id(self, banner_id: str) -> Banner | None:
        row = await self._session.get(BannerModel, banner_id)
        return _banner_to_domain(row) if row else None

    async def create(self, banner: Banner) -> Banner:
        model = BannerModel(
            id=banner.id, title=banner.title, subtitle=banner.subtitle,
            image_path=banner.image_path, cta_label=banner.cta_label,
            cta_url=banner.cta_url, position=banner.position.value,
            priority=banner.priority, is_active=banner.is_active,
            created_at=banner.created_at, updated_at=banner.updated_at,
        )
        self._session.add(model)
        await self._session.flush()
        return banner

    async def update(self, banner: Banner) -> Banner:
        row = await self._session.get(BannerModel, banner.id)
        if row is None:
            raise LookupError(f"Banner {banner.id} not found")
        row.title = banner.title
        row.subtitle = banner.subtitle
        row.image_path = banner.image_path
        row.cta_label = banner.cta_label
        row.cta_url = banner.cta_url
        row.position = banner.position.value
        row.priority = banner.priority
        row.is_active = banner.is_active
        row.updated_at = banner.updated_at
        await self._session.flush()
        return banner

    async def delete(self, banner_id: str) -> bool:
        row = await self._session.get(BannerModel, banner_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True


# ═══════════════════════════════════════════════════════════════════════
# Subscription plans (Phase 8C)
# ═══════════════════════════════════════════════════════════════════════


def _plan_to_domain(m: SubscriptionPlanModel) -> SubscriptionPlan:
    features = list(m.features) if isinstance(m.features, list) else []
    return SubscriptionPlan(
        id=m.id, name=m.name, price=m.price, period=m.period,
        area_limit_m2=m.area_limit_m2, popular=bool(m.popular),
        is_active=bool(m.is_active), sort_order=m.sort_order,
        features=features, created_at=m.created_at, updated_at=m.updated_at,
    )


class SqlSubscriptionPlanRepository(SubscriptionPlanRepository):
    """SQLAlchemy mirror of `InMemorySubscriptionPlanRepository`."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_plans(self, *, active_only: bool = False) -> list[SubscriptionPlan]:
        query = select(SubscriptionPlanModel)
        if active_only:
            query = query.where(SubscriptionPlanModel.is_active.is_(True))
        query = query.order_by(asc(SubscriptionPlanModel.sort_order))
        rows = (await self._session.execute(query)).scalars().all()
        return [_plan_to_domain(r) for r in rows]

    async def get_by_id(self, plan_id: str) -> SubscriptionPlan | None:
        row = await self._session.get(SubscriptionPlanModel, plan_id)
        return _plan_to_domain(row) if row else None

    async def create(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        model = SubscriptionPlanModel(
            id=plan.id, name=plan.name, price=plan.price, period=plan.period,
            area_limit_m2=plan.area_limit_m2, popular=plan.popular,
            is_active=plan.is_active, sort_order=plan.sort_order,
            features=list(plan.features),
            created_at=plan.created_at, updated_at=plan.updated_at,
        )
        self._session.add(model)
        await self._session.flush()
        return plan

    async def update(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        row = await self._session.get(SubscriptionPlanModel, plan.id)
        if row is None:
            raise LookupError(f"SubscriptionPlan {plan.id} not found")
        row.name = plan.name
        row.price = plan.price
        row.period = plan.period
        row.area_limit_m2 = plan.area_limit_m2
        row.popular = plan.popular
        row.is_active = plan.is_active
        row.sort_order = plan.sort_order
        row.features = list(plan.features)
        row.updated_at = plan.updated_at
        await self._session.flush()
        return plan

    async def delete(self, plan_id: str) -> bool:
        row = await self._session.get(SubscriptionPlanModel, plan_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
