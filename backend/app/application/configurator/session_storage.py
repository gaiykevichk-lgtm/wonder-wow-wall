import json
from sqlalchemy import text
from app.config import settings
from app.infrastructure.persistence.database import async_session

async def load_session(session_id):
    if settings.USE_MEMORY_REPOS:
        return None
    async with async_session() as db:
        if db is None:
            raise RuntimeError("Для хранения сессий требуется PostgreSQL")
        result = await db.execute(text("SELECT payload FROM configurator_sessions WHERE id=:id"), {"id": session_id})
        return result.scalar_one_or_none()

async def save_session(session):
    if settings.USE_MEMORY_REPOS:
        return  # existing test-only repositories
    async with async_session() as db:
        if db is None:
            raise RuntimeError("Для хранения сессий требуется PostgreSQL")
        await db.execute(text("INSERT INTO configurator_sessions(id,payload) VALUES (:id,CAST(:payload AS json)) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload"), {"id": session.id, "payload": json.dumps({"id": session.id, "photo_path": session.photo_path, "photo_url": session.photo_url, "created_at": session.created_at, "answers": session.answers, "proposals": session.proposals})})
        await db.commit()
