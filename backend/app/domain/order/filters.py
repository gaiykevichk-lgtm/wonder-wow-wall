"""Phase 4A — admin order list filters.

`OrderFilters` is a read-side Value Object: it carries the *intent* of the
admin's table query (status, user scope, date window, free-text search) and
nothing about persistence. Repositories translate it into the appropriate
SQL/in-memory predicates. Keeping it as a VO (frozen, equality by value)
means it composes nicely as a dict-key for cache layers later.

Date semantics:
  * `date_from` — inclusive (>=). Naive datetime, UTC.
  * `date_to`   — exclusive (<). Half-open `[from, to)` matches `DateRange`
                  in the analytics context, so we don't introduce a second
                  convention. Callers that want "the whole day of D" should
                  pass `date_to=D + 1 day at 00:00`.
"""
from dataclasses import dataclass
from datetime import datetime

from .value_objects import OrderStatus


class InvalidOrderFilterError(ValueError):
    """Raised when filter inputs violate domain invariants."""


@dataclass(frozen=True)
class OrderFilters:
    status: OrderStatus | None = None
    user_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    # Free-text query, case-insensitive. Matches order.number prefix/substring
    # and (if a user repository is available) user.email/user.name. Empty
    # strings are normalised to None at construction.
    search: str | None = None

    def __post_init__(self) -> None:
        # Normalise blank search into None so repos can branch on `is None`.
        if self.search is not None:
            cleaned = self.search.strip()
            object.__setattr__(self, "search", cleaned or None)
        if (
            self.date_from is not None
            and self.date_to is not None
            and self.date_from >= self.date_to
        ):
            raise InvalidOrderFilterError(
                f"date_from ({self.date_from.isoformat()}) must be strictly "
                f"before date_to ({self.date_to.isoformat()})"
            )
