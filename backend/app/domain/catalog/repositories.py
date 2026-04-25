from abc import ABC, abstractmethod
from dataclasses import dataclass

from .entities import Design, Category, DesignReview
from .panel import Panel
from .recommendation import (
    Recommendation,
    RecommendationSourceType,
    RecommendationTargetType,
)


class DesignRepository(ABC):
    @abstractmethod
    async def list_designs(
        self, category_id: str | None = None, search: str | None = None,
        sort_by: str = "name", offset: int = 0, limit: int = 20,
        *, color: str | None = None, style: str | None = None, is_new: bool | None = None,
        # Phase 7A — admin-controlled visibility filter.
        # `True`  → only published rows (the public catalog default).
        # `False` → only unpublished rows (rare; admin "scheduled" view).
        # `None`  → both (the admin list).
        is_published: bool | None = True,
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

    # ─── Phase 7A — admin CRUD ────────────────────────────────────
    @abstractmethod
    async def create(self, design: Design) -> Design:
        ...

    @abstractmethod
    async def delete(self, design_id: str) -> bool:
        ...


class CategoryRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[Category]:
        ...

    @abstractmethod
    async def get_by_id(self, category_id: str) -> Category | None:
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> Category | None:
        ...

    # ─── Phase 7A — admin CRUD ────────────────────────────────────
    @abstractmethod
    async def create(self, category: Category) -> Category:
        ...

    @abstractmethod
    async def update(self, category: Category) -> Category:
        ...

    @abstractmethod
    async def delete(self, category_id: str) -> bool:
        ...

    @abstractmethod
    async def count_designs(self, category_id: str) -> int:
        """Phase 7A — used by `DeleteCategoryAdmin` to refuse deletion
        of a category that still has designs attached, and by the admin
        list view to render the «N дизайнов» column without an N+1 over
        the `DesignRepository`."""
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
        # Phase 7B remediation 2 — server-side filters added so the admin
        # table can scale past the in-page client filter (FE-B audit).
        # `is_active`: explicit True/False narrows further on top of
        # `include_inactive` (admin chose «Inactive only» tab).
        # `search`: case-insensitive substring on name + slug.
        # Both `None` keep legacy behavior.
        is_active: bool | None = None,
        search: str | None = None,
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


@dataclass(frozen=True)
class RecommendationFilters:
    """Phase 10 — server-side filter bag for the admin list endpoint.

    Mirrored on the API layer's query-string parameters. `None` means
    "no filter on this axis"; explicit values are AND-combined.
    """

    source_type: RecommendationSourceType | None = None
    has_manual: bool | None = None  # True → only sources with at least 1 target


class RecommendationRepository(ABC):
    """Phase 10 — admin-curated recommendations rail.

    Lookup is by `(source_type, source_id)` (the natural key), not by
    `id` — the aggregate's uuid is used only for cascade FK deletes. A
    UNIQUE constraint on the pair lives in the SQL migration; the
    in-memory repo enforces it via an explicit pre-check.

    `find_by_target` is required for cascade cleanup when a panel or
    design is deleted: every aggregate that *recommends* the deleted
    item must be re-saved without the orphan target. Returns the list
    so the caller (the cleanup use case) can decide how to apply the
    fix without leaking the iteration into the repo.
    """

    @abstractmethod
    async def find_by_source(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> Recommendation | None:
        ...

    @abstractmethod
    async def save(self, recommendation: Recommendation) -> Recommendation:
        """Upsert by (source_type, source_id). Returns the persisted entity."""
        ...

    @abstractmethod
    async def delete(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> bool:
        """Returns True if a row was deleted, False if missing."""
        ...

    @abstractmethod
    async def list_paginated(
        self,
        filters: RecommendationFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Recommendation], int]:
        ...

    @abstractmethod
    async def find_by_target(
        self,
        target_type: RecommendationTargetType,
        target_id: str,
    ) -> list[Recommendation]:
        """Cascade-cleanup hook — return every aggregate that lists
        `(target_type, target_id)` among its targets."""
        ...
