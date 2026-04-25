"""Phase 9 — repository ABC for the audit log.

Append-only contract: `append()` writes one row; there is intentionally
no `update` or `delete` method — modifying audit history would defeat
its purpose. The read side is `find_paginated()` only; individual
get-by-id is unnecessary for the admin UI (entries are listed with
inline detail).

The implementations live in `infrastructure/persistence/repositories/`
and follow the same in-memory-vs-SQL split as the rest of the project.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from .entities import AuditEntry
from .filters import AuditFilters


class AuditEntryRepository(ABC):
    @abstractmethod
    async def append(self, entry: AuditEntry) -> AuditEntry:
        """Persist a new entry. Append-only — never overwrites."""

    @abstractmethod
    async def find_paginated(
        self,
        filters: AuditFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[AuditEntry], int]:
        """Return `(rows, total)` ordered by `created_at desc`.

        The DESC sort is the obvious read pattern — admins want
        most-recent-first when investigating an incident. The composite
        index `(target_type, target_id, created_at)` from migration
        `013` covers the common "show all events for this user/order"
        query without a filesort.
        """
