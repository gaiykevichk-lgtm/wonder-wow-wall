"""Analytics — read-only bounded context. Phase 3.

Contains ONLY value objects; this context has no entities and no aggregates
because it never mutates domain state — it reads existing aggregates
(orders, users, designs) and projects them into metrics for the admin
dashboard.

Why a separate bounded context at all, if there's no state?
    The projection logic (how we bucket orders into days, how we compute
    a funnel, what "active user" means) is non-trivial and belongs
    somewhere stable. Putting it next to `OrderRepository` would bleed
    dashboard concerns into the transactional order domain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta


class InvalidDateRangeError(ValueError):
    """Raised for empty or inverted date ranges.

    Kept as a subclass of `ValueError` so the HTTP layer can map it to
    400 without a dedicated handler (FastAPI's default).
    """


@dataclass(frozen=True)
class DateRange:
    """Inclusive start, exclusive end (`start <= d < end`).

    Using half-open intervals keeps `SUM(days)` = `(end - start).days`
    across the codebase and avoids fencepost bugs when chaining windows.
    A 7-day "last week" range anchored on `today` is built via
    `DateRange.last_n_days(7)`, which yields `[today - 6d, today + 1d)`
    so today's events fall inside the window.
    """

    start: date
    end: date

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise InvalidDateRangeError(
                f"DateRange end must be strictly after start; got {self.start}..{self.end}",
            )

    @property
    def days(self) -> int:
        return (self.end - self.start).days

    def contains(self, when: datetime | date) -> bool:
        d = when.date() if isinstance(when, datetime) else when
        return self.start <= d < self.end

    def iter_days(self):
        """Yield every date in the range, start-inclusive end-exclusive."""
        cur = self.start
        while cur < self.end:
            yield cur
            cur = cur + timedelta(days=1)

    @classmethod
    def last_n_days(cls, n: int, *, today: date | None = None) -> "DateRange":
        """Convenience for the dashboard selector (7/30/90 day windows).

        Produces exactly `n` calendar days ending with today, modelled as
        a half-open range `[today - (n-1), today + 1)`. For n=7 with
        today=2026-04-24 the window is Apr 18..Apr 24 (inclusive) which
        covers `today and the six days before`.
        """
        if n <= 0:
            raise InvalidDateRangeError(f"last_n_days requires n > 0, got {n}")
        anchor = today or datetime.utcnow().date()
        return cls(
            start=anchor - timedelta(days=n - 1),
            end=anchor + timedelta(days=1),
        )


@dataclass(frozen=True)
class Metric:
    """Single scalar metric card on the dashboard.

    `delta_pct` is optional — the dashboard MVP does not compare to the
    previous period, but the field exists so the frontend can render a
    green/red chevron without a contract change when Phase 3+ adds it.
    """

    key: str
    label: str
    value: int | float
    unit: str = ""  # e.g. "₽", "шт", "%"
    delta_pct: float | None = None


@dataclass(frozen=True)
class SeriesPoint:
    day: date
    value: int | float


@dataclass(frozen=True)
class MetricSeries:
    """Time series keyed by day. `points` must be sorted ascending by day
    (guaranteed by the repo implementations — checked in `__post_init__`)."""

    key: str
    label: str
    points: tuple[SeriesPoint, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if any(
            self.points[i].day >= self.points[i + 1].day
            for i in range(len(self.points) - 1)
        ):
            raise ValueError(
                f"MetricSeries '{self.key}' points must be strictly ascending by day",
            )


@dataclass(frozen=True)
class StatusBucket:
    """One slice of the orders-by-status pie chart."""

    status: str
    count: int


@dataclass(frozen=True)
class TopDesign:
    design_id: str
    design_name: str
    orders_count: int


# ─── Widget VOs (Phase 11 — admin dashboard expansion) ──────────────────
#
# Eight new projections for the admin dashboard. Kept in the same module
# as the original metric VOs because they share the same "frozen, hashable,
# no behaviour" shape — the value of having them all importable from one
# place outweighs the file growth.


@dataclass(frozen=True)
class SubscriptionPlanBucket:
    """One row of the by-plan breakdown for the Subscriptions widget."""

    plan_id: str
    plan_name: str
    monthly_price: int  # ₽ per month, plain rubles
    active_count: int


@dataclass(frozen=True)
class SubscriptionsSummary:
    """Active subscribers + recurring revenue + churn for the period."""

    active_count: int           # active right now (not date-bounded)
    mrr: int                    # ₽ / month, sum(plan.price for ACTIVE subs)
    churn_pct: float            # cancelled-in-range / active-at-start * 100
    new_in_period: int          # subscriptions started in the range
    by_plan: tuple[SubscriptionPlanBucket, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class FunnelStage:
    """One stage of the order/customer funnel."""

    key: str                    # 'cart', 'placed', 'confirmed', 'in_progress', 'delivered', 'installed'
    label: str                  # human-readable, ru
    count: int
    # Conversion to this stage as % of the *first* stage (top of funnel).
    # `None` for the top stage itself; UI renders it as a dash.
    conversion_pct: float | None = None


@dataclass(frozen=True)
class AbandonedCart:
    """Constructor project with non-zero total whose owner never converted.

    Proxy for "cart" since the live cart is client-only (Zustand). Uses
    saved constructor projects: a saved project with `total_price > 0` and
    no order from the same user inside `rng` is treated as engaged-but-
    -unconverted intent.
    """

    project_id: str
    user_id: str
    user_email: str
    user_name: str
    project_name: str
    total_price: int
    panels_count: int
    last_activity: str          # ISO datetime


@dataclass(frozen=True)
class OrderAttention:
    """Order stuck longer than the SLA for its current status."""

    order_id: str
    order_number: str
    status: str                 # raw enum value; UI maps to label_ru
    age_hours: int              # hours since `created_at`, rounded down
    total: int                  # ₽
    user_id: str
    user_email: str
    user_name: str
    reason: str                 # short ru explanation (e.g. "висит >24ч")


@dataclass(frozen=True)
class ToolUsage:
    """Engagement metrics for the constructor + visualizer features."""

    constructor_sessions: int   # saved Project entries created in range
    visualizer_projects: int    # VisualizationProject entries created in range
    engaged_users: int          # distinct users who created either type
    converted_users: int        # of `engaged_users`, those with an order in range
    conversion_pct: float       # converted_users / engaged_users * 100


@dataclass(frozen=True)
class SizeBucket:
    """One row of the panel-size breakdown."""

    size_key: str               # e.g. "300x300"
    size_label: str             # e.g. "30×30 см"
    items_count: int            # sum(quantity) across orders in range
    revenue: int                # ₽


@dataclass(frozen=True)
class CityBucket:
    """One row of the geography widget."""

    city: str
    orders_count: int
    revenue: int


@dataclass(frozen=True)
class RegistrationsCompare:
    """New users vs new orders, daily — proxy for acquisition→activation lag.

    Two parallel series so the frontend can overlay them on a single chart;
    sharing the gap-filling contract with `MetricSeries`.
    """

    new_users: MetricSeries
    new_orders: MetricSeries
    total_users: int
    total_orders: int
