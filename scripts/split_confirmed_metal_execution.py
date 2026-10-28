"""One-off user-confirmed split of Demo 2 metal execution images.
Run inside backend container. No invented products or image uploads.
"""
import asyncio
import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy import text
from app.infrastructure.persistence.database import _get_engine

SOURCE = 'b4ccb211-71f6-4459-84cd-48dd11d18eef'
TARGET = str(uuid5(NAMESPACE_URL, 'wonderwowwall:confirmed-metal-execution-2:' + SOURCE))

async def main():
    async with _get_engine().begin() as connection:
        row = (await connection.execute(text('SELECT * FROM panel_variants WHERE id=:id FOR UPDATE'), {'id': SOURCE})).mappings().one()
        existing = (await connection.execute(text('SELECT id FROM panel_variants WHERE id=:id'), {'id': TARGET})).scalar()
        if existing:
            assert len(row['image_paths']) == 1
            print('ALREADY_APPLIED', TARGET)
            return
        assert len(row['image_paths']) == 2, 'Source changed: stop instead of guessing'
        assert not row['design_image_paths'], 'Interior ownership needs explicit review'
        backup = Path('/opt/app/deploy-backups/confirmed-metal-execution.json')
        # This script runs in /app container, where /app is the mounted backend.
        backup = Path('/app/confirmed-metal-execution-before.json')
        assert not backup.exists(), 'Existing backup: inspect before retry'
        backup.write_text(json.dumps(dict(row), default=str, ensure_ascii=False, indent=2))
        await connection.execute(text('''INSERT INTO panel_variants
            (id,panel_id,texture_id,color_id,color_hex,image_paths,design_image_paths,is_active,created_at,updated_at,name)
            SELECT :target,panel_id,texture_id,color_id,color_hex,CAST(:images AS json),CAST('[]' AS json),is_active,created_at,now(),name
            FROM panel_variants WHERE id=:source'''),
            {'target': TARGET, 'source': SOURCE, 'images': json.dumps([row['image_paths'][1]])})
        await connection.execute(text('UPDATE panel_variants SET image_paths=CAST(:images AS json),updated_at=now() WHERE id=:source'),
            {'source': SOURCE, 'images': json.dumps([row['image_paths'][0]])})
        rows = (await connection.execute(text('SELECT id,image_paths FROM panel_variants WHERE id IN (:source,:target)'), {'source':SOURCE,'target':TARGET})).all()
        assert len(rows)==2 and all(len(r.image_paths)==1 for r in rows)
        assert {r.image_paths[0] for r in rows} == set(row['image_paths'])
    print('COMMITTED', SOURCE, TARGET)

asyncio.run(main())
