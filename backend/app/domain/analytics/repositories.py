"""Analytics repository interface.

A single "fat" repo (instead of one-method-per-use-case slivers) because:
  * every dashboard call needs all five projections,
  * batching them under one adapter lets the SQL impl reuse a session
    and amortise overhead,
  * there is exactly one client (`GetDashboardSnapshot`), so YAGNI on
    splitting by read-type.

Phase 11 expansion (8 new widgets) keeps the same fat-repo shape: every
new widget is one extra abstract method. The use case orchestrates them
all under a single dashboard snapshot call so the API stays a single
network round-trip.
"""

from abc import ABC, abstractmethod

from .value_objects import (
    AbandonedCart,
    CityBucket,
    DateRange,
    FunnelStage,
    MetricSeries,
    OrderAttention,
    RegistrationsCompare,
    SizeBucket,
    StatusBucket,
    SubscriptionsSummary,
    TopDesign,
    ToolUsage,
)


class AnalyticsRepository(ABC):
    @abstractmethod
    async def revenue_by_day(self, rng: DateRange) -> MetricSeries:
        """Daily paid-order revenue in kopecks (integer).

        Implementations MUST return a point for every day in `rng`, even
        zero days — otherwise the frontend would have to re-implement
        gap-filling for a clean chart. This is a contract the tests pin.
        """

    @abstractmethod
    async def orders_by_status(self, rng: DateRange) -> list[StatusBucket]:
        """One bucket per status observed in the range (skip empty)."""

    @abstractmethod
    async def new_users_by_day(self, rng: DateRange) -> MetricSeries:
        """Registrations per day, same gap-filling contract."""

    @abstractmethod
    async def top_designs(self, rng: DateRange, *, limit: int = 5) -> list[TopDesign]:
        """Most-ordered designs in the range, desc by `orders_count`."""

    @abstractmethod
    async def totals(self, rng: DateRange) -> dict[str, int]:
        """Coarse scalars for the 4 metric cards.

        Keys (stable contract — the application layer wraps these in
        `Metric` VOs):
          * `revenue`         — total revenue in kopecks
          * `orders`          — count of orders created in the window
          * `new_users`       — count of new registrations in the window
          * `avg_order_value` — revenue / orders, rounded (0 if no orders)
        """

    # ─── Phase 11 widgets ──────────────────────────────────────────────

    @abstractmethod
    async def subscriptions_summary(self, rng: DateRange) -> SubscriptionsSummary:
        """Active subscribers, MRR, churn% and per-plan breakdown.

        `active_count` is point-in-time (not date-bounded — it answers
        "how many subscribers right now?"). `churn_pct` and `new_in_period`
        ARE date-bounded by `rng`.
        """

    @abstractmethod
    async def order_funnel(self, rng: DateRange) -> list[FunnelStage]:
        """Cumulative-by-status funnel for orders created in the range.

        Returned in funnel order (placed → confirmed → in_progress →
        delivered → installed). The first stage's count is the divisor for
        every other stage's `conversion_pct`. Cancelled/refunded orders
        are excluded from all stages.
        """

    @abstractmethod
    async def abandoned_carts(
        self, rng: DateRange, *, limit: int = 10
    ) -> list[AbandonedCart]:
        """Top engaged-but-unconverted users (proxy via constructor projects).

        A "cart" is a saved constructor project with `total_price > 0`
        whose owner has no order created inside `rng`. Sorted desc by
        `last_activity` so the freshest abandons surface first.
        """

    @abstractmethod
    async def orders_needing_attention(
        self, *, limit: int = 10
    ) -> list[OrderAttention]:
        """Open orders whose age exceeds the SLA for the current status.

        Not date-bounded — operations want to see the whole stuck queue.
        SLA per status (admin can tune later, hardcoded for now):
          * placed       > 24h
          * confirmed    > 72h
          * in_progress  > 168h (7 days)
        Sorted oldest-first (worst offenders on top).
        """

    @abstractmethod
    async def tool_usage(self, rng: DateRange) -> ToolUsage:
        """Constructor + visualizer engagement and conversion within range."""

    @abstractmethod
    async def panel_size_breakdown(self, rng: DateRange) -> list[SizeBucket]:
        """Per-size totals across order items in the range."""

    @abstractmethod
    async def top_cities(
        self, rng: DateRange, *, limit: int = 5
    ) -> list[CityBucket]:
        """Order-address city aggregation, sorted desc by revenue."""

    @abstractmethod
    async def registrations_vs_orders(
        self, rng: DateRange
    ) -> RegistrationsCompare:
        """Daily new-users + daily new-orders parallel series."""
