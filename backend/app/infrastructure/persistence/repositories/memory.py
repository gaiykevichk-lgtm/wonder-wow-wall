"""In-memory repository implementations for development and testing.

These will be replaced by SQLAlchemy implementations when connected to PostgreSQL.
"""

from datetime import datetime
from uuid import uuid4

from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.repositories import DesignRepository, CategoryRepository, ReviewRepository
from app.domain.order.entities import Order
from app.domain.order.repositories import OrderRepository
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.user.entities import User
from app.domain.user.repositories import UserRepository


# ─── Catalog ─────────────────────────────────────────────────────────

class InMemoryDesignRepository(DesignRepository):
    def __init__(self, designs: list[Design] | None = None):
        self._designs: list[Design] = designs or []

    async def list_designs(
        self, category_id=None, search=None, sort_by="name", offset=0, limit=20,
    ):
        result = list(self._designs)
        if category_id:
            result = [d for d in result if d.category_id == category_id]
        if search:
            q = search.lower()
            result = [d for d in result if q in d.name.lower() or q in d.description.lower()]
        if sort_by == "price":
            result.sort(key=lambda d: d.price)
        elif sort_by == "rating":
            result.sort(key=lambda d: d.rating, reverse=True)
        else:
            result.sort(key=lambda d: d.name)
        total = len(result)
        return result[offset:offset + limit], total

    async def get_by_id(self, design_id):
        return next((d for d in self._designs if d.id == design_id), None)

    async def get_by_slug(self, slug):
        return next((d for d in self._designs if d.slug == slug), None)


class InMemoryCategoryRepository(CategoryRepository):
    def __init__(self, categories: list[Category] | None = None):
        self._categories: list[Category] = categories or []

    async def list_all(self):
        return list(self._categories)

    async def get_by_id(self, category_id):
        return next((c for c in self._categories if c.id == category_id), None)


class InMemoryReviewRepository(ReviewRepository):
    def __init__(self):
        self._reviews: list[DesignReview] = []

    async def list_by_design(self, design_id, offset=0, limit=20):
        result = [r for r in self._reviews if r.design_id == design_id]
        result.sort(key=lambda r: r.created_at, reverse=True)
        return result[offset:offset + limit]

    async def add(self, review):
        self._reviews.append(review)
        return review


# ─── Order ───────────────────────────────────────────────────────────

class InMemoryOrderRepository(OrderRepository):
    def __init__(self):
        self._orders: list[Order] = []
        self._counter = 0

    async def create(self, order):
        self._orders.append(order)
        return order

    async def get_by_id(self, order_id):
        return next((o for o in self._orders if o.id == order_id), None)

    async def list_by_user(self, user_id, offset=0, limit=20):
        result = [o for o in self._orders if o.user_id == user_id]
        result.sort(key=lambda o: o.created_at, reverse=True)
        return result[offset:offset + limit]

    async def update(self, order):
        self._orders = [o if o.id != order.id else order for o in self._orders]
        return order

    async def generate_order_number(self):
        self._counter += 1
        return f"WW-{datetime.utcnow().year}-{self._counter:03d}"


# ─── Subscription ────────────────────────────────────────────────────

class InMemorySubscriptionRepository(SubscriptionRepository):
    def __init__(self):
        self._subs: list[Subscription] = []

    async def get_active_by_user(self, user_id):
        return next(
            (s for s in self._subs if s.user_id == user_id and s.status.value == "active"),
            None,
        )

    async def create(self, subscription):
        self._subs.append(subscription)
        return subscription

    async def update(self, subscription):
        self._subs = [s if s.id != subscription.id else subscription for s in self._subs]
        return subscription


# ─── User ────────────────────────────────────────────────────────────

class InMemoryUserRepository(UserRepository):
    def __init__(self):
        self._users: list[User] = []

    async def create(self, user):
        self._users.append(user)
        return user

    async def get_by_id(self, user_id):
        return next((u for u in self._users if u.id == user_id), None)

    async def get_by_email(self, email):
        return next((u for u in self._users if u.email == email), None)

    async def update(self, user):
        self._users = [u if u.id != user.id else user for u in self._users]
        return user
