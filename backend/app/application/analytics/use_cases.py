"""GetDashboardSnapshot — the only admin-dashboard use case.

Orchestrates the five `AnalyticsRepository` reads and wraps the scalar
totals into `Metric` VOs with human-readable labels and units. Keeping
the label/unit mapping here (application layer) — not in the repo —
lets us i18n the dashboard later without touching infrastructure.
"""

from dataclasses import dataclass

from app.domain.analytics.repositories import AnalyticsRepository
from app.domain.analytics.value_objects import (
    DateRange,
    Metric,
    MetricSeries,
    StatusBucket,
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
        )
