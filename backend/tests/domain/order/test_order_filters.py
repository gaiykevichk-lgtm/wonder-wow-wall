"""Phase 4A — OrderFilters VO unit tests.

VO is small but carries two non-obvious rules:
  * empty/whitespace search collapses to None (so repos can branch on it
    without re-implementing the trim themselves)
  * `date_from >= date_to` is rejected — the half-open `[from, to)`
    convention from analytics requires strict ordering.
"""
from datetime import datetime

import pytest

from app.domain.order.filters import InvalidOrderFilterError, OrderFilters
from app.domain.order.value_objects import OrderStatus


class TestOrderFiltersConstruction:
    def test_all_defaults(self):
        f = OrderFilters()
        assert f.status is None
        assert f.user_id is None
        assert f.date_from is None
        assert f.date_to is None
        assert f.search is None

    def test_status_passthrough(self):
        f = OrderFilters(status=OrderStatus.DELIVERED)
        assert f.status == OrderStatus.DELIVERED


class TestSearchNormalisation:
    def test_blank_search_becomes_none(self):
        assert OrderFilters(search="").search is None
        assert OrderFilters(search="   ").search is None

    def test_search_is_trimmed(self):
        assert OrderFilters(search="  WW-1  ").search == "WW-1"

    def test_search_preserves_inner_spaces(self):
        assert OrderFilters(search="ivan petrov").search == "ivan petrov"


class TestDateValidation:
    def test_from_must_precede_to(self):
        with pytest.raises(InvalidOrderFilterError):
            OrderFilters(
                date_from=datetime(2026, 4, 25),
                date_to=datetime(2026, 4, 25),  # equal — rejected (half-open)
            )

    def test_from_after_to_is_rejected(self):
        with pytest.raises(InvalidOrderFilterError):
            OrderFilters(
                date_from=datetime(2026, 4, 25),
                date_to=datetime(2026, 4, 24),
            )

    def test_only_from_is_allowed(self):
        # No `to` → no upper bound to check against.
        f = OrderFilters(date_from=datetime(2026, 4, 25))
        assert f.date_from == datetime(2026, 4, 25)
        assert f.date_to is None


class TestEquality:
    def test_value_equality(self):
        # Frozen dataclass → hashable + comparable. This is what makes the
        # VO usable as a cache key in future phases.
        a = OrderFilters(status=OrderStatus.PLACED, user_id="u-1")
        b = OrderFilters(status=OrderStatus.PLACED, user_id="u-1")
        assert a == b
        assert hash(a) == hash(b)
