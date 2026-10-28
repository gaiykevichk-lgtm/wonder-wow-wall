"""Update designs in PostgreSQL: replace old ones and add new ones."""
import asyncio
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings


async def update():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Delete old designs
        await session.execute(text("DELETE FROM designs WHERE id IN ('flat-s-01', 'wav-s-10')"))

        # Insert new designs
        new_designs = [
            {
                "id": "herringbone-01",
                "name": "Ёлочка",
                "slug": "herringbone-01",
                "category_id": "cat-30x30",
                "style": "",
                "image": "/uploads/forms/30x30/herringbone-01-front.png",
                "description": "Классическая ёлочка — строгий геометрический узор, который подходит для любого интерьера.",
                "price": 1200,
                "colors": json.dumps([]),
                "rating": 4.8,
                "reviews_count": 64,
                "is_new": False,
                "is_popular": True,
                "is_published": True,
            },
            {
                "id": "herringbone-frame-01",
                "name": "Рамочная",
                "slug": "herringbone-frame-01",
                "category_id": "cat-30x30",
                "style": "",
                "image": "/uploads/forms/30x30/herringbone-frame-01-front.png",
                "description": "Рамочная панель — аккуратный геометрический рисунок для стильного интерьера.",
                "price": 1200,
                "colors": json.dumps([]),
                "rating": 4.9,
                "reviews_count": 87,
                "is_new": True,
                "is_popular": True,
                "is_published": True,
            },
        ]

        for d in new_designs:
            await session.execute(
                text("""INSERT INTO designs (id, name, slug, category_id, style, image, description, price, colors, rating, reviews_count, is_new, is_popular, is_published)
                     VALUES (:id, :name, :slug, :category_id, :style, :image, :description, :price, :colors, :rating, :reviews_count, :is_new, :is_popular, :is_published)
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        slug = EXCLUDED.slug,
                        category_id = EXCLUDED.category_id,
                        style = EXCLUDED.style,
                        image = EXCLUDED.image,
                        description = EXCLUDED.description,
                        price = EXCLUDED.price,
                        colors = EXCLUDED.colors,
                        rating = EXCLUDED.rating,
                        reviews_count = EXCLUDED.reviews_count,
                        is_new = EXCLUDED.is_new,
                        is_popular = EXCLUDED.is_popular,
                        is_published = EXCLUDED.is_published"""),
                d,
            )

        await session.commit()
        print("✅ Designs updated: removed Волна/Плоская, added Ёлочка/Рамочная")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(update())
