"""Phase 4B regression — `SqlOrderRepository` against real aiosqlite.

The Phase 4B mapper (`_order_to_domain`) iterates `m.notes` unconditionally.
Without `selectinload(OrderModel.notes)` on the read paths, accessing
`m.notes` under `AsyncSession` triggers a lazy load — which is forbidden
in async context and crashes with `MissingGreenlet`.

The bug was originally only visible in production / e2e because every
Phase 4B unit test used `InMemoryOrderRepository` (no lazy loading).
This file reproduces the failure mode against a real async engine so the
regression is caught the next time someone tweaks the SQL queries.

Also exercises the happy path for `add_note` + re-read so the
`get_by_id → notes` round-trip is locked in.
"""
from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")
pytest.importorskip("aiosqlite")
pytest_asyncio = pytest.importorskip("pytest_asyncio")  # noqa: F841

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    create_async_engine,
)

from app.domain.order.entities import Order, OrderItem  # noqa: E402
from app.domain.order.filters import OrderFilters  # noqa: E402
from app.domain.order.value_objects import Address, OrderStatus  # noqa: E402
from app.infrastructure.persistence.database import Base  # noqa: E402
from app.infrastructure.persistence.models import UserModel  # noqa: E402
from app.infrastructure.persistence.repositories.sql import (  # noqa: E402
    SqlOrderRepository,
)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as s:
        s.add(
            UserModel(
                id="u1", email="a@b.c", password_hash="x",
                name="N", phone="", role="CUSTOMER",
            )
        )
        await s.flush()
        yield s
    await engine.dispose()


def _seed_order(id_: str = "o1", number: str = "WW-1") -> Order:
    return Order(
        id=id_,
        number=number,
        user_id="u1",
        status=OrderStatus.PLACED,
        items=[OrderItem(design_id="d", design_name="X", quantity=1, unit_price=100)],
        address=Address(city="M", street="S", building="1"),
    )


# ─── C1 regression: list paths must not lazy-load notes ──────────────


@pytest.mark.asyncio
async def test_list_by_user_does_not_trigger_lazy_load(session):
    """Customer order history endpoint must not raise MissingGreenlet."""
    repo = SqlOrderRepository(session)
    await repo.create(_seed_order())
    await session.commit()

    rows = await repo.list_by_user("u1")
    assert len(rows) == 1
    # Touching `notes` must not blow up — it's the empty list returned by
    # the mapper after `selectinload(notes)` ran with zero rows.
    assert rows[0].notes == []


@pytest.mark.asyncio
async def test_find_paginated_does_not_trigger_lazy_load(session):
    """Admin orders list (Phase 4A) must not raise MissingGreenlet either."""
    repo = SqlOrderRepository(session)
    await repo.create(_seed_order())
    await session.commit()

    items, total = await repo.find_paginated(OrderFilters())
    assert total == 1
    assert items[0].notes == []


# ─── add_note happy-path round-trip ──────────────────────────────────


@pytest.mark.asyncio
async def test_add_note_persists_and_reloads(session):
    repo = SqlOrderRepository(session)
    order = await repo.create(_seed_order())
    await session.commit()

    note = order.add_note(author_id="u1", text="Позвонил клиенту")
    await repo.add_note(order.id, note)
    await session.commit()
    # Drop ORM identity map state so the next read is a real SELECT.
    session.expire_all()

    reloaded = await repo.get_by_id(order.id)
    assert reloaded is not None
    assert [n.text for n in reloaded.notes] == ["Позвонил клиенту"]
    assert reloaded.notes[0].author_id == "u1"
