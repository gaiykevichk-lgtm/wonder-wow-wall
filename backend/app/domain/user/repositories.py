from abc import ABC, abstractmethod

from .entities import User
from .filters import UserFilters


class UserRepository(ABC):
    @abstractmethod
    async def create(self, user: User) -> User:
        ...

    @abstractmethod
    async def get_by_id(self, user_id: str) -> User | None:
        ...

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        ...

    @abstractmethod
    async def update(self, user: User) -> User:
        ...

    @abstractmethod
    async def count_admins(self) -> int:
        """Number of users with `role == UserRole.ADMIN`. Used by
        `RevokeAdminRole` to enforce the last-admin invariant (E1).
        Kept on the repository (not as a separate aggregate service) because
        it's a single SQL COUNT — no need for a bespoke domain service.
        """
        ...

    # ─── Phase 5 — admin user list ───────────────────────────────────

    @abstractmethod
    async def find_paginated(
        self, filters: UserFilters, page: int = 1, size: int = 50,
    ) -> tuple[list[User], int]:
        """Paginated admin search. Returns `(items, total)` ordered by
        `created_at DESC` so the most recently registered users surface
        first — matches the orders list convention.
        """
        ...

    @abstractmethod
    async def count_active_admins(self) -> int:
        """Number of `role == ADMIN AND NOT is_blocked` users.

        Used by `BlockUserAdmin` and `RevokeAdminRole` to enforce the
        last-active-admin invariant: blocking an admin has the same
        operational consequence as demoting them (they can't reach
        `/api/admin/*`), so it must respect the same guard.
        """
        ...
