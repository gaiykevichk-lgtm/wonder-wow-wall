"""Phase 3 — DateRange VO invariants."""

from datetime import date, datetime

import pytest

from app.domain.analytics.value_objects import DateRange, InvalidDateRangeError


class TestDateRangeInvariants:
    def test_end_before_start_rejected(self):
        with pytest.raises(InvalidDateRangeError):
            DateRange(start=date(2026, 4, 10), end=date(2026, 4, 1))

    def test_end_equal_start_rejected(self):
        # Empty range would break every "days" / "iter_days" consumer.
        with pytest.raises(InvalidDateRangeError):
            DateRange(start=date(2026, 4, 1), end=date(2026, 4, 1))

    def test_days_is_half_open(self):
        # Apr 1..4 (exclusive) = 3 days.
        rng = DateRange(start=date(2026, 4, 1), end=date(2026, 4, 4))
        assert rng.days == 3

    def test_iter_days_materialises_every_day(self):
        rng = DateRange(start=date(2026, 4, 1), end=date(2026, 4, 4))
        assert list(rng.iter_days()) == [
            date(2026, 4, 1), date(2026, 4, 2), date(2026, 4, 3),
        ]

    def test_contains_honors_half_open_interval(self):
        rng = DateRange(start=date(2026, 4, 1), end=date(2026, 4, 4))
        assert rng.contains(date(2026, 4, 1)) is True
        assert rng.contains(date(2026, 4, 3)) is True
        assert rng.contains(date(2026, 4, 4)) is False  # exclusive end
        assert rng.contains(datetime(2026, 4, 2, 12, 30)) is True


class TestLastNDays:
    def test_last_7_days_includes_today_and_six_before(self):
        today = date(2026, 4, 24)
        rng = DateRange.last_n_days(7, today=today)
        # Start = today - 6 days (today + 6 previous days = 7 days total).
        assert rng.start == date(2026, 4, 18)
        # end is day-after-today because DateRange is end-exclusive —
        # this is what makes `today`'s events count toward the window.
        assert rng.end == date(2026, 4, 25)
        assert rng.contains(today) is True
        assert rng.days == 7

    def test_last_n_days_rejects_non_positive(self):
        with pytest.raises(InvalidDateRangeError):
            DateRange.last_n_days(0)
        with pytest.raises(InvalidDateRangeError):
            DateRange.last_n_days(-5)
