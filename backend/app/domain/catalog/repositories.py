from abc import ABC, abstractmethod

from .entities import Design, Category, DesignReview


class DesignRepository(ABC):
    @abstractmethod
    async def list_designs(
        self, category_id: str | None = None, search: str | None = None,
        sort_by: str = "name", offset: int = 0, limit: int = 20,
    ) -> tuple[list[Design], int]:
        ...

    @abstractmethod
    async def get_by_id(self, design_id: str) -> Design | None:
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> Design | None:
        ...


class CategoryRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[Category]:
        ...

    @abstractmethod
    async def get_by_id(self, category_id: str) -> Category | None:
        ...


class ReviewRepository(ABC):
    @abstractmethod
    async def list_by_design(self, design_id: str, offset: int = 0, limit: int = 20) -> list[DesignReview]:
        ...

    @abstractmethod
    async def add(self, review: DesignReview) -> DesignReview:
        ...
