"""Phase 5 — admin user list filters.

Mirrors `app/domain/order/filters.py`: a frozen Value Object that carries
the *intent* of the admin's user-table query and nothing about persistence.
Repositories translate it into the appropriate SQL/in-memory predicates.

Filter axes:
  * `role`      — single role (CUSTOMER / ADMIN); None = all roles
  * `is_blocked`— None (all), True (blocked only), False (active only)
  * `search`    — case-insensitive substring on email / name / phone
"""
from dataclasses import dataclass

from .value_objects import UserRole


@dataclass(frozen=True)
class UserFilters:
    role: UserRole | None = None
    is_blocked: bool | None = None
    search: str | None = None

    def __post_init__(self) -> None:
        # Normalise blank search into None so repos can branch on `is None`
        # — same convention as `OrderFilters`.
        if self.search is not None:
            cleaned = self.search.strip()
            object.__setattr__(self, "search", cleaned or None)
