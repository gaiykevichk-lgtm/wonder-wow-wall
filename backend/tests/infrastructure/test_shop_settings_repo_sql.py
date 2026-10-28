"""Phase 8A — `SqlShopSettingsRepository` integration tests against aiosqlite.

The unit tests already cover the singleton row's domain invariants and
the use-case PATCH semantics; this file pins the SQL repo end-to-end
(create_all → seed → get → update → re-read) so a future ORM-mapping
refactor that drops a column or breaks the singleton lookup is caught
without having to run alembic. Same pattern as `test_user_repo_sql.py`
(Phase 5) and `test_order_repo_sql.py` (Phase 4B).

Notes:
  * `Base.metadata.create_all` builds the schema from the SQLAlchemy
    models, NOT from the alembic migration. The alembic suite covers
    the migration path; this file pins the runtime path.
  * The seed insert mirrors `012_create_shop_settings`'s `bulk_insert`
    so the test's starting state matches a freshly-migrated DB.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

pytest.importorskip("sqlalchemy")
pytest.importorskip("aiosqlite")
pytest_asyncio = pytest.importorskip("pytest_asyncio")  # noqa: F841

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    create_async_engine,
)

from app.domain.shop.settings import (  # noqa: E402
    SHOP_SETTINGS_SINGLETON_ID,
    ShopSettings,
)
from app.infrastructure.persistence.database import Base  # noqa: E402
from app.infrastructure.persistence.models import ShopSettingsModel  # noqa: E402
from app.infrastructure.persistence.repositories.sql import (  # noqa: E402
    SqlShopSettingsRepository,
)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as s:
        # Seed the singleton row exactly like migration 012 does.
        s.add(
            ShopSettingsModel(
                id=SHOP_SETTINGS_SINGLETON_ID,
                design_overlay_price=1200,
                installation_price=0,
                min_order_amount=0,
                updated_at=datetime.utcnow(),
            )
        )
        await s.commit()
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_returns_seeded_singleton(session):
    repo = SqlShopSettingsRepository(session)

    out = await repo.get()

    assert out.id == SHOP_SETTINGS_SINGLETON_ID
    assert out.design_overlay_price == 1200
    assert out.installation_price == 0
    assert out.min_order_amount == 0


@pytest.mark.asyncio
async def test_update_persists_all_fields(session):
    repo = SqlShopSettingsRepository(session)
    new_ts = datetime.utcnow() + timedelta(seconds=1)

    patched = ShopSettings(
        id=SHOP_SETTINGS_SINGLETON_ID,
        design_overlay_price=1500,
        installation_price=200,
        min_order_amount=5000,
        updated_at=new_ts,
    )
    await repo.update(patched)
    await session.commit()

    re_read = await repo.get()
    assert re_read.design_overlay_price == 1500
    assert re_read.installation_price == 200
    assert re_read.min_order_amount == 5000
    # SQLite drops sub-second precision in some configs; compare to the
    # whole-second floor to keep the assertion stable.
    assert int(re_read.updated_at.timestamp()) == int(new_ts.timestamp())


@pytest.mark.asyncio
async def test_get_raises_if_singleton_missing(session):
    # Simulate a deploy that forgot to run migration 012.
    await session.execute(
        ShopSettingsModel.__table__.delete().where(
            ShopSettingsModel.id == SHOP_SETTINGS_SINGLETON_ID
        )
    )
    await session.commit()
    repo = SqlShopSettingsRepository(session)

    with pytest.raises(RuntimeError, match="shop_settings singleton row is missing"):
        await repo.get()


@pytest.mark.asyncio
async def test_update_raises_if_row_missing(session):
    await session.execute(
        ShopSettingsModel.__table__.delete().where(
            ShopSettingsModel.id == SHOP_SETTINGS_SINGLETON_ID
        )
    )
    await session.commit()
    repo = SqlShopSettingsRepository(session)

    with pytest.raises(RuntimeError, match="missing on update"):
        await repo.update(ShopSettings(id=SHOP_SETTINGS_SINGLETON_ID))
