"""Phase 10 — `Recommendation` aggregate (manual «с этим покупают»).

A `Recommendation` is the admin-curated list of products the customer
sees in the «recommended» rail on a product detail page. Replaces the
client-only heuristic (filter by `category_id`, `slice(0, 3)`) that
lived in `frontend/src/domains/catalog/ui/ProductPage.tsx:96–107`.

Aggregate shape:
  * Source = (source_type, source_id) — the product the customer is
    currently viewing (`DESIGN` or `PANEL`).
  * Targets = ordered list of `RecommendationTarget` VOs — what to
    suggest next, in display order.

Why a single aggregate (`Recommendation`) instead of many flat rows
keyed by (source, target):
  * Position is per-source — reorder is a single operation on the
    aggregate, not a transaction across N rows.
  * The limit (`recommendations_limit_per_source` from `ShopSettings`)
    is enforced at the aggregate boundary; flat rows would scatter the
    invariant.
  * Targets are *value* objects — they have no identity outside the
    aggregate, so persisting them as a child collection (FK back to
    `recommendations.id` in the `recommendation_targets` table) is the
    natural ORM mapping.

Cross-type recommendations are intentional:
  * For a `DESIGN` source, an admin may want to recommend `PANEL`s
    (e.g., "this print works best on the 30×60 brick panel") AND other
    designs (similar style). `RecommendationTargetType` is independent
    from `RecommendationSourceType` so all four (DESIGN→DESIGN,
    DESIGN→PANEL, PANEL→DESIGN, PANEL→PANEL) combinations are legal.

Invariants enforced inside the aggregate (not the use case):
  * `(source_type, source_id) != (target_type, target_id)` — a product
    cannot recommend itself. Surfaced as `SelfRecommendationError`.
  * No duplicate `(target_type, target_id)` within the same
    aggregate — surfaced as `DuplicateRecommendationTargetError`.
  * `len(targets) <= limit` — surfaced as
    `RecommendationLimitExceededError`. Limit is *injected* (default
    parameter on the mutators) because it is admin-tunable via
    `ShopSettings.recommendations_limit_per_source` — hard-coding here
    would mean the entity has to know about a sibling aggregate.

Position ordering:
  * `targets` is the canonical order — the list index IS the display
    order. We do NOT store an explicit `position` int in the VO because
    the list order is authoritative and a reordered list with stale
    `position` values is the most common consistency bug in this kind
    of model. The persistence layer reads/writes `position = index`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import uuid4


class RecommendationSourceType(str, Enum):
    """The product family the recommendation is *attached to*."""

    DESIGN = "design"
    PANEL = "panel"


class RecommendationTargetType(str, Enum):
    """The product family of the *recommended* item.

    Independent of `SourceType` — see module docstring for cross-type
    rationale.
    """

    DESIGN = "design"
    PANEL = "panel"


# Default cap, mirrored on `ShopSettings.recommendations_limit_per_source`.
# Lives here as the floor used by tests / in-memory fakes that don't
# spin up a full settings repo.
DEFAULT_RECOMMENDATIONS_LIMIT = 12


@dataclass(frozen=True)
class RecommendationTarget:
    """Value object inside the `Recommendation` aggregate.

    Frozen so the aggregate's `targets` list cannot be mutated through
    a leaked reference; mutators on `Recommendation` always rebuild the
    list. Identity is `(target_type, target_id)` — equality semantics
    that the dedup check inside the aggregate relies on.
    """

    target_type: RecommendationTargetType
    target_id: str


@dataclass
class Recommendation:
    """Aggregate Root for the admin-curated recommendations rail.

    Identity is `(source_type, source_id)` — the persistence layer
    enforces UNIQUE on that pair. We still carry an `id` (uuid) so
    cascade-cleanup queries can delete by FK without resolving the
    composite key.
    """

    source_type: RecommendationSourceType
    source_id: str
    targets: list[RecommendationTarget] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid4()))
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if not self.source_id:
            raise ValueError("Recommendation.source_id must not be empty")
        # Deduplicate at construction time so a malformed seed/migration
        # cannot enter the system. Same defence-in-depth idea as
        # `Panel.__post_init__` invariants. We re-validate the full set
        # here (not just the constructor input) because callers can
        # bypass `add_target` by passing `targets=[...]` directly.
        seen: set[tuple[RecommendationTargetType, str]] = set()
        for t in self.targets:
            self._guard_self_reference(t)
            key = (t.target_type, t.target_id)
            if key in seen:
                raise DuplicateRecommendationTargetError(
                    f"Duplicate target {t.target_type.value}:{t.target_id}"
                )
            seen.add(key)

    # ─── Mutators ────────────────────────────────────────────────────

    def add_target(
        self,
        target: RecommendationTarget,
        *,
        limit: int = DEFAULT_RECOMMENDATIONS_LIMIT,
    ) -> None:
        """Append a target. Position = current length."""
        self._guard_self_reference(target)
        if any(
            t.target_type == target.target_type and t.target_id == target.target_id
            for t in self.targets
        ):
            raise DuplicateRecommendationTargetError(
                f"Target {target.target_type.value}:{target.target_id} already present"
            )
        if len(self.targets) >= limit:
            raise RecommendationLimitExceededError(
                f"Cannot exceed {limit} recommendations per source"
            )
        self.targets.append(target)
        self.updated_at = datetime.utcnow()

    def remove_target(
        self, target_type: RecommendationTargetType, target_id: str,
    ) -> None:
        for i, t in enumerate(self.targets):
            if t.target_type == target_type and t.target_id == target_id:
                del self.targets[i]
                self.updated_at = datetime.utcnow()
                return
        raise RecommendationTargetNotFoundError(
            f"Target {target_type.value}:{target_id} not in recommendation"
        )

    def replace_all(
        self,
        targets: list[RecommendationTarget],
        *,
        limit: int = DEFAULT_RECOMMENDATIONS_LIMIT,
    ) -> None:
        """Idempotent overwrite — used by PUT /api/admin/recommendations.

        Re-runs every aggregate invariant against the incoming set so a
        client cannot use this fast path to smuggle in a self-reference
        or a duplicate that `add_target` would have rejected.
        """
        if len(targets) > limit:
            raise RecommendationLimitExceededError(
                f"Cannot exceed {limit} recommendations per source"
            )
        seen: set[tuple[RecommendationTargetType, str]] = set()
        for t in targets:
            self._guard_self_reference(t)
            key = (t.target_type, t.target_id)
            if key in seen:
                raise DuplicateRecommendationTargetError(
                    f"Duplicate target {t.target_type.value}:{t.target_id}"
                )
            seen.add(key)
        # Copy the list so external mutations don't leak in.
        self.targets = list(targets)
        self.updated_at = datetime.utcnow()

    def reorder(
        self,
        ordered_keys: list[tuple[RecommendationTargetType, str]],
    ) -> None:
        """Rearrange existing targets to match `ordered_keys`.

        Strict — the supplied keys must be a permutation of the
        existing targets. A length mismatch or a missing key raises
        `RecommendationTargetNotFoundError`. Doesn't allow add/remove
        as a side effect (use the dedicated mutators) so a partial
        client request can't silently drop a target.
        """
        if len(ordered_keys) != len(self.targets):
            raise RecommendationTargetNotFoundError(
                "Reorder must list exactly the existing targets"
            )
        by_key = {(t.target_type, t.target_id): t for t in self.targets}
        if set(ordered_keys) != set(by_key.keys()):
            raise RecommendationTargetNotFoundError(
                "Reorder keys do not match the existing target set"
            )
        self.targets = [by_key[key] for key in ordered_keys]
        self.updated_at = datetime.utcnow()

    # ─── Internal guards ─────────────────────────────────────────────

    def _guard_self_reference(self, target: RecommendationTarget) -> None:
        # Self-reference is only meaningful when the *types match* —
        # `DESIGN:abc` recommending `PANEL:abc` is fine (different
        # bounded contexts share id namespaces in this codebase).
        if (
            target.target_type.value == self.source_type.value
            and target.target_id == self.source_id
        ):
            raise SelfRecommendationError(
                f"Source {self.source_type.value}:{self.source_id} cannot recommend itself"
            )


# ─── Exceptions ──────────────────────────────────────────────────────


class SelfRecommendationError(ValueError):
    """A source cannot recommend itself. Mapped to 422 in the API."""


class DuplicateRecommendationTargetError(ValueError):
    """The same target id appeared twice for the same source. → 422."""


class RecommendationLimitExceededError(ValueError):
    """Targets count exceeds the per-source limit. → 422."""


class RecommendationTargetNotFoundError(LookupError):
    """A target referenced by remove/reorder is not in the aggregate. → 404."""


class RecommendationNotFoundError(LookupError):
    """No `Recommendation` exists for the requested (source_type, source_id)."""
