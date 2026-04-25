"""Phase 9 — `AuditEntry` invariants.

Pins the construction-time guards so a future refactor of the entity
that loosens validation is caught. Round-trips defaults so a missed
`field(default_factory=...)` doesn't silently break entries built
with positional args.
"""
from __future__ import annotations

import pytest

from app.domain.audit.entities import SYSTEM_ACTOR, AuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType


def test_defaults_set_id_and_created_at():
    e = AuditEntry(actor_id="u1", action=AuditAction.USER_BLOCK)
    assert e.id  # uuid populated
    assert e.created_at is not None
    assert e.payload == {}
    assert e.target_type is None
    assert e.target_id is None
    assert e.ip is None


def test_actor_id_required():
    with pytest.raises(ValueError, match="actor_id"):
        AuditEntry(actor_id="", action=AuditAction.USER_BLOCK)


def test_target_id_without_type_rejected():
    with pytest.raises(ValueError, match="target_type"):
        AuditEntry(
            actor_id="u1",
            action=AuditAction.USER_BLOCK,
            target_id="user-42",
            target_type=None,
        )


def test_target_type_without_id_is_legal():
    # A SETTINGS_UPDATE without a specific target_id (singleton row)
    # is valid — typedness without identity is allowed.
    e = AuditEntry(
        actor_id="u1",
        action=AuditAction.SETTINGS_UPDATE,
        target_type=AuditTargetType.SETTINGS,
        target_id=None,
    )
    assert e.target_type == AuditTargetType.SETTINGS


def test_system_actor_constant_is_valid_actor_id():
    e = AuditEntry(actor_id=SYSTEM_ACTOR, action=AuditAction.ROLE_GRANT)
    assert e.actor_id == "system"
