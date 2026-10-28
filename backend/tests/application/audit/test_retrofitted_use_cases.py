"""Phase 9 — regression tests for retrofitted admin use cases.

Each retrofitted use case must:
  * accept an `audit_recorder` collaborator (optional, defaults None).
  * call `audit_recorder.execute(...)` with the correct action +
    target after the action persists.
  * remain backward-compatible when `audit_recorder=None` is passed
    (existing tests construct use cases without it).

We assert against an `InMemoryAuditEntryRepository` directly rather than
mocking the collaborator: the in-memory repo already mirrors the SQL
implementation field-for-field, so a passing regression here also pins
the SQL-roundtrip semantics.
"""
from __future__ import annotations

import pytest

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.panel_use_cases import DeletePanelAdmin
from app.application.order.use_cases import (
    AddOrderNoteAdmin,
    UpdateOrderStatusAdmin,
)
from app.application.shop.settings_use_cases import UpdateShopSettingsAdmin
from app.application.user.use_cases import (
    BlockUserAdmin,
    GrantAdminRole,
    RevokeAdminRole,
    UnblockUserAdmin,
)
from app.domain.audit.filters import AuditFilters
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.panel import Panel
from app.domain.catalog.value_objects import PanelSize
from app.domain.order.entities import Order
from app.domain.order.value_objects import OrderStatus
from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole
from app.infrastructure.persistence.repositories.memory import (
    InMemoryAuditEntryRepository,
    InMemoryOrderRepository,
    InMemoryPanelRepository,
    InMemoryShopSettingsRepository,
    InMemoryUserRepository,
)


# ─── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def audit_repo():
    return InMemoryAuditEntryRepository()


@pytest.fixture
def recorder(audit_repo):
    return RecordAuditEntry(audit_repo)


async def _all_entries(repo):
    rows, _ = await repo.find_paginated(AuditFilters(), offset=0, limit=100)
    return rows


# ─── User use cases ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_block_user_records_audit_entry(audit_repo, recorder):
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T")
    repo._users.extend([admin, target])

    await BlockUserAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    e = entries[0]
    assert e.actor_id == "admin-1"
    assert e.action is AuditAction.USER_BLOCK
    assert e.target_type is AuditTargetType.USER
    assert e.target_id == "u-1"
    assert e.payload["email"] == "t@x"


@pytest.mark.asyncio
async def test_block_user_idempotent_no_audit(audit_repo, recorder):
    """Re-blocking an already-blocked user must NOT pollute the audit log."""
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T", is_blocked=True)
    repo._users.extend([admin, target])

    await BlockUserAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    assert await _all_entries(audit_repo) == []


@pytest.mark.asyncio
async def test_unblock_user_records_audit_entry(audit_repo, recorder):
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T", is_blocked=True)
    repo._users.extend([admin, target])

    await UnblockUserAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].action is AuditAction.USER_UNBLOCK
    assert entries[0].target_id == "u-1"


@pytest.mark.asyncio
async def test_unblock_user_idempotent_no_audit(audit_repo, recorder):
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T", is_blocked=False)
    repo._users.extend([admin, target])

    await UnblockUserAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    assert await _all_entries(audit_repo) == []


@pytest.mark.asyncio
async def test_grant_admin_records_audit_entry(audit_repo, recorder):
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T")
    repo._users.extend([admin, target])

    await GrantAdminRole(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].action is AuditAction.ROLE_GRANT
    assert entries[0].actor_id == "admin-1"
    assert entries[0].target_id == "u-1"


@pytest.mark.asyncio
async def test_grant_admin_already_admin_no_audit(audit_repo, recorder):
    """Re-granting on a user who's already admin is a no-op for the log."""
    repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T", role=UserRole.ADMIN)
    repo._users.extend([admin, target])

    await GrantAdminRole(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    assert await _all_entries(audit_repo) == []


@pytest.mark.asyncio
async def test_revoke_admin_records_audit_entry(audit_repo, recorder):
    repo = InMemoryUserRepository()
    admin1 = User(id="admin-1", email="a1@x", password_hash="p", name="A1", role=UserRole.ADMIN)
    admin2 = User(id="admin-2", email="a2@x", password_hash="p", name="A2", role=UserRole.ADMIN)
    repo._users.extend([admin1, admin2])

    await RevokeAdminRole(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="admin-2",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].action is AuditAction.ROLE_REVOKE
    assert entries[0].target_id == "admin-2"


# ─── Order use cases ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_order_status_records_audit_entry(audit_repo, recorder):
    repo = InMemoryOrderRepository()
    repo._orders.append(Order(id="o-1", status=OrderStatus.PLACED, user_id="u-1"))

    await UpdateOrderStatusAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1",
        order_id="o-1",
        new_status=OrderStatus.CONFIRMED,
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    e = entries[0]
    assert e.action is AuditAction.ORDER_STATUS_CHANGE
    assert e.target_type is AuditTargetType.ORDER
    assert e.target_id == "o-1"
    # Payload should record the from/to transition for forensics.
    assert e.payload["from"] == OrderStatus.PLACED.value
    assert e.payload["to"] == OrderStatus.CONFIRMED.value


@pytest.mark.asyncio
async def test_refund_uses_distinct_audit_action(audit_repo, recorder):
    """REFUNDED transitions get their own action key (money-mover events)."""
    repo = InMemoryOrderRepository()
    # Walk the order to DELIVERED so the REFUNDED transition is legal.
    repo._orders.append(Order(id="o-1", status=OrderStatus.DELIVERED, user_id="u-1"))

    await UpdateOrderStatusAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1",
        order_id="o-1",
        new_status=OrderStatus.REFUNDED,
        reason="Не подошло",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].action is AuditAction.ORDER_REFUND
    assert entries[0].payload["reason"] == "Не подошло"


@pytest.mark.asyncio
async def test_add_order_note_records_audit_entry(audit_repo, recorder):
    repo = InMemoryOrderRepository()
    repo._orders.append(Order(id="o-1", status=OrderStatus.PLACED, user_id="u-1"))

    await AddOrderNoteAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1",
        order_id="o-1",
        text="Internal note",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].action is AuditAction.ORDER_NOTE_ADD
    assert entries[0].target_id == "o-1"
    assert entries[0].payload["text_preview"] == "Internal note"


@pytest.mark.asyncio
async def test_add_order_note_truncates_long_text_in_payload(audit_repo, recorder):
    """Audit payload caps text at 200 chars to keep rows compact."""
    repo = InMemoryOrderRepository()
    repo._orders.append(Order(id="o-1", status=OrderStatus.PLACED, user_id="u-1"))

    long_text = "x" * 500
    await AddOrderNoteAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1", order_id="o-1", text=long_text,
    )

    entries = await _all_entries(audit_repo)
    assert len(entries[0].payload["text_preview"]) == 200


# ─── Shop settings ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_settings_update_records_diff(audit_repo, recorder):
    repo = InMemoryShopSettingsRepository()
    # Capture the BEFORE value as a primitive — `repo.get()` returns the
    # live object which the use case mutates in place, so holding a
    # reference to the entity wouldn't pin the pre-update value.
    seeded_installation_price = (await repo.get()).installation_price

    await UpdateShopSettingsAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1",
        installation_price=9999,
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    e = entries[0]
    assert e.action is AuditAction.SETTINGS_UPDATE
    assert e.target_type is AuditTargetType.SETTINGS
    # Diff records only the changed field — design_overlay_price /
    # min_order_amount were untouched and must be absent from changes.
    assert "installation_price" in e.payload["changes"]
    assert e.payload["changes"]["installation_price"] == {
        "from": seeded_installation_price, "to": 9999,
    }
    assert "design_overlay_price" not in e.payload["changes"]


@pytest.mark.asyncio
async def test_settings_update_no_change_no_audit(audit_repo, recorder):
    """Re-submitting the same value must NOT produce an audit entry."""
    repo = InMemoryShopSettingsRepository()
    seeded_installation_price = (await repo.get()).installation_price

    await UpdateShopSettingsAdmin(repo, audit_recorder=recorder).execute(
        actor_id="admin-1",
        installation_price=seeded_installation_price,
    )

    assert await _all_entries(audit_repo) == []


# ─── Panel CRUD (Phase 7B) ───────────────────────────────────────────


def _seed_panel(repo: InMemoryPanelRepository) -> Panel:
    panel = Panel(
        id="p-1",
        name="Smooth 30",
        slug="smooth-30",
        size=PanelSize(width_mm=300, height_mm=300, label="30×30"),
        base_price=1500,
    )
    repo._panels.append(panel)
    return panel


@pytest.mark.asyncio
async def test_delete_panel_records_audit_entry(audit_repo, recorder):
    repo = InMemoryPanelRepository()
    _seed_panel(repo)

    deleted = await DeletePanelAdmin(repo, audit_recorder=recorder).execute(
        "p-1", actor_id="admin-1",
    )
    assert deleted is True

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    e = entries[0]
    assert e.action is AuditAction.PANEL_DELETE
    assert e.target_type is AuditTargetType.PANEL
    assert e.target_id == "p-1"
    # Payload pins name+slug for forensic readability — the row itself
    # is gone after delete(), so reconstructing them later is impossible.
    assert e.payload == {"name": "Smooth 30", "slug": "smooth-30"}


@pytest.mark.asyncio
async def test_delete_panel_missing_skips_audit(audit_repo, recorder):
    """A delete that hits no row must NOT produce an audit entry —
    there's nothing to attribute it to."""
    repo = InMemoryPanelRepository()

    deleted = await DeletePanelAdmin(repo, audit_recorder=recorder).execute(
        "missing", actor_id="admin-1",
    )
    assert deleted is False
    assert await _all_entries(audit_repo) == []


@pytest.mark.asyncio
async def test_delete_panel_without_actor_skips_audit(audit_repo, recorder):
    """No actor_id ⇒ no audit row (entity invariant rejects empty actor).

    Caller is the legacy/CLI path that pre-dates Phase 9 — they still
    delete successfully, just without an audit trail. Mirrors the
    `audit_recorder is None` branch.
    """
    repo = InMemoryPanelRepository()
    _seed_panel(repo)

    deleted = await DeletePanelAdmin(repo, audit_recorder=recorder).execute(
        "p-1",
    )
    assert deleted is True
    assert await _all_entries(audit_repo) == []


# ─── IP propagation via RecordAuditEntry.request_ip ───────────────────


@pytest.mark.asyncio
async def test_recorder_stamps_request_ip_on_entries(audit_repo):
    """Bind an IP at construction → it lands on every entry the
    recorder writes, without the use case needing to know about HTTP."""
    bound_recorder = RecordAuditEntry(audit_repo, request_ip="203.0.113.42")
    user_repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T")
    user_repo._users.extend([admin, target])

    await BlockUserAdmin(user_repo, audit_recorder=bound_recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    entries = await _all_entries(audit_repo)
    assert len(entries) == 1
    assert entries[0].ip == "203.0.113.42"


@pytest.mark.asyncio
async def test_recorder_request_ip_default_is_none(audit_repo, recorder):
    """No bound IP → entry.ip is None (matches the entity default)."""
    user_repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T")
    user_repo._users.extend([admin, target])

    await BlockUserAdmin(user_repo, audit_recorder=recorder).execute(
        actor_id="admin-1", target_user_id="u-1",
    )

    entries = await _all_entries(audit_repo)
    assert entries[0].ip is None


# ─── Backward compatibility ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_use_cases_work_without_audit_recorder():
    """All retrofitted use cases must still work when audit_recorder is None.

    Prior tests that don't pass the collaborator (e.g. the Phase 4B/5
    test files) cover this implicitly; this test pins it explicitly so a
    future refactor that makes `audit_recorder` mandatory fails fast here
    instead of in dozens of unrelated tests.
    """
    user_repo = InMemoryUserRepository()
    admin = User(id="admin-1", email="a@x", password_hash="p", name="A", role=UserRole.ADMIN)
    target = User(id="u-1", email="t@x", password_hash="p", name="T")
    user_repo._users.extend([admin, target])
    # No audit_recorder kwarg — no AttributeError, no exception.
    await BlockUserAdmin(user_repo).execute(
        actor_id="admin-1", target_user_id="u-1",
    )
    assert (await user_repo.get_by_id("u-1")).is_blocked
