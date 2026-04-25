"""Phase 5 — `SqlUserRepository` integration tests against real aiosqlite.

Covers the new admin-panel methods:
  * `find_paginated` — filter by role/is_blocked/search; uses
    `selectinload(addresses)` so iterating `m.addresses` in the mapper
    does NOT trigger lazy IO under async (same MissingGreenlet trap as
    Phase 4B's `notes` regression).
  * `count_active_admins` — used by `BlockUserAdmin` /
    `RevokeAdminRole` to enforce the last-active-admin invariant.

Also locks in the `is_blocked` round-trip (create → update → re-read)
so a future ORM-mapping refactor that drops the column is caught.
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

from app.domain.user.entities import User  # noqa: E402
from app.domain.user.filters import UserFilters  # noqa: E402
from app.domain.user.value_objects import UserRole  # noqa: E402
from app.infrastructure.persistence.database import Base  # noqa: E402
from app.infrastructure.persistence.repositories.sql import (  # noqa: E402
    SqlUserRepository,
)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as s:
        yield s
    await engine.dispose()


def _user(
    *, id_: str, email: str, name: str = "N", phone: str = "",
    role: UserRole = UserRole.CUSTOMER, is_blocked: bool = False,
) -> User:
    return User(
        id=id_, email=email, password_hash="x", name=name, phone=phone,
        role=role, is_blocked=is_blocked,
    )


# ─── find_paginated — filter axes ────────────────────────────────────


@pytest.mark.asyncio
async def test_find_paginated_returns_all_no_filters(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="a@b.c"))
    await repo.create(_user(id_="u2", email="d@e.f"))
    await session.commit()

    items, total = await repo.find_paginated(UserFilters())
    assert total == 2
    assert {u.id for u in items} == {"u1", "u2"}


@pytest.mark.asyncio
async def test_find_paginated_filters_by_role(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="a@b.c", role=UserRole.ADMIN))
    await repo.create(_user(id_="u2", email="d@e.f", role=UserRole.CUSTOMER))
    await session.commit()

    admins, total = await repo.find_paginated(UserFilters(role=UserRole.ADMIN))
    assert total == 1
    assert admins[0].id == "u1"


@pytest.mark.asyncio
async def test_find_paginated_filters_by_blocked(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="a@b.c", is_blocked=True))
    await repo.create(_user(id_="u2", email="d@e.f", is_blocked=False))
    await session.commit()

    blocked, total = await repo.find_paginated(UserFilters(is_blocked=True))
    assert total == 1
    assert blocked[0].id == "u1"

    active, total = await repo.find_paginated(UserFilters(is_blocked=False))
    assert total == 1
    assert active[0].id == "u2"


@pytest.mark.asyncio
async def test_find_paginated_search_matches_email_name_phone(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="alice@test.ru", name="Alice"))
    await repo.create(_user(id_="u2", email="bob@test.ru", name="Bob", phone="+79991234567"))
    await repo.create(_user(id_="u3", email="carol@test.ru", name="Carol"))
    await session.commit()

    # Email match
    items, _ = await repo.find_paginated(UserFilters(search="alice"))
    assert {u.id for u in items} == {"u1"}

    # Name match (case-insensitive)
    items, _ = await repo.find_paginated(UserFilters(search="BOB"))
    assert {u.id for u in items} == {"u2"}

    # Phone match
    items, _ = await repo.find_paginated(UserFilters(search="9991234"))
    assert {u.id for u in items} == {"u2"}


@pytest.mark.asyncio
async def test_find_paginated_does_not_trigger_lazy_load_on_addresses(session):
    """Regression for the Phase 4B C1 mistake on a different relationship.

    The mapper iterates `m.addresses` unconditionally; without
    `selectinload(addresses)` the read would crash with `MissingGreenlet`
    when called against a real async engine.
    """
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="a@b.c"))
    await session.commit()

    items, _ = await repo.find_paginated(UserFilters())
    # Touching `addresses` must not blow up.
    assert items[0].addresses == []


@pytest.mark.asyncio
async def test_find_paginated_pagination(session):
    repo = SqlUserRepository(session)
    for i in range(5):
        await repo.create(_user(id_=f"u{i}", email=f"u{i}@t.r"))
    await session.commit()

    items, total = await repo.find_paginated(UserFilters(), page=2, size=2)
    assert total == 5
    assert len(items) == 2


# ─── count_active_admins ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_count_active_admins_excludes_blocked_admin(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="a1", email="a1@t.r", role=UserRole.ADMIN))
    await repo.create(_user(id_="a2", email="a2@t.r", role=UserRole.ADMIN, is_blocked=True))
    await repo.create(_user(id_="c1", email="c1@t.r"))
    await session.commit()

    # 2 admins total but only 1 active.
    assert await repo.count_admins() == 2
    assert await repo.count_active_admins() == 1


# ─── is_blocked round-trip ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_is_blocked_persists_through_create_and_update(session):
    repo = SqlUserRepository(session)
    await repo.create(_user(id_="u1", email="a@b.c"))
    await session.commit()

    user = await repo.get_by_id("u1")
    assert user.is_blocked is False

    user.block()
    await repo.update(user)
    await session.commit()
    session.expire_all()

    reloaded = await repo.get_by_id("u1")
    assert reloaded.is_blocked is True

    reloaded.unblock()
    await repo.update(reloaded)
    await session.commit()
    session.expire_all()

    final = await repo.get_by_id("u1")
    assert final.is_blocked is False
