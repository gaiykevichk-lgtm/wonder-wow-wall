"""Drop interior photos from a single-image variant when their execution
ownership is ambiguous. The user can re-upload interiors via the admin UI.
"""
import asyncio, json
from pathlib import Path
from sqlalchemy import text
from app.infrastructure.persistence.database import _get_engine

TARGETS = ['9c3026c5-0000-4b3f-ac7c-d2297e04c392']

async def main():
    async with _get_engine().begin() as conn:
        before = []
        for tid in TARGETS:
            row = (await conn.execute(text("SELECT * FROM panel_variants WHERE id=:id FOR UPDATE"), {"id": tid})).mappings().one_or_none()
            if not row or not row['design_image_paths']:
                continue
            before.append(dict(row))
            await conn.execute(text("UPDATE panel_variants SET design_image_paths = CAST('[]' AS json), updated_at = now() WHERE id = :id"), {"id": tid})
        if before:
            Path('/app/deploy-backups/ambiguous-interiors-before.json').write_text(
                json.dumps(before, default=str, indent=2, ensure_ascii=False))
            print("CLEARED_INTERIORS", [b['id'] for b in before])

asyncio.run(main())
