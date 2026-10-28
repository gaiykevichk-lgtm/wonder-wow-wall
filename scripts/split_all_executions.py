"""Split every multi-image variant into separate executions.
Idempotent: derives deterministic new IDs and checks the source already has single-image rows.
Drops ambiguous interior photos (interior photos that belong to a multi-image variant
without explicit per-execution split) — they would otherwise silently pick a winner.
"""
import asyncio
import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy import text
from app.infrastructure.persistence.database import _get_engine

async def main():
    async with _get_engine().connect() as c:
        rows = (await c.execute(text(
            "SELECT id, panel_id, texture_id, color_id, color_hex, image_paths, design_image_paths, name "
            "FROM panel_variants WHERE is_active = true AND jsonb_array_length(image_paths) > 1 "
            "ORDER BY created_at"))).mappings().all()
    if not rows:
        print("NOTHING_TO_DO")
        return
    backup_dir = Path('/app/deploy-backups'); backup_dir.mkdir(exist_ok=True)
    backup_dir.mkdir(exist_ok=True)
    backup_path = backup_dir / f'panel-variants-split-{len(rows)}-sources.json'
    backup_path.write_text(json.dumps([dict(r) for r in rows], default=str, indent=2, ensure_ascii=False))
    async with _get_engine().begin() as conn:
        for r in rows:
            assert not r['design_image_paths'], f"interior ownership unknown for {r['id']}"
            images = list(r['image_paths'])
            new_ids = [str(uuid5(NAMESPACE_URL, f'wonderwowwall:exec-split:{r["id"]}:{i}')) for i in range(1, len(images))]
            existing = (await conn.execute(text("SELECT id FROM panel_variants WHERE id = ANY(:ids)"), {"ids": new_ids})).scalars().all()
            if existing:
                print("ALREADY_SPLIT", r['id'], existing)
                continue
            first_id = r['id']
            first_images = images[:1]
            others = images[1:]
            await conn.execute(text(
                "UPDATE panel_variants SET image_paths = CAST(:images AS json), design_image_paths = CAST('[]' AS json), updated_at = now() WHERE id = :id"),
                {"id": first_id, "images": json.dumps(first_images)})
            for new_id, image in zip(new_ids, others):
                await conn.execute(text(
                    "INSERT INTO panel_variants (id, panel_id, texture_id, color_id, color_hex, image_paths, design_image_paths, is_active, created_at, updated_at, name) "
                    "VALUES (:id, :panel_id, :texture_id, :color_id, :color_hex, CAST(:image AS json), CAST('[]' AS json), true, now(), now(), :name)"),
                    {"id": new_id, "panel_id": r['panel_id'], "texture_id": r['texture_id'],
                     "color_id": r['color_id'], "color_hex": r['color_hex'],
                     "image": json.dumps([image]), "name": r['name'] or ''})
            print("SPLIT", first_id, "->", [first_id, *new_ids])
    async with _get_engine().connect() as c:
        after = (await c.execute(text("SELECT count(*) FROM panel_variants WHERE is_active=true"))).scalar()
    print("TOTAL_AFTER=", after)

asyncio.run(main())
