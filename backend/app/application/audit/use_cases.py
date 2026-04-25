"""Phase 9 — application use cases for the audit log.

Two use cases live here:

* `RecordAuditEntry` — write side. Injected into every retrofitted
  admin use case as a collaborator (constructor arg) and called
  inline at the end of `execute()` AFTER the domain change has been
  persisted (we don't want an audit row that points to a state that
  never made it to the DB). The collaborator pattern beats a global
  decorator because:
    – it keeps the dependency in the use case constructor, so tests
      can swap a fake recorder without monkeypatching;
    – it sidesteps the actor_id-extraction problem a decorator would
      face (existing use cases already accept `actor_id` as the
      first positional arg — see `BlockUserAdmin`, `GrantAdminRole`,
      `UpdateOrderStatusAdmin`).

* `ListAuditEntries` — read side. Wraps the repo's paginated
  `find_paginated` with the pagination-clamping that other
  ListAdmin use cases enforce (`offset >= 0`, `1 <= limit <= 200`).
  The auth gate is at the API layer (`get_current_admin_id`).
"""
from __future__ import annotations

from typing import Any

from app.domain.audit.entities import AuditEntry
from app.domain.audit.filters import AuditFilters
from app.domain.audit.repositories import AuditEntryRepository
from app.domain.audit.value_objects import AuditAction, AuditTargetType


# Hard cap mirrors `ListUsersAdmin` / `ListOrdersAdmin` — keeps a
# pathological `?limit=999999` from materialising a giant page.
_MAX_PAGE_SIZE = 200


class RecordAuditEntry:
    """Write-side: persist one `AuditEntry`.

    The use case is intentionally thin — it constructs the entity (so
    invariants run) and forwards to the repo. Callers pass the action
    + actor + (optional) target + payload; the entity stamps the id
    and `created_at`. Returning the persisted entity helps tests
    assert against the auto-generated fields without re-querying.

    `request_ip` is bound at construction time (i.e. by the API layer
    where `Request.client.host` is reachable) and stamped onto every
    entry produced by this recorder unless the call site overrides it
    via `execute(..., ip=...)`. Doing the binding on the recorder
    (rather than threading `ip` through every retrofitted use case)
    keeps the application layer ignorant of HTTP — the use case sees
    a `RecordAuditEntry` collaborator and never has to know an IP
    even exists.
    """

    def __init__(
        self,
        audit_repo: AuditEntryRepository,
        *,
        request_ip: str | None = None,
    ):
        self.repo = audit_repo
        self.request_ip = request_ip

    async def execute(
        self,
        *,
        actor_id: str,
        action: AuditAction,
        target_type: AuditTargetType | None = None,
        target_id: str | None = None,
        payload: dict[str, Any] | None = None,
        ip: str | None = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload or {},
            # Per-call `ip` wins so a caller can stamp a different
            # source (e.g., a background reconciliation job that
            # records the originating webhook IP). Default falls back
            # to the bound `request_ip` from the recorder.
            ip=ip if ip is not None else self.request_ip,
        )
        return await self.repo.append(entry)


class ListAuditEntries:
    """Read-side: paginated audit log for the admin UI.

    Auth is handled at the API layer; this use case is a thin
    coordinator. Returns `(rows, total)` so the API can build the
    standard `{items, total, page, size}` envelope without a
    separate count call.
    """

    def __init__(self, audit_repo: AuditEntryRepository):
        self.repo = audit_repo

    async def execute(
        self,
        filters: AuditFilters,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[AuditEntry], int]:
        page = max(page, 1)
        size = max(1, min(size, _MAX_PAGE_SIZE))
        offset = (page - 1) * size
        return await self.repo.find_paginated(
            filters, offset=offset, limit=size,
        )
