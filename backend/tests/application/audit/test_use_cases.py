"""Phase 9 — `RecordAuditEntry` and `ListAuditEntries` use cases.

Uses the in-memory repo (no DB). Pins:
  * Recording stamps id + created_at, persists, returns the entity.
  * Listing applies filters + page-size clamp + DESC sort.
  * Pagination clamps `page < 1` to 1 and `size > MAX` to MAX.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.application.audit.use_cases import ListAuditEntries, RecordAuditEntry
from app.domain.audit.entities import AuditEntry
from app.domain.audit.filters import AuditFilters
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
)


@pytest.mark.asyncio
async def test_record_persists_and_returns_entry():
    repo = InMemoryAuditEntryRepository()
    uc = RecordAuditEntry(repo)

    e = await uc.execute(
        actor_id="admin-1",
        action=AuditAction.USER_BLOCK,
        target_type=AuditTargetType.USER,
        target_id="user-42",
        payload={"reason": "spam"},
        ip="10.0.0.1",
    )

    assert e.id
    assert e.actor_id == "admin-1"
    assert e.action == AuditAction.USER_BLOCK
    assert e.target_id == "user-42"
    assert e.payload == {"reason": "spam"}
    assert len(repo._entries) == 1


@pytest.mark.asyncio
async def test_list_orders_desc_by_created_at():
    repo = InMemoryAuditEntryRepository()
    base = datetime(2026, 1, 1, 12, 0, 0)
    repo._entries.extend([
        AuditEntry(
            id="a", actor_id="x", action=AuditAction.USER_BLOCK,
            created_at=base,
        ),
        AuditEntry(
            id="b", actor_id="x", action=AuditAction.USER_BLOCK,
            created_at=base + timedelta(seconds=1),
        ),
    ])
    uc = ListAuditEntries(repo)

    rows, total = await uc.execute(AuditFilters())

    assert total == 2
    assert [r.id for r in rows] == ["b", "a"]


@pytest.mark.asyncio
async def test_list_filters_by_actor_and_target():
    repo = InMemoryAuditEntryRepository()
    repo._entries.extend([
        AuditEntry(
            actor_id="admin-1", action=AuditAction.USER_BLOCK,
            target_type=AuditTargetType.USER, target_id="u1",
        ),
        AuditEntry(
            actor_id="admin-2", action=AuditAction.USER_BLOCK,
            target_type=AuditTargetType.USER, target_id="u1",
        ),
        AuditEntry(
            actor_id="admin-1", action=AuditAction.ORDER_STATUS_CHANGE,
            target_type=AuditTargetType.ORDER, target_id="o1",
        ),
    ])
    uc = ListAuditEntries(repo)

    rows, total = await uc.execute(AuditFilters(actor_id="admin-1"))
    assert total == 2

    rows, total = await uc.execute(
        AuditFilters(target_type=AuditTargetType.USER, target_id="u1")
    )
    assert total == 2
    assert {r.actor_id for r in rows} == {"admin-1", "admin-2"}


@pytest.mark.asyncio
async def test_list_clamps_pagination():
    repo = InMemoryAuditEntryRepository()
    for i in range(10):
        repo._entries.append(
            AuditEntry(actor_id="x", action=AuditAction.USER_BLOCK)
        )
    uc = ListAuditEntries(repo)

    # page < 1 → page = 1
    rows, _ = await uc.execute(AuditFilters(), page=0, size=3)
    assert len(rows) == 3

    # size > MAX → MAX
    rows, _ = await uc.execute(AuditFilters(), page=1, size=10000)
    assert len(rows) == 10  # all 10, capped only by data


@pytest.mark.asyncio
async def test_list_filters_by_action_and_date_range():
    repo = InMemoryAuditEntryRepository()
    base = datetime(2026, 1, 1)
    repo._entries.extend([
        AuditEntry(
            actor_id="x", action=AuditAction.USER_BLOCK,
            created_at=base + timedelta(days=1),
        ),
        AuditEntry(
            actor_id="x", action=AuditAction.SETTINGS_UPDATE,
            created_at=base + timedelta(days=2),
        ),
        AuditEntry(
            actor_id="x", action=AuditAction.USER_BLOCK,
            created_at=base + timedelta(days=10),
        ),
    ])
    uc = ListAuditEntries(repo)

    rows, total = await uc.execute(AuditFilters(action=AuditAction.USER_BLOCK))
    assert total == 2

    rows, total = await uc.execute(
        AuditFilters(
            date_from=base + timedelta(days=2),
            date_to=base + timedelta(days=5),
        )
    )
    assert total == 1
    assert rows[0].action == AuditAction.SETTINGS_UPDATE
