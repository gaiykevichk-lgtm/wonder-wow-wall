"""Analytics repositories — in-memory + SQL.

These live in their own module (not appended to `memory.py`/`sql.py`) to
keep each file manageable; existing repos follow the same "one domain per
repo-module" pattern (`project_repo.py`, `visualization_repo.py`).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from collections import Counter, defaultdict
from typing import Callable  # noqa: F401  # used in forward-reference string

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.analytics.repositories import AnalyticsRepository
from app.domain.analytics.value_objects import (
    AbandonedCart,
    CityBucket,
    DateRange,
    FunnelStage,
    MetricSeries,
    OrderAttention,
    RegistrationsCompare,
    SeriesPoint,
    SizeBucket,
    StatusBucket,
    SubscriptionPlanBucket,
    SubscriptionsSummary,
    ToolUsage,
    TopDesign,
)
from app.domain.order.entities import Order  # noqa: F401  # used in forward-reference string
from app.domain.order.value_objects import OrderStatus
from app.domain.subscription.entities import (  # noqa: F401  # used in forward-reference string
    Subscription,
    SubscriptionPlan,
)
from app.domain.subscription.value_objects import SubscriptionStatus
from app.domain.user.entities import User  # noqa: F401  # used in forward-reference string
from app.domain.visualizer.entities import (  # noqa: F401  # used in forward-reference string
    VisualizationProject,
)
from app.infrastructure.persistence.models import (
    OrderModel,
    OrderItemModel,
    ProjectModel,
    SubscriptionModel,
    UserModel,
    VisualizationProjectModel,
)


# ─── Hardcoded SLAs for the "needs attention" widget ────────────────────
# Hours after which an order in the given status is considered "stuck".
# Lives in the repo (not the domain) because this is a UI/operations
# concern, not a transactional invariant — admin tweaks are allowed
# without a migration. Values are deliberately conservative; the dashboard
# is a hint, not a hard alerting system.
_ATTENTION_SLA_HOURS: dict[str, int] = {
    OrderStatus.PLACED.value:      24,
    OrderStatus.CONFIRMED.value:   72,
    OrderStatus.IN_PROGRESS.value: 168,
}


# Plain-RU human reasons matched to the SLAs above. Kept next to the SLA
# table so the two stay in sync.
_ATTENTION_REASON: dict[str, str] = {
    OrderStatus.PLACED.value:      "Не подтверждён > 24ч",
    OrderStatus.CONFIRMED.value:   "Не в работе > 3 дней",
    OrderStatus.IN_PROGRESS.value: "В работе > 7 дней",
}


# Fallback plan-name lookup for the in-memory repo when subscription_plans
# repo isn't injected. SqlAnalyticsRepository joins the `subscriptions`
# table to the `subscription_plans` table directly.
_FALLBACK_PLAN_NAMES: dict[str, str] = {
    "starter":  "Стартовый",
    "popular":  "Популярный",
    "business": "Бизнес",
}
_FALLBACK_PLAN_PRICES: dict[str, int] = {
    "starter":  7000,
    "popular":  12000,
    "business": 18000,
}

# Two `size_key` conventions live in the codebase:
#   * `PanelSize.key`  emits the long form (mm) — `"300x300"`.
#   * `OrderItem.size_key` and the constructor/visualizer use the short
#     human-readable form — `"30x30"`.
# The dashboard groups by whatever is on the order item; we translate
# both forms to the same human label so the widget shows "30×30 см"
# regardless of which writer produced the row.
_SIZE_KEY_LABELS: dict[str, str] = {
    "30x30":   "30×30 см",
    "30x60":   "30×60 см",
    "60x30":   "60×30 см",
    "60x60":   "60×60 см",
    "300x300": "30×30 см",
    "300x600": "30×60 см",
    "600x300": "60×30 см",
    "600x600": "60×60 см",
}

# Stable order for the dashboard bar chart — short form first because
# it's the one users see in the UI elsewhere.
_SIZE_KEY_ORDER: tuple[str, ...] = (
    "30x30", "30x60", "60x30", "60x60",
    "300x300", "300x600", "600x300", "600x600",
)


def _size_label(size_key: str) -> str:
    return _SIZE_KEY_LABELS.get(size_key, size_key)


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

    Phase 11 — accepts optional sources for subscriptions, constructor
    projects, visualization projects and subscription plans. They default
    to empty so existing tests that only pass orders/users keep working;
    the widgets that rely on them simply return zero/empty rows.
    """

    def __init__(
        self,
        *,
        orders: "Callable[[], list[Order]]",
        users: "Callable[[], list[User]]",
        subscriptions: "Callable[[], list[Subscription]] | None" = None,
        constructor_projects: "Callable[[], list[dict]] | None" = None,
        visualizations: "Callable[[], list[VisualizationProject]] | None" = None,
        plans: "Callable[[], list[SubscriptionPlan]] | None" = None,
    ) -> None:
        self._orders_fn = orders
        self._users_fn = users
        self._subscriptions_fn = subscriptions or (lambda: [])
        self._constructor_projects_fn = constructor_projects or (lambda: [])
        self._visualizations_fn = visualizations or (lambda: [])
        self._plans_fn = plans or (lambda: [])

    @property
    def _orders(self) -> list[Order]:
        return self._orders_fn()

    @property
    def _users(self) -> list[User]:
        return self._users_fn()

    @property
    def _subscriptions(self) -> list:
        return self._subscriptions_fn()

    @property
    def _constructor_projects(self) -> list:
        return self._constructor_projects_fn()

    @property
    def _visualizations(self) -> list:
        return self._visualizations_fn()

    @property
    def _plans(self) -> list:
        return self._plans_fn()

    def _orders_in(self, rng: DateRange) -> list[Order]:
        return [o for o in self._orders if rng.contains(o.created_at)]

    def _user_lookup(self) -> dict[str, "User"]:
        # Built once per call (each widget is one method call) so we don't
        # rebuild it for every order. ~O(users) memory, negligible at MVP.
        return {u.id: u for u in self._users}

    def _resolve_plan(self, plan_id: str) -> tuple[str, int]:
        """Return (plan_name, monthly_price ₽) for a `plan_id`.

        Prefers the live SubscriptionPlanRepository (admin-editable Phase
        8C), falls back to the hardcoded constants for legacy/test rigs
        that don't inject the plans source.
        """
        for p in self._plans:
            if p.id == plan_id:
                return p.name, p.price
        return (
            _FALLBACK_PLAN_NAMES.get(plan_id, plan_id),
            _FALLBACK_PLAN_PRICES.get(plan_id, 0),
        )

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

    # ─── Phase 11 widgets ──────────────────────────────────────────────

    async def subscriptions_summary(self, rng: DateRange) -> SubscriptionsSummary:
        subs = list(self._subscriptions)
        active = [s for s in subs if s.status == SubscriptionStatus.ACTIVE]

        # MRR is sum of plan prices for currently-active subs. If a plan
        # was retired (admin removed it) we fall back to a 0 contribution
        # rather than crashing — keeps the dashboard robust.
        mrr = sum(self._resolve_plan(s.plan_id)[1] for s in active)

        # Churn = subs cancelled within `rng` divided by (active at start
        # of range + cancelled within range), expressed as %. The "started"
        # baseline is approximated by `current_active + churned` because we
        # don't snapshot history; this slightly underestimates churn vs a
        # true cohort-based definition, but matches what the SQL repo can
        # cheaply compute too.
        cancelled_in = [
            s for s in subs
            if s.status == SubscriptionStatus.CANCELLED
            # Subscriptions don't carry an updated_at; fall back to
            # `started_at` containment for a coarse "happened recently"
            # signal. Good enough for the MVP widget; refine when the
            # Subscription aggregate gets explicit lifecycle timestamps.
            and rng.contains(s.started_at + timedelta(days=1))
        ]
        denom = len(active) + len(cancelled_in)
        churn_pct = (len(cancelled_in) / denom * 100.0) if denom else 0.0

        new_in_period = sum(1 for s in subs if rng.contains(s.started_at))

        # Per-plan breakdown — emit a row per known plan even if zero
        # active so the chart legend stays stable across tabs.
        active_by_plan: Counter[str] = Counter(s.plan_id for s in active)
        plans = list(self._plans)
        if not plans:
            # Synthesise stable plan order from the fallback dict so the
            # widget renders Стартовый/Популярный/Бизнес left-to-right.
            plan_ids = ["starter", "popular", "business"]
        else:
            plan_ids = [p.id for p in sorted(plans, key=lambda p: p.sort_order)]

        by_plan = tuple(
            SubscriptionPlanBucket(
                plan_id=pid,
                plan_name=self._resolve_plan(pid)[0],
                monthly_price=self._resolve_plan(pid)[1],
                active_count=active_by_plan.get(pid, 0),
            )
            for pid in plan_ids
        )

        return SubscriptionsSummary(
            active_count=len(active),
            mrr=mrr,
            churn_pct=round(churn_pct, 1),
            new_in_period=new_in_period,
            by_plan=by_plan,
        )

    async def order_funnel(self, rng: DateRange) -> list[FunnelStage]:
        orders_in = self._orders_in(rng)

        # Funnel direction: every order at status X has also been through
        # all earlier stages. So "delivered" includes installed too.
        # Cancelled/refunded short-circuit the funnel and are excluded.
        active_orders = [
            o for o in orders_in
            if o.status not in (OrderStatus.CANCELLED, OrderStatus.REFUNDED)
        ]
        seq = [
            (OrderStatus.PLACED.value,      "Оформлен"),
            (OrderStatus.CONFIRMED.value,   "Подтверждён"),
            (OrderStatus.IN_PROGRESS.value, "В работе"),
            (OrderStatus.DELIVERED.value,   "Доставлен"),
            (OrderStatus.INSTALLED.value,   "Установлен"),
        ]
        # Index in `seq` an order has reached.
        order_position: dict[str, int] = {st: i for i, (st, _) in enumerate(seq)}

        cumulative: list[int] = [0] * len(seq)
        for o in active_orders:
            pos = order_position.get(o.status.value)
            if pos is None:
                continue
            for i in range(pos + 1):
                cumulative[i] += 1

        top = cumulative[0] or 0
        return [
            FunnelStage(
                key=key,
                label=label,
                count=cumulative[i],
                conversion_pct=(
                    None if i == 0
                    else round(cumulative[i] / top * 100.0, 1) if top else 0.0
                ),
            )
            for i, (key, label) in enumerate(seq)
        ]

    async def abandoned_carts(
        self, rng: DateRange, *, limit: int = 10
    ) -> list[AbandonedCart]:
        users_by_id = self._user_lookup()
        # Set of user_ids who placed an order inside the window. These
        # users' projects are NOT abandoned; they converted.
        converted = {o.user_id for o in self._orders_in(rng)}

        rows: list[AbandonedCart] = []
        for proj in self._constructor_projects:
            total = int(proj.get("total_price", 0) or 0)
            if total <= 0:
                continue
            uid = proj.get("user_id", "")
            if uid in converted:
                continue
            user = users_by_id.get(uid)
            updated = proj.get("updated_at") or proj.get("created_at") or ""
            # `updated_at` is stored as ISO string; rng.contains needs a
            # date/datetime. Parse defensively, skip on failure.
            try:
                ts = datetime.fromisoformat(str(updated))
            except ValueError:
                continue
            if not rng.contains(ts):
                continue
            rows.append(AbandonedCart(
                project_id=str(proj.get("id", "")),
                user_id=uid,
                user_email=user.email if user else "",
                user_name=user.name if user else "",
                project_name=str(proj.get("name", "")),
                total_price=total,
                panels_count=len(proj.get("panels", []) or []),
                last_activity=ts.isoformat(),
            ))
        rows.sort(key=lambda r: r.last_activity, reverse=True)
        return rows[:limit]

    async def orders_needing_attention(
        self, *, limit: int = 10
    ) -> list[OrderAttention]:
        users_by_id = self._user_lookup()
        now = datetime.utcnow()

        flagged: list[OrderAttention] = []
        for o in self._orders:
            sla = _ATTENTION_SLA_HOURS.get(o.status.value)
            if sla is None:
                continue
            age_hours = int((now - o.created_at).total_seconds() // 3600)
            if age_hours <= sla:
                continue
            user = users_by_id.get(o.user_id)
            flagged.append(OrderAttention(
                order_id=o.id,
                order_number=o.number,
                status=o.status.value,
                age_hours=age_hours,
                total=o.total,
                user_id=o.user_id,
                user_email=user.email if user else "",
                user_name=user.name if user else "",
                reason=_ATTENTION_REASON.get(o.status.value, "Требует внимания"),
            ))
        # Oldest-first — worst offenders go on top.
        flagged.sort(key=lambda r: r.age_hours, reverse=True)
        return flagged[:limit]

    async def tool_usage(self, rng: DateRange) -> ToolUsage:
        # Constructor projects — `created_at` stored as ISO string.
        constructor_users: set[str] = set()
        constructor_count = 0
        for p in self._constructor_projects:
            try:
                ts = datetime.fromisoformat(str(p.get("created_at", "")))
            except ValueError:
                continue
            if rng.contains(ts):
                constructor_count += 1
                if uid := p.get("user_id"):
                    constructor_users.add(uid)

        # Visualizer projects — entity, `created_at` is a real datetime.
        visualizer_users: set[str] = set()
        visualizer_count = 0
        for v in self._visualizations:
            if rng.contains(v.created_at):
                visualizer_count += 1
                if v.user_id:
                    visualizer_users.add(v.user_id)

        engaged = constructor_users | visualizer_users
        # Conversion: of the engaged users, how many placed an order in
        # the same window? (Stricter than "ever ordered" — keeps the
        # metric range-relative.)
        order_users_in = {o.user_id for o in self._orders_in(rng)}
        converted = engaged & order_users_in
        engaged_n = len(engaged)
        conv = (len(converted) / engaged_n * 100.0) if engaged_n else 0.0

        return ToolUsage(
            constructor_sessions=constructor_count,
            visualizer_projects=visualizer_count,
            engaged_users=engaged_n,
            converted_users=len(converted),
            conversion_pct=round(conv, 1),
        )

    async def panel_size_breakdown(self, rng: DateRange) -> list[SizeBucket]:
        # `size_key` on OrderItem follows either the catalog VO convention
        # (`300x300`) or the short human form (`30x30`). `_size_label`
        # normalises both to a unified RU label.
        items_counter: Counter[str] = Counter()
        revenue_by_size: dict[str, int] = defaultdict(int)
        for o in self._orders_in(rng):
            count_for_revenue = o.status.value in _REVENUE_STATUSES
            for it in o.items:
                if not it.size_key:
                    continue
                items_counter[it.size_key] += it.quantity
                if count_for_revenue:
                    revenue_by_size[it.size_key] += it.subtotal

        # Stable order: prefer the canonical short→long ordering from
        # `_SIZE_KEY_ORDER`, then any unrecognised sizes sorted
        # alphabetically (defensive — an unknown size_key still renders).
        order = (
            [k for k in _SIZE_KEY_ORDER if k in items_counter]
            + sorted(set(items_counter) - set(_SIZE_KEY_ORDER))
        )
        return [
            SizeBucket(
                size_key=k,
                size_label=_size_label(k),
                items_count=items_counter[k],
                revenue=revenue_by_size.get(k, 0),
            )
            for k in order
        ]

    async def top_cities(
        self, rng: DateRange, *, limit: int = 5
    ) -> list[CityBucket]:
        counts: Counter[str] = Counter()
        revenue: dict[str, int] = defaultdict(int)
        for o in self._orders_in(rng):
            city = (o.address.city or "").strip() or "Не указан"
            counts[city] += 1
            if o.status.value in _REVENUE_STATUSES:
                revenue[city] += o.total
        # Sort primarily by revenue desc; orders_count is the tiebreaker
        # so cities with equal-zero revenue still land in a stable order.
        rows = [
            CityBucket(city=c, orders_count=counts[c], revenue=revenue.get(c, 0))
            for c in counts
        ]
        rows.sort(key=lambda r: (-r.revenue, -r.orders_count, r.city))
        return rows[:limit]

    async def registrations_vs_orders(
        self, rng: DateRange
    ) -> RegistrationsCompare:
        users_buckets: dict[date, int] = defaultdict(int)
        for u in self._users:
            if rng.contains(u.created_at):
                users_buckets[u.created_at.date()] += 1
        orders_buckets: dict[date, int] = defaultdict(int)
        for o in self._orders_in(rng):
            orders_buckets[o.created_at.date()] += 1
        return RegistrationsCompare(
            new_users=MetricSeries(
                key="new_users_compare",
                label="Регистрации",
                points=_fill_gaps(rng, users_buckets),
            ),
            new_orders=MetricSeries(
                key="new_orders_compare",
                label="Заказы",
                points=_fill_gaps(rng, orders_buckets),
            ),
            total_users=sum(users_buckets.values()),
            total_orders=sum(orders_buckets.values()),
        )


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

    # ─── Phase 11 widgets (SQL) ────────────────────────────────────────

    async def subscriptions_summary(self, rng: DateRange) -> SubscriptionsSummary:
        from app.infrastructure.persistence.models import SubscriptionPlanModel
        # Per-plan active count + plan name + price in one round-trip.
        stmt = (
            select(
                SubscriptionPlanModel.id,
                SubscriptionPlanModel.name,
                SubscriptionPlanModel.price,
                SubscriptionPlanModel.sort_order,
                func.coalesce(
                    func.sum(
                        case(
                            (SubscriptionModel.status == "active", 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("active_count"),
            )
            .select_from(SubscriptionPlanModel)
            .outerjoin(
                SubscriptionModel,
                SubscriptionModel.plan_id == SubscriptionPlanModel.id,
            )
            .group_by(
                SubscriptionPlanModel.id,
                SubscriptionPlanModel.name,
                SubscriptionPlanModel.price,
                SubscriptionPlanModel.sort_order,
            )
            .order_by(SubscriptionPlanModel.sort_order)
        )
        rows = (await self._session.execute(stmt)).all()
        by_plan = tuple(
            SubscriptionPlanBucket(
                plan_id=r.id,
                plan_name=r.name,
                monthly_price=int(r.price),
                active_count=int(r.active_count),
            )
            for r in rows
        )
        active_count = sum(b.active_count for b in by_plan)
        mrr = sum(b.active_count * b.monthly_price for b in by_plan)

        new_in_stmt = (
            select(func.count())
            .select_from(SubscriptionModel)
            .where(self._range_filter(SubscriptionModel.started_at, rng))
        )
        new_in_period = int(
            (await self._session.execute(new_in_stmt)).scalar_one() or 0
        )

        churn_stmt = (
            select(func.count())
            .select_from(SubscriptionModel)
            .where(SubscriptionModel.status == "cancelled")
            .where(self._range_filter(SubscriptionModel.started_at, rng))
        )
        cancelled_in = int(
            (await self._session.execute(churn_stmt)).scalar_one() or 0
        )
        denom = active_count + cancelled_in
        churn_pct = (cancelled_in / denom * 100.0) if denom else 0.0

        return SubscriptionsSummary(
            active_count=active_count,
            mrr=mrr,
            churn_pct=round(churn_pct, 1),
            new_in_period=new_in_period,
            by_plan=by_plan,
        )

    async def order_funnel(self, rng: DateRange) -> list[FunnelStage]:
        # Group by status; expand into a cumulative funnel in Python.
        # The funnel direction is monotonic (status order = enum order),
        # so we COUNT(*) per status and accumulate descending — cheaper
        # than a window query and works on SQLite.
        stmt = (
            select(OrderModel.status, func.count().label("c"))
            .where(self._range_filter(OrderModel.created_at, rng))
            .where(OrderModel.status.notin_([
                OrderStatus.CANCELLED.value,
                OrderStatus.REFUNDED.value,
            ]))
            .group_by(OrderModel.status)
        )
        per_status = {
            r.status: int(r.c)
            for r in (await self._session.execute(stmt)).all()
        }
        seq = [
            (OrderStatus.PLACED.value,      "Оформлен"),
            (OrderStatus.CONFIRMED.value,   "Подтверждён"),
            (OrderStatus.IN_PROGRESS.value, "В работе"),
            (OrderStatus.DELIVERED.value,   "Доставлен"),
            (OrderStatus.INSTALLED.value,   "Установлен"),
        ]
        # Cumulative from right-to-left: orders at "installed" also count
        # for "delivered", "in_progress", "confirmed", "placed".
        cumulative: list[int] = []
        running = 0
        for key, _ in reversed(seq):
            running += per_status.get(key, 0)
            cumulative.append(running)
        cumulative.reverse()
        top = cumulative[0] or 0
        return [
            FunnelStage(
                key=key,
                label=label,
                count=cumulative[i],
                conversion_pct=(
                    None if i == 0
                    else round(cumulative[i] / top * 100.0, 1) if top else 0.0
                ),
            )
            for i, (key, label) in enumerate(seq)
        ]

    async def abandoned_carts(
        self, rng: DateRange, *, limit: int = 10
    ) -> list[AbandonedCart]:
        # Subquery: user_ids who placed an order in the range. Excluded
        # from the abandoned list because they converted.
        converted_ids = (
            select(OrderModel.user_id)
            .where(self._range_filter(OrderModel.created_at, rng))
            .distinct()
        )
        stmt = (
            select(
                ProjectModel.id,
                ProjectModel.user_id,
                ProjectModel.name,
                ProjectModel.total_price,
                ProjectModel.panels,
                ProjectModel.updated_at,
                UserModel.email,
                UserModel.name.label("user_name"),
            )
            .join(UserModel, UserModel.id == ProjectModel.user_id)
            .where(ProjectModel.total_price > 0)
            .where(self._range_filter(ProjectModel.updated_at, rng))
            .where(ProjectModel.user_id.notin_(converted_ids))
            .order_by(ProjectModel.updated_at.desc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            AbandonedCart(
                project_id=r.id,
                user_id=r.user_id,
                user_email=r.email or "",
                user_name=r.user_name or "",
                project_name=r.name or "",
                total_price=int(r.total_price or 0),
                panels_count=len(r.panels or []),
                last_activity=r.updated_at.isoformat() if r.updated_at else "",
            )
            for r in rows
        ]

    async def orders_needing_attention(
        self, *, limit: int = 10
    ) -> list[OrderAttention]:
        now = datetime.utcnow()
        # Build a per-status cutoff filter — orders older than the SLA
        # land in the result. ORs keep it a single query per status.
        clauses = []
        for status, hours in _ATTENTION_SLA_HOURS.items():
            cutoff = now - timedelta(hours=hours)
            clauses.append(
                (OrderModel.status == status) & (OrderModel.created_at < cutoff)
            )
        if not clauses:
            return []
        from sqlalchemy import or_
        stmt = (
            select(
                OrderModel.id,
                OrderModel.number,
                OrderModel.status,
                OrderModel.total,
                OrderModel.created_at,
                OrderModel.user_id,
                UserModel.email,
                UserModel.name.label("user_name"),
            )
            .join(UserModel, UserModel.id == OrderModel.user_id, isouter=True)
            .where(or_(*clauses))
            .order_by(OrderModel.created_at.asc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            OrderAttention(
                order_id=r.id,
                order_number=r.number,
                status=r.status,
                age_hours=int((now - r.created_at).total_seconds() // 3600),
                total=int(r.total or 0),
                user_id=r.user_id,
                user_email=r.email or "",
                user_name=r.user_name or "",
                reason=_ATTENTION_REASON.get(r.status, "Требует внимания"),
            )
            for r in rows
        ]

    async def tool_usage(self, rng: DateRange) -> ToolUsage:
        # Counts + distinct-user sets per tool, computed server-side.
        # Two parallel queries per tool: total count (cheap) + distinct
        # user ids (we need them to compute the engaged∩ordered intersection).
        ctor_count_stmt = (
            select(func.count())
            .select_from(ProjectModel)
            .where(self._range_filter(ProjectModel.created_at, rng))
        )
        ctor_count = int(
            (await self._session.execute(ctor_count_stmt)).scalar_one() or 0
        )
        ctor_users_stmt = (
            select(ProjectModel.user_id)
            .where(self._range_filter(ProjectModel.created_at, rng))
            .distinct()
        )
        ctor_users = {
            r[0] for r in (await self._session.execute(ctor_users_stmt)).all()
        }

        viz_count_stmt = (
            select(func.count())
            .select_from(VisualizationProjectModel)
            .where(self._range_filter(VisualizationProjectModel.created_at, rng))
        )
        viz_count = int(
            (await self._session.execute(viz_count_stmt)).scalar_one() or 0
        )
        viz_users_stmt = (
            select(VisualizationProjectModel.user_id)
            .where(self._range_filter(VisualizationProjectModel.created_at, rng))
            .distinct()
        )
        viz_users = {
            r[0] for r in (await self._session.execute(viz_users_stmt)).all()
        }

        engaged = ctor_users | viz_users
        if not engaged:
            return ToolUsage(
                constructor_sessions=ctor_count,
                visualizer_projects=viz_count,
                engaged_users=0,
                converted_users=0,
                conversion_pct=0.0,
            )

        order_users_stmt = (
            select(OrderModel.user_id)
            .where(self._range_filter(OrderModel.created_at, rng))
            .where(OrderModel.user_id.in_(engaged))
            .distinct()
        )
        ordered = {
            r[0] for r in (await self._session.execute(order_users_stmt)).all()
        }
        converted = engaged & ordered
        return ToolUsage(
            constructor_sessions=ctor_count,
            visualizer_projects=viz_count,
            engaged_users=len(engaged),
            converted_users=len(converted),
            conversion_pct=round(len(converted) / len(engaged) * 100.0, 1),
        )

    async def panel_size_breakdown(self, rng: DateRange) -> list[SizeBucket]:
        stmt = (
            select(
                OrderItemModel.size_key,
                func.coalesce(func.sum(OrderItemModel.quantity), 0).label("items"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                OrderModel.status.in_(_REVENUE_STATUSES),
                                OrderItemModel.unit_price * OrderItemModel.quantity,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("rev"),
            )
            .join(OrderModel, OrderModel.id == OrderItemModel.order_id)
            .where(self._range_filter(OrderModel.created_at, rng))
            .where(OrderItemModel.size_key != "")
            .group_by(OrderItemModel.size_key)
        )
        rows = (await self._session.execute(stmt)).all()
        items_counter: dict[str, int] = {r.size_key: int(r.items) for r in rows}
        revenue_by_size: dict[str, int] = {r.size_key: int(r.rev) for r in rows}

        order = (
            [k for k in _SIZE_KEY_ORDER if k in items_counter]
            + sorted(set(items_counter) - set(_SIZE_KEY_ORDER))
        )
        return [
            SizeBucket(
                size_key=k,
                size_label=_size_label(k),
                items_count=items_counter[k],
                revenue=revenue_by_size.get(k, 0),
            )
            for k in order
        ]

    async def top_cities(
        self, rng: DateRange, *, limit: int = 5
    ) -> list[CityBucket]:
        # Order.address is a Text column with serialised JSON. Cheapest
        # path that works on both SQLite (test rig) and Postgres: select
        # the raw rows and group in Python. Volume is bounded by the
        # date window so this is fine.
        import json
        stmt = (
            select(
                OrderModel.address,
                OrderModel.total,
                OrderModel.status,
            )
            .where(self._range_filter(OrderModel.created_at, rng))
        )
        rows = (await self._session.execute(stmt)).all()
        counts: Counter[str] = Counter()
        revenue: dict[str, int] = defaultdict(int)
        for r in rows:
            city = "Не указан"
            if r.address:
                try:
                    city = (json.loads(r.address) or {}).get("city") or city
                except (ValueError, TypeError):
                    pass
            city = city.strip() or "Не указан"
            counts[city] += 1
            if r.status in _REVENUE_STATUSES:
                revenue[city] += int(r.total or 0)
        result = [
            CityBucket(city=c, orders_count=counts[c], revenue=revenue.get(c, 0))
            for c in counts
        ]
        result.sort(key=lambda r: (-r.revenue, -r.orders_count, r.city))
        return result[:limit]

    async def registrations_vs_orders(
        self, rng: DateRange
    ) -> RegistrationsCompare:
        u_day = func.date(UserModel.created_at).label("day")
        u_stmt = (
            select(u_day, func.count().label("c"))
            .where(self._range_filter(UserModel.created_at, rng))
            .group_by(u_day)
        )
        u_rows = (await self._session.execute(u_stmt)).all()
        users_buckets: dict[date, int] = {}
        for row in u_rows:
            d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
            users_buckets[d] = int(row.c or 0)

        o_day = func.date(OrderModel.created_at).label("day")
        o_stmt = (
            select(o_day, func.count().label("c"))
            .where(self._range_filter(OrderModel.created_at, rng))
            .group_by(o_day)
        )
        o_rows = (await self._session.execute(o_stmt)).all()
        orders_buckets: dict[date, int] = {}
        for row in o_rows:
            d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
            orders_buckets[d] = int(row.c or 0)

        return RegistrationsCompare(
            new_users=MetricSeries(
                key="new_users_compare",
                label="Регистрации",
                points=_fill_gaps(rng, users_buckets),
            ),
            new_orders=MetricSeries(
                key="new_orders_compare",
                label="Заказы",
                points=_fill_gaps(rng, orders_buckets),
            ),
            total_users=sum(users_buckets.values()),
            total_orders=sum(orders_buckets.values()),
        )
