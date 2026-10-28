"""GetDashboardSnapshot — the only admin-dashboard use case.

Orchestrates the five `AnalyticsRepository` reads and wraps the scalar
totals into `Metric` VOs with human-readable labels and units. Keeping
the label/unit mapping here (application layer) — not in the repo —
lets us i18n the dashboard later without touching infrastructure.

Phase 11 — extended with 8 widget projections (subscriptions, funnel,
abandoned carts, orders needing attention, tool usage, panel-size
breakdown, geography, registrations vs orders). Each widget is a single
optional field on `DashboardDTO`; the use case fans out to the repo
sequentially. The dashboard is cached server-side for 60s
(`infrastructure/api/admin/dashboard.py`) so the per-call cost is
amortised across all clients hitting the endpoint within a minute.
"""

from dataclasses import dataclass

from app.domain.analytics.repositories import AnalyticsRepository
from app.domain.analytics.value_objects import (
    AbandonedCart,
    CityBucket,
    DateRange,
    FunnelStage,
    Metric,
    MetricSeries,
    OrderAttention,
    RegistrationsCompare,
    SizeBucket,
    StatusBucket,
    SubscriptionsSummary,
    ToolUsage,
    TopDesign,
)


@dataclass(frozen=True)
class DashboardDTO:
    range_start: str  # ISO date
    range_end: str    # ISO date (exclusive)
    metrics: list[Metric]
    revenue_series: MetricSeries
    new_users_series: MetricSeries
    orders_by_status: list[StatusBucket]
    top_designs: list[TopDesign]
    # ─── Phase 11 widgets ──────────────────────────────────────────────
    subscriptions: SubscriptionsSummary | None = None
    funnel: list[FunnelStage] | None = None
    abandoned_carts: list[AbandonedCart] | None = None
    orders_attention: list[OrderAttention] | None = None
    tool_usage: ToolUsage | None = None
    size_breakdown: list[SizeBucket] | None = None
    top_cities: list[CityBucket] | None = None
    registrations_compare: RegistrationsCompare | None = None


class GetDashboardSnapshot:
    """Single use case for Phase 3. No side effects — read-only projection."""

    # Stable labels so the API response shape is locked down by tests and
    # consumer code. Moving labels here (not inside each impl) guarantees
    # every repo surfaces the same card order on the dashboard.
    _LABELS: dict[str, tuple[str, str]] = {
        "revenue":         ("Выручка",         "₽"),
        "orders":          ("Заказы",          ""),
        "new_users":       ("Новые клиенты",   ""),
        "avg_order_value": ("Средний чек",     "₽"),
    }

    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    async def execute(self, rng: DateRange, *, top_limit: int = 5) -> DashboardDTO:
        totals = await self._repo.totals(rng)
        revenue_series = await self._repo.revenue_by_day(rng)
        new_users_series = await self._repo.new_users_by_day(rng)
        status_buckets = await self._repo.orders_by_status(rng)
        top = await self._repo.top_designs(rng, limit=top_limit)

        # Phase 11 — widget projections. Each fan-out is independent so a
        # failure in one widget would mask the rest; we let exceptions
        # bubble up to the cache layer (`utils.cache.cached`) which
        # surfaces them as 5xx — matches the existing dashboard
        # behaviour for any one of the original projections.
        subscriptions = await self._repo.subscriptions_summary(rng)
        funnel = await self._repo.order_funnel(rng)
        abandoned = await self._repo.abandoned_carts(rng, limit=10)
        attention = await self._repo.orders_needing_attention(limit=10)
        tools = await self._repo.tool_usage(rng)
        sizes = await self._repo.panel_size_breakdown(rng)
        cities = await self._repo.top_cities(rng, limit=5)
        regs_vs_orders = await self._repo.registrations_vs_orders(rng)

        metrics = [
            Metric(
                key=k,
                label=self._LABELS[k][0],
                value=totals.get(k, 0),
                unit=self._LABELS[k][1],
            )
            # Explicit order — revenue first, avg_order_value last — not
            # `dict.items()` on `totals`, because the repo contract does
            # not guarantee key order and the dashboard layout does.
            for k in ("revenue", "orders", "new_users", "avg_order_value")
        ]

        return DashboardDTO(
            range_start=rng.start.isoformat(),
            range_end=rng.end.isoformat(),
            metrics=metrics,
            revenue_series=revenue_series,
            new_users_series=new_users_series,
            orders_by_status=status_buckets,
            top_designs=top,
            subscriptions=subscriptions,
            funnel=funnel,
            abandoned_carts=abandoned,
            orders_attention=attention,
            tool_usage=tools,
            size_breakdown=sizes,
            top_cities=cities,
            registrations_compare=regs_vs_orders,
        )
