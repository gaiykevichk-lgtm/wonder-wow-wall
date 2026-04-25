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
