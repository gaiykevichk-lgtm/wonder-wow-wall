import asyncio
import os

import asyncpg


async def main() -> None:
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    connection = await asyncpg.connect(url)
    try:
        exists = await connection.fetchval(
            """SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            )""",
            "panel_variants",
            "recommendation_image_paths",
        )
        if not exists:
            await connection.execute(
                """ALTER TABLE panel_variants
                ADD COLUMN recommendation_image_paths JSON NOT NULL DEFAULT '[]'::json"""
            )
        await connection.execute(
            "UPDATE alembic_version SET version_num = '029' WHERE version_num = '028'"
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
