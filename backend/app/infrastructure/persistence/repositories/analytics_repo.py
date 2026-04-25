"""Analytics repositories — in-memory + SQL.

These live in their own module (not appended to `memory.py`/`sql.py`) to
keep each file manageable; existing repos follow the same "one domain per
repo-module" pattern (`project_repo.py`, `visualization_repo.py`).
"""

from __future__ import annotations

from datetime import date, datetime
from collections import Counter, defaultdict
from typing import Callable  # noqa: F401  # used in forward-reference string

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.analytics.repositories import AnalyticsRepository
from app.domain.analytics.value_objects import (
    DateRange,
    MetricSeries,
    SeriesPoint,
    StatusBucket,
    TopDesign,
)
from app.domain.order.entities import Order  # noqa: F401  # used in forward-reference string
from app.domain.order.value_objects import OrderStatus
from app.domain.user.entities import User  # noqa: F401  # used in forward-reference string
from app.infrastructure.persistence.models import (
    OrderModel,
    OrderItemModel,
    UserModel,
)


# ─── helpers ─────────────────────────────────────────────────────────

# Statuses that count toward "revenue" — everything past CONFIRMED.
# Explicit set (not "all except PLACED") so future statuses default to
# NOT-counting until someone reviews them.
_REVENUE_STATUSES: frozenset[str] = frozenset({
    OrderStatus.CONFIRMED.value,
    OrderStatus.IN_PROGRESS.value,
    OrderStatus.DELIVERED.value,
    OrderStatus.INSTALLED.value,
})


def _fill_gaps(rng: DateRange, observed: dict[date, int | float]) -> tuple[SeriesPoint, ...]:
    """Materialise one point per day in the range, zero-filling missing days."""
    return tuple(
        SeriesPoint(day=d, value=observed.get(d, 0)) for d in rng.iter_days()
    )


# ─── in-memory implementation ─────────────────────────────────────────

class InMemoryAnalyticsRepository(AnalyticsRepository):
    """Read-only projection over the in-memory order + user repos.

    Takes CALLABLES returning the current lists rather than the lists
    themselves — both `InMemoryOrderRepository.update()` and
    `InMemoryUserRepository.update()` REASSIGN their internal list, so a
    stored reference goes stale. Lazy accessors dodge that.
    """

    def __init__(
        self,
        *,
        orders: "Callable[[], list[Order]]",
        users: "Callable[[], list[User]]",
    ) -> None:
        self._orders_fn = orders
        self._users_fn = users

    @property
    def _orders(self) -> list[Order]:
        return self._orders_fn()

    @property
    def _users(self) -> list[User]:
        return self._users_fn()

    def _orders_in(self, rng: DateRange) -> list[Order]:
        return [o for o in self._orders if rng.contains(o.created_at)]

    async def revenue_by_day(self, rng: DateRange) -> MetricSeries:
        buckets: dict[date, int] = defaultdict(int)
        for o in self._orders_in(rng):
            if o.status.value in _REVENUE_STATUSES:
                buckets[o.created_at.date()] += o.total
        return MetricSeries(
            key="revenue_by_day",
            label="Выручка по дням",
            points=_fill_gaps(rng, buckets),
        )

    async def orders_by_status(self, rng: DateRange) -> list[StatusBucket]:
        counts = Counter(o.status.value for o in self._orders_in(rng))
        # Stable order: follow OrderStatus enum declaration.
        return [
            StatusBucket(status=s.value, count=counts[s.value])
            for s in OrderStatus
            if counts.get(s.value, 0) > 0
        ]

    async def new_users_by_day(self, rng: DateRange) -> MetricSeries:
        buckets: dict[date, int] = defaultdict(int)
        for u in self._users:
            if rng.contains(u.created_at):
                buckets[u.created_at.date()] += 1
        return MetricSeries(
            key="new_users_by_day",
            label="Новые клиенты",
            points=_fill_gaps(rng, buckets),
        )

    async def top_designs(self, rng: DateRange, *, limit: int = 5) -> list[TopDesign]:
        # Count by design_id across all items in the window.
        counts: Counter[str] = Counter()
        names: dict[str, str] = {}
        for o in self._orders_in(rng):
            for it in o.items:
                if not it.design_id:
                    continue
                counts[it.design_id] += it.quantity
                # Last-seen name wins — fine, names rarely change.
                names[it.design_id] = it.design_name or names.get(it.design_id, "")
        return [
            TopDesign(design_id=did, design_name=names.get(did, ""), orders_count=cnt)
            for did, cnt in counts.most_common(limit)
        ]

    async def totals(self, rng: DateRange) -> dict[str, int]:
        orders_in = self._orders_in(rng)
        revenue = sum(
            o.total for o in orders_in
            if o.status.value in _REVENUE_STATUSES
        )
        orders_count = len(orders_in)
        new_users = sum(1 for u in self._users if rng.contains(u.created_at))
        avg = int(revenue / orders_count) if orders_count else 0
        return {
            "revenue": revenue,
            "orders": orders_count,
            "new_users": new_users,
            "avg_order_value": avg,
        }


# ─── SQL implementation ───────────────────────────────────────────────

class SqlAnalyticsRepository(AnalyticsRepository):
    """SQLAlchemy async implementation. One query per projection.

    All queries filter on `created_at >= start AND created_at < end`
    (half-open, matches `DateRange` semantics) and lean on the existing
    `created_at` index. No N+1: top_designs uses a single GROUP BY join.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _range_filter(self, col, rng: DateRange):
        start = datetime.combine(rng.start, datetime.min.time())
        end = datetime.combine(rng.end, datetime.min.time())
        return (col >= start) & (col < end)

    async def revenue_by_day(self, rng: DateRange) -> MetricSeries:
        day_col = func.date(OrderModel.created_at).label("day")
        stmt = (
            select(day_col, func.sum(OrderModel.total).label("rev"))
            .where(self._range_filter(OrderModel.created_at, rng))
            .where(OrderModel.status.in_(_REVENUE_STATUSES))
            .group_by(day_col)
        )
        rows = (await self._session.execute(stmt)).all()
        observed: dict[date, int] = {}
        for row in rows:
            d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
            observed[d] = int(row.rev or 0)
        return MetricSeries(
            key="revenue_by_day",
            label="Выручка по дням",
            points=_fill_gaps(rng, observed),
        )

    async def orders_by_status(self, rng: DateRange) -> list[StatusBucket]:
        stmt = (
            select(OrderModel.status, func.count().label("c"))
            .where(self._range_filter(OrderModel.created_at, rng))
            .group_by(OrderModel.status)
        )
        rows = {r.status: int(r.c) for r in (await self._session.execute(stmt)).all()}
        return [
            StatusBucket(status=s.value, count=rows[s.value])
            for s in OrderStatus
            if rows.get(s.value, 0) > 0
        ]

    async def new_users_by_day(self, rng: DateRange) -> MetricSeries:
        day_col = func.date(UserModel.created_at).label("day")
        stmt = (
            select(day_col, func.count().label("c"))
            .where(self._range_filter(UserModel.created_at, rng))
            .group_by(day_col)
        )
        rows = (await self._session.execute(stmt)).all()
        observed: dict[date, int] = {}
        for row in rows:
            d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
            observed[d] = int(row.c or 0)
        return MetricSeries(
            key="new_users_by_day",
            label="Новые клиенты",
            points=_fill_gaps(rng, observed),
        )

    async def top_designs(self, rng: DateRange, *, limit: int = 5) -> list[TopDesign]:
        stmt = (
            select(
                OrderItemModel.design_id,
                func.max(OrderItemModel.design_name).label("name"),
                func.sum(OrderItemModel.quantity).label("cnt"),
            )
            .join(OrderModel, OrderItemModel.order_id == OrderModel.id)
            .where(self._range_filter(OrderModel.created_at, rng))
            .where(OrderItemModel.design_id != "")
            .group_by(OrderItemModel.design_id)
            .order_by(func.sum(OrderItemModel.quantity).desc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            TopDesign(
                design_id=r.design_id,
                design_name=r.name or "",
                orders_count=int(r.cnt or 0),
            )
            for r in rows
        ]

    async def totals(self, rng: DateRange) -> dict[str, int]:
        # Single orders query for count + conditional revenue (CASE works
        # in both SQLite and Postgres, unlike `iif()`), single users query.
        orders_stmt = (
            select(
                func.count().label("c"),
                func.coalesce(
                    func.sum(
                        case(
                            (OrderModel.status.in_(_REVENUE_STATUSES), OrderModel.total),
                            else_=0,
                        )
                    ),
                    0,
                ).label("rev"),
            )
            .where(self._range_filter(OrderModel.created_at, rng))
        )
        o_row = (await self._session.execute(orders_stmt)).one()
        orders_count = int(o_row.c)
        revenue = int(o_row.rev)

        users_stmt = (
            select(func.count())
            .select_from(UserModel)
            .where(self._range_filter(UserModel.created_at, rng))
        )
        new_users = int((await self._session.execute(users_stmt)).scalar_one() or 0)

        avg = int(revenue / orders_count) if orders_count else 0
        return {
            "revenue": revenue,
            "orders": orders_count,
            "new_users": new_users,
            "avg_order_value": avg,
        }
