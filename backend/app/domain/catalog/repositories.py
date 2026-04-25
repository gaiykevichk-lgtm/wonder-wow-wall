from abc import ABC, abstractmethod

from .entities import Design, Category, DesignReview
from .panel import Panel


class DesignRepository(ABC):
    @abstractmethod
    async def list_designs(
        self, category_id: str | None = None, search: str | None = None,
        sort_by: str = "name", offset: int = 0, limit: int = 20,
        *, color: str | None = None, style: str | None = None, is_new: bool | None = None,
    ) -> tuple[list[Design], int]:
        ...

    @abstractmethod
    async def get_by_id(self, design_id: str) -> Design | None:
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> Design | None:
        ...

    @abstractmethod
    async def update(self, design: Design) -> Design:
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


class PanelRepository(ABC):
    """Phase 7B — catalog Panel CRUD.

    Read methods take an `include_inactive` flag so the same repo serves
    both the public catalog (active only) and the admin table (everything).
    Defaulting to False keeps the public path safe against a forgotten
    flag at a call site.
    """

    @abstractmethod
    async def list_panels(
        self,
        *,
        include_inactive: bool = False,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Panel], int]:
        ...

    @abstractmethod
    async def get_by_id(self, panel_id: str) -> Panel | None:
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> Panel | None:
        ...

    @abstractmethod
    async def create(self, panel: Panel) -> Panel:
        ...

    @abstractmethod
    async def update(self, panel: Panel) -> Panel:
        ...

    @abstractmethod
    async def delete(self, panel_id: str) -> bool:
        ...
