"""SQL repository implementations — SQLAlchemy async, mapped to domain entities."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.repositories import DesignRepository, CategoryRepository, ReviewRepository
from app.domain.catalog.value_objects import Color
from app.domain.order.entities import Order, OrderItem
from app.domain.order.repositories import OrderRepository
from app.domain.order.value_objects import OrderStatus, Address
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.subscription.value_objects import SubscriptionStatus
from app.domain.user.entities import User, UserAddress
from app.domain.user.repositories import UserRepository

from app.infrastructure.persistence.models import (
    DesignModel,
    CategoryModel,
    DesignReviewModel,
    OrderModel,
    OrderItemModel,
    SubscriptionModel,
    UserModel,
    UserAddressModel,
    ProjectModel,
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
        is_new=m.is_new, is_popular=m.is_popular, created_at=m.created_at,
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
    # Parse address from stored text (city|street|building|apartment|postal)
    parts = (m.address or "").split("|")
    address = Address(
        city=parts[0] if len(parts) > 0 else "",
        street=parts[1] if len(parts) > 1 else "",
        building=parts[2] if len(parts) > 2 else "",
        apartment=parts[3] if len(parts) > 3 else "",
        postal_code=parts[4] if len(parts) > 4 else "",
    )
    return Order(
        id=m.id, number=m.number, user_id=m.user_id,
        status=OrderStatus(m.status), items=items, address=address,
        created_at=m.created_at, updated_at=m.updated_at,
    )


def _address_to_text(a: Address) -> str:
    return f"{a.city}|{a.street}|{a.building}|{a.apartment}|{a.postal_code}"


def _subscription_to_domain(m: SubscriptionModel) -> Subscription:
    return Subscription(
        id=m.id, user_id=m.user_id, plan_id=m.plan_id,
        status=SubscriptionStatus(m.status),
        overlays_used_this_month=m.overlays_used_this_month,
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
    return User(
        id=m.id, email=m.email, password_hash=m.password_hash,
        name=m.name, phone=m.phone, addresses=addresses, created_at=m.created_at,
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
        # Update reviews_count on design
        design = await self._session.get(DesignModel, review.design_id)
        if design:
            design.reviews_count = (design.reviews_count or 0) + 1
        return review


class SqlOrderRepository(OrderRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, order: Order) -> Order:
        model = OrderModel(
            id=order.id, number=order.number, user_id=order.user_id,
            status=order.status.value, address=_address_to_text(order.address),
            total=order.total, created_at=order.created_at, updated_at=order.updated_at,
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
        result = await self._session.execute(
            select(OrderModel)
            .options(selectinload(OrderModel.items))
            .where(OrderModel.id == order_id)
        )
        row = result.scalar_one_or_none()
        return _order_to_domain(row) if row else None

    async def list_by_user(
        self, user_id: str, offset: int = 0, limit: int = 20,
    ) -> list[Order]:
        result = await self._session.execute(
            select(OrderModel)
            .options(selectinload(OrderModel.items))
            .where(OrderModel.user_id == user_id)
            .order_by(desc(OrderModel.created_at))
            .offset(offset).limit(limit)
        )
        return [_order_to_domain(row) for row in result.scalars().all()]

    async def update(self, order: Order) -> Order:
        model = await self._session.get(OrderModel, order.id)
        if model:
            model.status = order.status.value
            model.address = _address_to_text(order.address)
            model.total = order.total
            model.updated_at = datetime.utcnow()
        await self._session.flush()
        return order

    async def generate_order_number(self) -> str:
        result = await self._session.execute(select(func.count()).select_from(OrderModel))
        count = (result.scalar() or 0) + 1
        return f"WOW-{count:06d}"


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
            overlays_used_this_month=subscription.overlays_used_this_month,
            started_at=subscription.started_at, expires_at=subscription.expires_at,
        )
        self._session.add(model)
        await self._session.flush()
        return subscription

    async def update(self, subscription: Subscription) -> Subscription:
        model = await self._session.get(SubscriptionModel, subscription.id)
        if model:
            model.status = subscription.status.value
            model.overlays_used_this_month = subscription.overlays_used_this_month
        await self._session.flush()
        return subscription


class SqlUserRepository(UserRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, user: User) -> User:
        model = UserModel(
            id=user.id, email=user.email, password_hash=user.password_hash,
            name=user.name, phone=user.phone, created_at=user.created_at,
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
        model = await self._session.get(UserModel, user.id)
        if model:
            model.name = user.name
            model.phone = user.phone
            model.email = user.email
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
