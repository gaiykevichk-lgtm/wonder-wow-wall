"""Dependency container — wires use cases to repository implementations.

Provides FastAPI dependency functions for repository injection.
Set USE_MEMORY_REPOS=true to use in-memory (for tests / no-DB dev).
"""

from fastapi import Depends

from app.config import settings
from app.seed_data import SEED_CATEGORIES, SEED_DESIGNS

from app.infrastructure.persistence.repositories.memory import (
    InMemoryDesignRepository,
    InMemoryCategoryRepository,
    InMemoryReviewRepository,
    InMemoryOrderRepository,
    InMemorySubscriptionRepository,
    InMemoryUserRepository,
)
from app.infrastructure.persistence.repositories.project_repo import (
    InMemoryProjectRepository,
)
from app.infrastructure.persistence.repositories.visualization_repo import (
    InMemoryVisualizationProjectRepository,
)


# ─── In-Memory Singletons (used when USE_MEMORY_REPOS=true or for tests) ──

_mem_design_repo = InMemoryDesignRepository(SEED_DESIGNS)
_mem_category_repo = InMemoryCategoryRepository(SEED_CATEGORIES)
_mem_review_repo = InMemoryReviewRepository()
_mem_order_repo = InMemoryOrderRepository()
_mem_subscription_repo = InMemorySubscriptionRepository()
_mem_user_repo = InMemoryUserRepository()
_mem_project_repo = InMemoryProjectRepository()
_mem_visualization_repo = InMemoryVisualizationProjectRepository()


# ─── Backward-compatible aliases (used by existing tests) ────────────

design_repo = _mem_design_repo
category_repo = _mem_category_repo
review_repo = _mem_review_repo
order_repo = _mem_order_repo
subscription_repo = _mem_subscription_repo
user_repo = _mem_user_repo
project_repo = _mem_project_repo
visualization_repo = _mem_visualization_repo


# ─── FastAPI Dependencies ────────────────────────────────────────────

_sql_repo_classes: dict | None = None


def _get_sql_repo_classes() -> dict:
    """Lazy import to avoid circular deps and DB connection at import time."""
    global _sql_repo_classes
    if _sql_repo_classes is None:
        from app.infrastructure.persistence.repositories.sql import (
            SqlDesignRepository,
            SqlCategoryRepository,
            SqlReviewRepository,
            SqlOrderRepository,
            SqlSubscriptionRepository,
            SqlUserRepository,
        )
        from app.infrastructure.persistence.repositories.project_repo import SqlProjectRepository
        from app.infrastructure.persistence.repositories.visualization_repo import SqlVisualizationProjectRepository
        _sql_repo_classes = {
            "design": SqlDesignRepository,
            "category": SqlCategoryRepository,
            "review": SqlReviewRepository,
            "order": SqlOrderRepository,
            "subscription": SqlSubscriptionRepository,
            "user": SqlUserRepository,
            "project": SqlProjectRepository,
            "visualization": SqlVisualizationProjectRepository,
        }
    return _sql_repo_classes


async def get_db_session():
    """Yield a single async DB session per request.

    FastAPI caches Depends() results per request, so all repos
    in the same request share this session — single transaction.
    """
    from app.infrastructure.persistence.database import async_session
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_design_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_design_repo
    return _get_sql_repo_classes()["design"](session)


def get_category_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_category_repo
    return _get_sql_repo_classes()["category"](session)


def get_review_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_review_repo
    return _get_sql_repo_classes()["review"](session)


def get_order_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_order_repo
    return _get_sql_repo_classes()["order"](session)


def get_subscription_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_subscription_repo
    return _get_sql_repo_classes()["subscription"](session)


def get_user_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_user_repo
    return _get_sql_repo_classes()["user"](session)


def get_project_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_project_repo
    return _get_sql_repo_classes()["project"](session)


def get_visualization_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_visualization_repo
    return _get_sql_repo_classes()["visualization"](session)
