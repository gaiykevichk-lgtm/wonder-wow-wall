"""Analytics repository interface.

A single "fat" repo (instead of one-method-per-use-case slivers) because:
  * every dashboard call needs all five projections,
  * batching them under one adapter lets the SQL impl reuse a session
    and amortise overhead,
  * there is exactly one client (`GetDashboardSnapshot`), so YAGNI on
    splitting by read-type.
"""

from abc import ABC, abstractmethod

from .value_objects import DateRange, MetricSeries, StatusBucket, TopDesign


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
