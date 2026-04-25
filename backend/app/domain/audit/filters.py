"""Phase 9 — read-side filters for the audit log.

Frozen dataclass mirrors `OrderFilters` / `UserFilters` from earlier
phases: a single object travels API → use case → repo, so adding a
new filter axis later means touching one type instead of three
parallel signatures.

Date filters are inclusive on both ends (`from <= created_at <= to`);
the API layer parses ISO-8601 dates and the repo translates to SQL
`>=` / `<=`. Page/size live on the use-case input separately because
they're presentation concerns (filtering is what changes the result
SET; pagination is how we show it).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .value_objects import AuditAction, AuditTargetType


@dataclass(frozen=True)
class AuditFilters:
    action: AuditAction | None = None
    actor_id: str | None = None
    target_type: AuditTargetType | None = None
    target_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
