"""In-memory repository implementations for development and testing.

These will be replaced by SQLAlchemy implementations when connected to PostgreSQL.
"""

from datetime import datetime
from typing import Callable
from uuid import uuid4

from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.repositories import DesignRepository, CategoryRepository, ReviewRepository
from app.domain.order.entities import Order, OrderNote
from app.domain.order.filters import OrderFilters
from app.domain.order.repositories import OrderRepository
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.user.entities import User
from app.domain.user.filters import UserFilters
from app.domain.user.repositories import UserRepository
from app.domain.user.value_objects import UserRole


# ─── Catalog ─────────────────────────────────────────────────────────

class InMemoryDesignRepository(DesignRepository):
    def __init__(self, designs: list[Design] | None = None):
        self._designs: list[Design] = designs or []

    async def list_designs(
        self, category_id=None, search=None, sort_by="name", offset=0, limit=20,
        *, color=None, style=None, is_new=None,
    ):
        result = list(self._designs)
        if category_id:
            result = [d for d in result if d.category_id == category_id]
        if search:
            q = search.lower()
            result = [d for d in result if q in d.name.lower() or q in d.description.lower()]
        if color:
            color_lower = color.lower()
            result = [d for d in result if any(c.name.lower() == color_lower for c in d.colors)]
        if style:
            style_lower = style.lower()
            result = [d for d in result if d.style.lower() == style_lower]
        if is_new is not None:
            result = [d for d in result if d.is_new == is_new]
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

    async def update(self, design):
        self._designs = [d if d.id != design.id else design for d in self._designs]
        return design


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
    def __init__(self, users_source: Callable[[], list[User]] | None = None):
        self._orders: list[Order] = []
        self._counter = 0
        # Optional callback returning the live user list. Used ONLY by
        # `find_paginated` when the admin searches by email/name — the
        # SQL repo achieves the same via a JOIN. Keeping it optional means
        # existing constructions (`InMemoryOrderRepository()`) keep working
        # and customer-facing methods stay free of user-repo coupling.
        self._users_source = users_source

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

    async def add_note(self, order_id: str, note: OrderNote) -> OrderNote:
        # In-memory variant: locate the parent and append to its `notes`
        # list. SQL repo persists into a separate table; semantics are
        # equivalent — the next `get_by_id` returns the order with the
        # new note attached.
        parent = next((o for o in self._orders if o.id == order_id), None)
        if parent is None:
            raise ValueError(f"Order {order_id} not found")
        # `Order.add_note` already populated the parent's notes list when
        # the use case called it; the SQL repo needs an explicit insert.
        # Avoid duplicating the entry if it's already there.
        if not any(n.id == note.id for n in parent.notes):
            parent.notes.append(note)
        return note

    async def generate_order_number(self):
        self._counter += 1
        return f"WW-{datetime.utcnow().year}-{self._counter:03d}"

    async def find_paginated(self, filters: OrderFilters, page: int = 1, size: int = 50):
        result = list(self._orders)
        if filters.status is not None:
            result = [o for o in result if o.status == filters.status]
        if filters.user_id is not None:
            result = [o for o in result if o.user_id == filters.user_id]
        if filters.date_from is not None:
            result = [o for o in result if o.created_at >= filters.date_from]
        if filters.date_to is not None:
            result = [o for o in result if o.created_at < filters.date_to]
        if filters.search is not None:
            q = filters.search.lower()
            matching_user_ids: set[str] = set()
            if self._users_source is not None:
                for u in self._users_source():
                    if q in u.email.lower() or q in u.name.lower():
                        matching_user_ids.add(u.id)
            result = [
                o for o in result
                if q in o.number.lower() or o.user_id in matching_user_ids
            ]
        # Stable newest-first ordering — the SQL repo uses the same
        # `ORDER BY created_at DESC`. Equality of `created_at` falls back
        # to insertion order via Python's stable sort, which is fine for
        # tests since fakes typically use distinct timestamps.
        result.sort(key=lambda o: o.created_at, reverse=True)
        total = len(result)
        offset = (page - 1) * size
        return result[offset:offset + size], total


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

    async def count_admins(self):
        return sum(1 for u in self._users if u.role == UserRole.ADMIN)

    # ─── Phase 5 — admin user list ───────────────────────────────────

    async def count_active_admins(self):
        # `is_blocked` defaults to False on legacy seeded users so the
        # count stays accurate even before the migration runs in tests.
        return sum(
            1 for u in self._users
            if u.role == UserRole.ADMIN and not u.is_blocked
        )

    async def find_paginated(self, filters: UserFilters, page: int = 1, size: int = 50):
        result = list(self._users)
        if filters.role is not None:
            result = [u for u in result if u.role == filters.role]
        if filters.is_blocked is not None:
            result = [u for u in result if u.is_blocked == filters.is_blocked]
        if filters.search is not None:
            q = filters.search.lower()
            result = [
                u for u in result
                if q in u.email.lower()
                or q in u.name.lower()
                or q in (u.phone or "").lower()
            ]
        # Newest-first — matches orders. Stable sort preserves insertion
        # order for ties (test fixtures usually use distinct timestamps).
        result.sort(key=lambda u: u.created_at, reverse=True)
        total = len(result)
        offset = (page - 1) * size
        return result[offset:offset + size], total
