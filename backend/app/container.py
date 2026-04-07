"""Dependency container — wires use cases to repository implementations.

Provides FastAPI dependency functions for repository injection.
Set USE_MEMORY_REPOS=true to use in-memory (for tests / no-DB dev).
"""

from fastapi import Depends

from app.config import settings

from app.domain.catalog.entities import Design, Category
from app.domain.catalog.value_objects import Color

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


# ─── Seed Data ───────────────────────────────────────────────────────

SEED_CATEGORIES = [
    Category(id="cat-1", name="Природа", slug="nature", image="/images/cat-nature.jpg", count=3),
    Category(id="cat-2", name="Абстракция", slug="abstract", image="/images/cat-abstract.jpg", count=3),
    Category(id="cat-3", name="Геометрия", slug="geometry", image="/images/cat-geometry.jpg", count=2),
    Category(id="cat-4", name="Минимализм", slug="minimalism", image="/images/cat-minimalism.jpg", count=2),
    Category(id="cat-5", name="Текстуры", slug="textures", image="/images/cat-textures.jpg", count=1),
    Category(id="cat-6", name="Арт", slug="art", image="/images/cat-art.jpg", count=1),
]

SEED_DESIGNS = [
    Design(id="d-1", name="Тропический лес", slug="tropical-forest", category_id="cat-1", style="Природа",
           image="/images/design-1.jpg", description="Яркие тропические растения", price=1200,
           colors=[Color("#2E7D32", "Зелёный"), Color("#1B5E20", "Тёмно-зелёный"), Color("#4CAF50", "Светло-зелёный")],
           rating=4.8, reviews_count=24, is_popular=True),
    Design(id="d-2", name="Горный пейзаж", slug="mountain-landscape", category_id="cat-1", style="Природа",
           image="/images/design-2.jpg", description="Горные вершины в дымке", price=1200,
           colors=[Color("#607D8B", "Серый"), Color("#455A64", "Тёмно-серый"), Color("#90A4AE", "Светло-серый")],
           rating=4.6, reviews_count=18, is_new=True),
    Design(id="d-3", name="Океанская волна", slug="ocean-wave", category_id="cat-1", style="Природа",
           image="/images/design-3.jpg", description="Морская тематика", price=1200,
           colors=[Color("#1565C0", "Синий"), Color("#0D47A1", "Тёмно-синий"), Color("#42A5F5", "Голубой")],
           rating=4.7, reviews_count=15),
    Design(id="d-4", name="Абстракция «Поток»", slug="abstract-flow", category_id="cat-2", style="Абстракция",
           image="/images/design-4.jpg", description="Абстрактные цветовые переходы", price=1200,
           colors=[Color("#E91E63", "Розовый"), Color("#9C27B0", "Фиолетовый"), Color("#FF5722", "Оранжевый")],
           rating=4.5, reviews_count=12),
    Design(id="d-5", name="Абстракция «Космос»", slug="abstract-cosmos", category_id="cat-2", style="Абстракция",
           image="/images/design-5.jpg", description="Космические мотивы", price=1200,
           colors=[Color("#1A237E", "Индиго"), Color("#311B92", "Фиолет"), Color("#000000", "Чёрный")],
           rating=4.9, reviews_count=30, is_popular=True),
    Design(id="d-6", name="Мраморный узор", slug="marble-pattern", category_id="cat-2", style="Абстракция",
           image="/images/design-6.jpg", description="Имитация натурального мрамора", price=1200,
           colors=[Color("#FAFAFA", "Белый"), Color("#E0E0E0", "Серый"), Color("#212121", "Чёрный")],
           rating=4.4, reviews_count=8),
    Design(id="d-7", name="Геометрия «Гексагон»", slug="geometry-hexagon", category_id="cat-3", style="Геометрия",
           image="/images/design-7.jpg", description="Геометрические шестиугольники", price=1200,
           colors=[Color("#FFC107", "Золотой"), Color("#FF9800", "Оранж"), Color("#795548", "Коричневый")],
           rating=4.3, reviews_count=10),
    Design(id="d-8", name="Геометрия «Ромбы»", slug="geometry-diamonds", category_id="cat-3", style="Геометрия",
           image="/images/design-8.jpg", description="Ромбовидные паттерны", price=1200,
           colors=[Color("#37474F", "Антрацит"), Color("#546E7A", "Сталь"), Color("#CFD8DC", "Серебро")],
           rating=4.6, reviews_count=14, is_new=True),
    Design(id="d-9", name="Минимализм «Линии»", slug="minimalism-lines", category_id="cat-4", style="Минимализм",
           image="/images/design-9.jpg", description="Тонкие линии на нейтральном фоне", price=1200,
           colors=[Color("#FFFFFF", "Белый"), Color("#F5F5F5", "Слоновая кость"), Color("#000000", "Чёрный")],
           rating=4.7, reviews_count=22, is_popular=True),
    Design(id="d-10", name="Минимализм «Точки»", slug="minimalism-dots", category_id="cat-4", style="Минимализм",
           image="/images/design-10.jpg", description="Точечные узоры", price=1200,
           colors=[Color("#BDBDBD", "Серый"), Color("#FFFFFF", "Белый"), Color("#424242", "Тёмно-серый")],
           rating=4.2, reviews_count=6),
    Design(id="d-11", name="Бетонная текстура", slug="concrete-texture", category_id="cat-5", style="Текстуры",
           image="/images/design-11.jpg", description="Имитация бетонной поверхности", price=1200,
           colors=[Color("#9E9E9E", "Бетон"), Color("#757575", "Тёмный бетон"), Color("#E0E0E0", "Светлый бетон")],
           rating=4.5, reviews_count=16),
    Design(id="d-12", name="Поп-арт", slug="pop-art", category_id="cat-6", style="Арт",
           image="/images/design-12.jpg", description="Яркие поп-арт иллюстрации", price=1200,
           colors=[Color("#F44336", "Красный"), Color("#FFEB3B", "Жёлтый"), Color("#2196F3", "Синий")],
           rating=4.8, reviews_count=20, is_new=True),
]

# ─── In-Memory Singletons (used when USE_MEMORY_REPOS=true or for tests) ──

_mem_design_repo = InMemoryDesignRepository(SEED_DESIGNS)
_mem_category_repo = InMemoryCategoryRepository(SEED_CATEGORIES)
_mem_review_repo = InMemoryReviewRepository()
_mem_order_repo = InMemoryOrderRepository()
_mem_subscription_repo = InMemorySubscriptionRepository()
_mem_user_repo = InMemoryUserRepository()
_mem_project_repo = InMemoryProjectRepository()


# ─── Backward-compatible aliases (used by existing tests) ────────────

design_repo = _mem_design_repo
category_repo = _mem_category_repo
review_repo = _mem_review_repo
order_repo = _mem_order_repo
subscription_repo = _mem_subscription_repo
user_repo = _mem_user_repo
project_repo = _mem_project_repo


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
        _sql_repo_classes = {
            "design": SqlDesignRepository,
            "category": SqlCategoryRepository,
            "review": SqlReviewRepository,
            "order": SqlOrderRepository,
            "subscription": SqlSubscriptionRepository,
            "user": SqlUserRepository,
            "project": SqlProjectRepository,
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
