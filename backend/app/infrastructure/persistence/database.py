from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Don't create engine at import time when using in-memory repos (no DB required).
# This allows `uvicorn app.main:app` to boot with USE_MEMORY_REPOS=true without
# needing postgres running.
_engine = None
_async_session = None

def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
    return _engine

def _get_async_sessionmaker():
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _async_session


class Base(DeclarativeBase):
    pass


async def get_db():
    # Skip DB entirely when in-memory repos are active
    if settings.USE_MEMORY_REPOS:
        return
    async with _get_async_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def async_session():
    """Async context manager — yields a real session or None when in-memory repos are active."""
    if settings.USE_MEMORY_REPOS:
        yield None
        return
    session = _get_async_sessionmaker()()
    try:
        async with session:
            yield session
    except Exception:
        await session.rollback()
        raise
