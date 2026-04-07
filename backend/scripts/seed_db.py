"""Seed the PostgreSQL database with initial catalog data.

Usage:
    cd backend && python -m scripts.seed_db

Requires DATABASE_URL in .env or environment.
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.infrastructure.persistence.models import CategoryModel, DesignModel


SEED_CATEGORIES = [
    {"id": "cat-1", "name": "Природа", "slug": "nature", "image": "/images/cat-nature.jpg", "count": 3},
    {"id": "cat-2", "name": "Абстракция", "slug": "abstract", "image": "/images/cat-abstract.jpg", "count": 3},
    {"id": "cat-3", "name": "Геометрия", "slug": "geometry", "image": "/images/cat-geometry.jpg", "count": 2},
    {"id": "cat-4", "name": "Минимализм", "slug": "minimalism", "image": "/images/cat-minimalism.jpg", "count": 2},
    {"id": "cat-5", "name": "Текстуры", "slug": "textures", "image": "/images/cat-textures.jpg", "count": 1},
    {"id": "cat-6", "name": "Арт", "slug": "art", "image": "/images/cat-art.jpg", "count": 1},
]

SEED_DESIGNS = [
    {"id": "d-1", "name": "Тропический лес", "slug": "tropical-forest", "category_id": "cat-1", "style": "Природа",
     "image": "/images/design-1.jpg", "description": "Яркие тропические растения", "price": 1200,
     "colors": [{"hex": "#2E7D32", "name": "Зелёный"}, {"hex": "#1B5E20", "name": "Тёмно-зелёный"}, {"hex": "#4CAF50", "name": "Светло-зелёный"}],
     "rating": 4.8, "reviews_count": 24, "is_popular": True},
    {"id": "d-2", "name": "Горный пейзаж", "slug": "mountain-landscape", "category_id": "cat-1", "style": "Природа",
     "image": "/images/design-2.jpg", "description": "Горные вершины в дымке", "price": 1200,
     "colors": [{"hex": "#607D8B", "name": "Серый"}, {"hex": "#455A64", "name": "Тёмно-серый"}, {"hex": "#90A4AE", "name": "Светло-серый"}],
     "rating": 4.6, "reviews_count": 18, "is_new": True},
    {"id": "d-3", "name": "Океанская волна", "slug": "ocean-wave", "category_id": "cat-1", "style": "Природа",
     "image": "/images/design-3.jpg", "description": "Морская тематика", "price": 1200,
     "colors": [{"hex": "#1565C0", "name": "Синий"}, {"hex": "#0D47A1", "name": "Тёмно-синий"}, {"hex": "#42A5F5", "name": "Голубой"}],
     "rating": 4.7, "reviews_count": 15},
    {"id": "d-4", "name": "Абстракция «Поток»", "slug": "abstract-flow", "category_id": "cat-2", "style": "Абстракция",
     "image": "/images/design-4.jpg", "description": "Абстрактные цветовые переходы", "price": 1200,
     "colors": [{"hex": "#E91E63", "name": "Розовый"}, {"hex": "#9C27B0", "name": "Фиолетовый"}, {"hex": "#FF5722", "name": "Оранжевый"}],
     "rating": 4.5, "reviews_count": 12},
    {"id": "d-5", "name": "Абстракция «Космос»", "slug": "abstract-cosmos", "category_id": "cat-2", "style": "Абстракция",
     "image": "/images/design-5.jpg", "description": "Космические мотивы", "price": 1200,
     "colors": [{"hex": "#1A237E", "name": "Индиго"}, {"hex": "#311B92", "name": "Фиолет"}, {"hex": "#000000", "name": "Чёрный"}],
     "rating": 4.9, "reviews_count": 30, "is_popular": True},
    {"id": "d-6", "name": "Мраморный узор", "slug": "marble-pattern", "category_id": "cat-2", "style": "Абстракция",
     "image": "/images/design-6.jpg", "description": "Имитация натурального мрамора", "price": 1200,
     "colors": [{"hex": "#FAFAFA", "name": "Белый"}, {"hex": "#E0E0E0", "name": "Серый"}, {"hex": "#212121", "name": "Чёрный"}],
     "rating": 4.4, "reviews_count": 8},
    {"id": "d-7", "name": "Геометрия «Гексагон»", "slug": "geometry-hexagon", "category_id": "cat-3", "style": "Геометрия",
     "image": "/images/design-7.jpg", "description": "Геометрические шестиугольники", "price": 1200,
     "colors": [{"hex": "#FFC107", "name": "Золотой"}, {"hex": "#FF9800", "name": "Оранж"}, {"hex": "#795548", "name": "Коричневый"}],
     "rating": 4.3, "reviews_count": 10},
    {"id": "d-8", "name": "Геометрия «Ромбы»", "slug": "geometry-diamonds", "category_id": "cat-3", "style": "Геометрия",
     "image": "/images/design-8.jpg", "description": "Ромбовидные паттерны", "price": 1200,
     "colors": [{"hex": "#37474F", "name": "Антрацит"}, {"hex": "#546E7A", "name": "Сталь"}, {"hex": "#CFD8DC", "name": "Серебро"}],
     "rating": 4.6, "reviews_count": 14, "is_new": True},
    {"id": "d-9", "name": "Минимализм «Линии»", "slug": "minimalism-lines", "category_id": "cat-4", "style": "Минимализм",
     "image": "/images/design-9.jpg", "description": "Тонкие линии на нейтральном фоне", "price": 1200,
     "colors": [{"hex": "#FFFFFF", "name": "Белый"}, {"hex": "#F5F5F5", "name": "Слоновая кость"}, {"hex": "#000000", "name": "Чёрный"}],
     "rating": 4.7, "reviews_count": 22, "is_popular": True},
    {"id": "d-10", "name": "Минимализм «Точки»", "slug": "minimalism-dots", "category_id": "cat-4", "style": "Минимализм",
     "image": "/images/design-10.jpg", "description": "Точечные узоры", "price": 1200,
     "colors": [{"hex": "#BDBDBD", "name": "Серый"}, {"hex": "#FFFFFF", "name": "Белый"}, {"hex": "#424242", "name": "Тёмно-серый"}],
     "rating": 4.2, "reviews_count": 6},
    {"id": "d-11", "name": "Бетонная текстура", "slug": "concrete-texture", "category_id": "cat-5", "style": "Текстуры",
     "image": "/images/design-11.jpg", "description": "Имитация бетонной поверхности", "price": 1200,
     "colors": [{"hex": "#9E9E9E", "name": "Бетон"}, {"hex": "#757575", "name": "Тёмный бетон"}, {"hex": "#E0E0E0", "name": "Светлый бетон"}],
     "rating": 4.5, "reviews_count": 16},
    {"id": "d-12", "name": "Поп-арт", "slug": "pop-art", "category_id": "cat-6", "style": "Арт",
     "image": "/images/design-12.jpg", "description": "Яркие поп-арт иллюстрации", "price": 1200,
     "colors": [{"hex": "#F44336", "name": "Красный"}, {"hex": "#FFEB3B", "name": "Жёлтый"}, {"hex": "#2196F3", "name": "Синий"}],
     "rating": 4.8, "reviews_count": 20, "is_new": True},
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if data already exists
        result = await session.execute(text("SELECT count(*) FROM categories"))
        count = result.scalar()
        if count and count > 0:
            print(f"Database already has {count} categories — skipping seed.")
            await engine.dispose()
            return

        # Seed categories
        for cat in SEED_CATEGORIES:
            session.add(CategoryModel(**cat))

        # Seed designs
        for d in SEED_DESIGNS:
            session.add(DesignModel(**d))

        await session.commit()
        print(f"Seeded {len(SEED_CATEGORIES)} categories and {len(SEED_DESIGNS)} designs.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
