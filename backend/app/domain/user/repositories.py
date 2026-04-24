from abc import ABC, abstractmethod

from .entities import User


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
