"""Phase 9 — admin audit-log read endpoint.

* `GET /api/admin/audit?action=&actor_id=&target_type=&target_id=&from=&to=&page=&size=`
  — paginated audit list, DESC by `created_at`. Auth-gated to admins.

There is intentionally no write endpoint — entries are produced by
the retrofitted admin use cases via the `RecordAuditEntry`
collaborator (write-side hidden behind the actions that produce them
keeps the log trustworthy).

Date filters accept ISO-8601 strings; FastAPI/Pydantic parses them to
`datetime`. `?from=2026-04-01&to=2026-04-30` is inclusive on both
ends (matches the use-case + repo semantics).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.application.audit.use_cases import MAX_PAGE_SIZE, ListAuditEntries
from app.container import get_audit_repo
from app.domain.audit.entities import AuditEntry
from app.domain.audit.filters import AuditFilters
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────


class AuditEntryResponse(BaseModel):
    id: str
    actor_id: str
    action: str
    target_type: str | None
    target_id: str | None
    payload: dict[str, Any]
    ip: str | None
    created_at: str


class AuditListResponse(BaseModel):
    items: list[AuditEntryResponse]
    total: int
    page: int
    size: int


def _to_response(e: AuditEntry) -> AuditEntryResponse:
    return AuditEntryResponse(
        id=e.id,
        actor_id=e.actor_id,
        action=e.action.value,
        target_type=e.target_type.value if e.target_type else None,
        target_id=e.target_id,
        payload=e.payload,
        ip=e.ip,
        created_at=e.created_at.isoformat(),
    )


# ─── Endpoint ────────────────────────────────────────────────────────


@router.get("/audit", response_model=AuditListResponse)
async def list_audit_entries(
    action: AuditAction | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    target_type: AuditTargetType | None = Query(default=None),
    target_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=MAX_PAGE_SIZE),
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_audit_repo),
):
    filters = AuditFilters(
        action=action,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
        date_from=date_from,
        date_to=date_to,
    )
    rows, total = await ListAuditEntries(repo).execute(
        filters, page=page, size=size,
    )
    return AuditListResponse(
        items=[_to_response(r) for r in rows],
        total=total,
        page=page,
        size=size,
    )
