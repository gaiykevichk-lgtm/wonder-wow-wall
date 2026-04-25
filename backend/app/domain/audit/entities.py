"""Phase 9 — `AuditEntry` aggregate.

Append-only log row. Each entry captures:
  * `actor_id`   — the admin who performed the action (string user id);
                   special value `"system"` is reserved for actions
                   triggered by background jobs / migrations / the
                   initial admin bootstrap (mirrors the Phase 1
                   `GrantAdminRole.SYSTEM_ACTOR` constant).
  * `action`     — the AuditAction enum (closed vocabulary).
  * `target_type` / `target_id` — what was acted upon. Both are
                   optional because some actions (e.g., a future
                   `EXPORT_USERS`) have no single target.
  * `payload`    — JSON-serialisable dict with whatever extra
                   diagnostic detail the call site wants to keep
                   (e.g., old/new status for ORDER_STATUS_CHANGE).
                   The use case is responsible for masking sensitive
                   fields BEFORE handing the dict here — the entity
                   trusts whatever it gets.
  * `ip`         — request IP, captured at the API layer. Optional
                   (use cases triggered outside an HTTP request, like
                   migrations, leave it None).
  * `created_at` — UTC; set at construction so the timestamp matches
                   when the action ran, not when the row was flushed.

Invariants enforced in `__post_init__`:
  * `actor_id` non-empty (an unattributed entry is useless).
  * If `target_id` is set, `target_type` MUST also be set (the
    converse is allowed — a typed action without a specific target,
    e.g., a settings update where target_id == "singleton" is also
    fine, but typedness without identity is a modelling bug).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

from .value_objects import AuditAction, AuditTargetType


SYSTEM_ACTOR = "system"


@dataclass
class AuditEntry:
    """Single append-only audit row."""

    id: str = field(default_factory=lambda: str(uuid4()))
    actor_id: str = ""
    action: AuditAction = AuditAction.USER_BLOCK
    target_type: AuditTargetType | None = None
    target_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    ip: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.actor_id:
            raise ValueError("AuditEntry.actor_id must not be empty")
        if self.target_id is not None and self.target_type is None:
            raise ValueError(
                "AuditEntry.target_type must be set when target_id is set"
            )
