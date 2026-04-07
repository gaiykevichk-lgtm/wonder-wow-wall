"""Seed the PostgreSQL database with initial catalog data.

Usage:
    cd backend && python -m scripts.seed_db

Requires DATABASE_URL in .env or environment.
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.seed_data import categories_as_dicts, designs_as_dicts
from app.infrastructure.persistence.models import CategoryModel, DesignModel


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Check if data already exists
        result = await session.execute(text("SELECT count(*) FROM categories"))
        count = result.scalar()
        if count and count > 0:
            print(f"Database already has {count} categories — skipping seed.")
            await engine.dispose()
            return

        categories = categories_as_dicts()
        designs = designs_as_dicts()

        for cat in categories:
            session.add(CategoryModel(**cat))

        for d in designs:
            session.add(DesignModel(**d))

        await session.commit()
        print(f"Seeded {len(categories)} categories and {len(designs)} designs.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
