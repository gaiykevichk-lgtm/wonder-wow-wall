"""Phase 10 — admin + public Recommendation use cases.

Three audiences served from this module:

1. **Admin CRUD** — manage the curated list per source.
   * `GetRecommendationAdmin` — read one (returns empty aggregate when
     none stored, so the editor can render uniformly).
   * `ListRecommendationsAdmin` — paginated table view across sources.
   * `UpsertRecommendationAdmin` — idempotent PUT-style overwrite.
   * `DeleteRecommendationAdmin` — drop the manual curation, fall
     back to heuristics on next public read.

2. **Public read** — `GetPublicRecommendations`. Returns the manual
   targets (if any) topped up with heuristic suggestions to reach the
   requested limit. Always returns a list — never raises on missing
   source — so the consumer can render the rail unconditionally.

3. **Cascade cleanup** — `CleanupRecommendationsOnDelete`. Called by
   `DeletePanelAdmin` (Phase 7B) and the eventual `DeleteDesignAdmin`
   (Phase 7A) so a removed product does not leave orphan rows in
   `recommendations` (as source) or `recommendation_targets` (as
   target). The use case lives here (not in catalog/panel_use_cases)
   because it owns the recommendation aggregate; pulling it into
   `DeletePanelAdmin` directly would invert the dependency.

Audit retrofit:
  Same collaborator pattern as Phase 9 — `RecordAuditEntry` is
  optional, default None. The API layer wires it; in-memory tests can
  omit. Idempotent no-op (e.g., delete on a missing source) does NOT
  emit an audit entry.
"""
from __future__ import annotations

from typing import Any, Protocol

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.recommendation import (
    DEFAULT_RECOMMENDATIONS_LIMIT,
    Recommendation,
    RecommendationNotFoundError,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
    SelfRecommendationError,
)
from app.domain.catalog.repositories import (
    RecommendationFilters,
    RecommendationRepository,
)
from app.domain.shop.repositories import ShopSettingsRepository


# ─── Composite key helpers ───────────────────────────────────────────


def _audit_target_id(
    source_type: RecommendationSourceType, source_id: str,
) -> str:
    """Compose a stable target_id for the audit log.

    Audit's `target_id` is a single string but a recommendation is
    identified by *two* fields. We use `{source_type}:{source_id}`
    (same shape as the public API path) so a forensic search can
    match on either component with a substring filter.
    """
    return f"{source_type.value}:{source_id}"


# ─── Admin: read ─────────────────────────────────────────────────────


class GetRecommendationAdmin:
    """Fetch the aggregate for `(source_type, source_id)`.

    Returns `None` when nothing is stored. Callers (the API layer)
    decide whether to lift `None` into an empty `Recommendation`
    (editor view) or into a 404 (delete idempotency).
    """

    def __init__(self, repo: RecommendationRepository):
        self.repo = repo

    async def execute(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> Recommendation | None:
        return await self.repo.find_by_source(source_type, source_id)


class ListRecommendationsAdmin:
    """Paginated list — used by the admin overview table."""

    def __init__(self, repo: RecommendationRepository):
        self.repo = repo

    async def execute(
        self,
        filters: RecommendationFilters,
        *,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[Recommendation], int]:
        page = max(page, 1)
        size = max(1, min(size, 200))
        offset = (page - 1) * size
        return await self.repo.list_paginated(
            filters, offset=offset, limit=size,
        )


# ─── Admin: write ────────────────────────────────────────────────────


class UpsertRecommendationAdmin:
    """PUT-style: replace the entire target list for one source.

    Why a single PUT (not granular add/remove/reorder endpoints):
      * The editor UI manages a draft list and saves once. Syncing
        granular operations would require optimistic-concurrency
        tokens we don't have yet.
      * Idempotent — re-sending the same body twice produces the
        same final state.

    The limit is read from `ShopSettings.recommendations_limit_per_source`
    on every call so an admin can tune it without restarting the
    process. The aggregate's `replace_all` does the actual enforcement.
    """

    def __init__(
        self,
        repo: RecommendationRepository,
        settings_repo: ShopSettingsRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.settings_repo = settings_repo
        self.audit_recorder = audit_recorder

    async def execute(
        self,
        *,
        actor_id: str | None = None,
        source_type: RecommendationSourceType,
        source_id: str,
        targets: list[RecommendationTarget],
    ) -> Recommendation:
        if not source_id:
            raise ValueError("source_id must not be empty")
        settings = await self.settings_repo.get()
        limit = settings.recommendations_limit_per_source

        existing = await self.repo.find_by_source(source_type, source_id)
        if existing is None:
            # Build a fresh aggregate. We pass `targets=[]` first then
            # `replace_all` so the limit/dup/self-ref invariants run
            # through the same code path as an update — keeps the
            # error semantics identical for create vs update.
            rec = Recommendation(
                source_type=source_type,
                source_id=source_id,
                targets=[],
            )
        else:
            rec = existing
        rec.replace_all(targets, limit=limit)
        saved = await self.repo.save(rec)

        if self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.RECOMMENDATION_UPSERT,
                target_type=AuditTargetType.RECOMMENDATION,
                target_id=_audit_target_id(source_type, source_id),
                payload={
                    "source_type": source_type.value,
                    "source_id": source_id,
                    "targets_count": len(saved.targets),
                    # Compact list of target keys — handy for forensics
                    # without ballooning the row when N is large.
                    "targets": [
                        f"{t.target_type.value}:{t.target_id}"
                        for t in saved.targets
                    ],
                },
            )
        return saved


class CopyRecommendationsAdmin:
    """Phase 10 follow-up — bulk «Скопировать рекомендации» from another source.

    Use case:
      Admin curates panel A with 8 hand-picked designs. Panel A' is a
      sibling with the same expected rail — the admin wants to seed it
      from A and then tweak.

    Mode is explicit:
      * `REPLACE` — overwrite the destination's curation entirely. The
        new list is the source's targets, in the source's order, capped
        by the live `recommendations_limit_per_source`.
      * `APPEND` — keep the destination's existing manual targets, then
        add any source target that isn't already present (key =
        `(target_type, target_id)`). Trimmed to the live cap.

    Self-recommendation guard: if the destination's `(source_type,
    source_id)` appears in the source's target list, it is silently
    dropped (would otherwise trigger `SelfRecommendationError` from the
    aggregate). Same posture as `DesignSimilarityFallback`.

    Audited under `RECOMMENDATION_UPSERT` (one logical change to the
    destination) — the source row is not modified, so no dual entry.
    """

    def __init__(
        self,
        repo: RecommendationRepository,
        settings_repo: ShopSettingsRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.settings_repo = settings_repo
        self.audit_recorder = audit_recorder

    async def execute(
        self,
        *,
        actor_id: str | None = None,
        dest_source_type: RecommendationSourceType,
        dest_source_id: str,
        from_source_type: RecommendationSourceType,
        from_source_id: str,
        mode: str,  # 'replace' | 'append'
    ) -> Recommendation:
        if mode not in {"replace", "append"}:
            raise ValueError(
                f"Unknown copy mode {mode!r}; expected 'replace' or 'append'"
            )
        if (dest_source_type, dest_source_id) == (
            from_source_type, from_source_id,
        ):
            raise SelfRecommendationError(
                "Cannot copy a source onto itself",
            )

        from_rec = await self.repo.find_by_source(
            from_source_type, from_source_id,
        )
        if from_rec is None or not from_rec.targets:
            raise RecommendationNotFoundError(
                f"No curation to copy from "
                f"{from_source_type.value}:{from_source_id}"
            )

        # Drop any target that would self-recommend the destination.
        copyable: list[RecommendationTarget] = []
        for t in from_rec.targets:
            # The destination's source-type/id pair maps to a target by
            # spec: DESIGN→DESIGN, PANEL→PANEL. Cross-type self-loops
            # (PANEL source + DESIGN target same id) are not real self-
            # references in this domain because the keyspaces are
            # disjoint, so we only filter the same-type/same-id pair.
            if (
                t.target_type.value == dest_source_type.value
                and t.target_id == dest_source_id
            ):
                continue
            copyable.append(t)

        if not copyable:
            raise RecommendationNotFoundError(
                "Source has no copyable targets after self-reference filter"
            )

        settings = await self.settings_repo.get()
        cap = settings.recommendations_limit_per_source

        existing = await self.repo.find_by_source(
            dest_source_type, dest_source_id,
        )

        if mode == "replace":
            new_targets = copyable[:cap]
        else:  # append
            seen: set[tuple[RecommendationTargetType, str]] = set()
            new_targets = []
            if existing is not None:
                for t in existing.targets:
                    key = (t.target_type, t.target_id)
                    seen.add(key)
                    new_targets.append(t)
            for t in copyable:
                key = (t.target_type, t.target_id)
                if key in seen:
                    continue
                seen.add(key)
                new_targets.append(t)
                if len(new_targets) >= cap:
                    break
            new_targets = new_targets[:cap]

        if existing is None:
            rec = Recommendation(
                source_type=dest_source_type,
                source_id=dest_source_id,
                targets=[],
            )
        else:
            rec = existing
        rec.replace_all(new_targets, limit=cap)
        saved = await self.repo.save(rec)

        if self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.RECOMMENDATION_UPSERT,
                target_type=AuditTargetType.RECOMMENDATION,
                target_id=_audit_target_id(dest_source_type, dest_source_id),
                payload={
                    "source_type": dest_source_type.value,
                    "source_id": dest_source_id,
                    "copy_mode": mode,
                    "copied_from": (
                        f"{from_source_type.value}:{from_source_id}"
                    ),
                    "targets_count": len(saved.targets),
                },
            )
        return saved


class DeleteRecommendationAdmin:
    """Remove the manual curation — public reads fall back to
    heuristics on the next call."""

    def __init__(
        self,
        repo: RecommendationRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self,
        *,
        actor_id: str | None = None,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> bool:
        deleted = await self.repo.delete(source_type, source_id)
        # Idempotent — a delete that hits no row is NOT logged. Mirrors
        # the same rule applied to `DeletePanelAdmin` in Phase 9.
        if deleted and self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.RECOMMENDATION_DELETE,
                target_type=AuditTargetType.RECOMMENDATION,
                target_id=_audit_target_id(source_type, source_id),
                payload={
                    "source_type": source_type.value,
                    "source_id": source_id,
                },
            )
        return deleted


# ─── Public: fallback heuristic ──────────────────────────────────────


class RecommendationFallbackProvider(Protocol):
    """Pluggable heuristic used when the manual curation is missing or
    short of the requested limit.

    Lives as a `Protocol` (structural typing) so the unit tests can
    inject a tiny dict-backed fake without subclassing. The default
    production implementation lives in `recommendation_fallback.py`
    and reads from `DesignRepository`.

    The heuristic must:
      * Honour the requested `limit`.
      * Skip ids in `exclude` — these are the manually curated targets,
        a heuristic dup would surface as a duplicate row in the rail.
      * Never include the source product itself (callers add it to
        `exclude`, but the implementation should be defensive too).
    """

    async def suggest(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
        *,
        limit: int,
        exclude: set[tuple[RecommendationTargetType, str]],
    ) -> list[RecommendationTarget]:
        ...


class GetPublicRecommendations:
    """Public read — manual targets first, fallback fills the rest.

    Always returns a list (never None / never raises on missing
    source). The consumer (the catalog frontend) renders the rail
    unconditionally.

    Composition rule:
      1. Load the manual aggregate. Take up to `limit` targets in the
         admin-curated order.
      2. If `len(manual) < limit`, ask the fallback for
         `(limit - len(manual))` more, EXCLUDING the manual ids.
      3. Concatenate. Manual always wins on order — fallback fills
         the tail.
    """

    def __init__(
        self,
        repo: RecommendationRepository,
        fallback: RecommendationFallbackProvider,
    ):
        self.repo = repo
        self.fallback = fallback

    async def execute(
        self,
        *,
        source_type: RecommendationSourceType,
        source_id: str,
        limit: int = DEFAULT_RECOMMENDATIONS_LIMIT,
    ) -> list[RecommendationTarget]:
        if limit <= 0:
            return []

        manual_rec = await self.repo.find_by_source(source_type, source_id)
        manual: list[RecommendationTarget] = (
            manual_rec.targets[:limit] if manual_rec is not None else []
        )

        if len(manual) >= limit:
            return manual

        # Build the dedup set from manual targets PLUS the source
        # itself (safety net — should also be enforced by the fallback
        # implementation, but cheap to belt-and-braces here).
        exclude: set[tuple[RecommendationTargetType, str]] = {
            (t.target_type, t.target_id) for t in manual
        }
        # The source's "type" comes from RecommendationSourceType, but
        # its dedup key needs to live in RecommendationTargetType space.
        # Both enums share the same `.value` keys (`design`/`panel`) by
        # design — see module docstring on `recommendation.py`.
        exclude.add(
            (RecommendationTargetType(source_type.value), source_id)
        )

        needed = limit - len(manual)
        topup = await self.fallback.suggest(
            source_type, source_id, limit=needed, exclude=exclude,
        )
        # Defensive trim — a buggy fallback could over-fill.
        return manual + topup[:needed]


# ─── Cascade cleanup ─────────────────────────────────────────────────


class CleanupRecommendationsOnDelete:
    """Remove a deleted product from every aggregate that references it.

    Two passes — same product can appear as both source AND target
    (e.g., a panel that recommends a design that recommends back).

    Pass 1 (source): drop the entire aggregate where this product is
      the source. The recommendation rail for a deleted product is
      meaningless.

    Pass 2 (target): for every aggregate that *lists* this product as
      a target, remove the orphan and re-save. Other targets in the
      aggregate are preserved (we don't drop the whole rail just
      because one item went away).

    Returns a small report `(sources_dropped, targets_pruned)` so the
    caller (typically `DeletePanelAdmin`) can attach it to the audit
    payload. Doesn't emit its own audit entry — the parent action
    (PANEL_DELETE / DESIGN_DELETE) is the meaningful event for
    forensics; an extra `RECOMMENDATION_DELETE` per cascade would
    create noise.
    """

    def __init__(self, repo: RecommendationRepository):
        self.repo = repo

    async def execute(
        self,
        product_type: RecommendationSourceType,
        product_id: str,
    ) -> dict[str, Any]:
        # Pass 1 — drop where this product was the source.
        source_dropped = await self.repo.delete(product_type, product_id)

        # Pass 2 — prune from aggregates where this product was a target.
        target_type = RecommendationTargetType(product_type.value)
        affected = await self.repo.find_by_target(target_type, product_id)
        targets_pruned = 0
        for rec in affected:
            try:
                rec.remove_target(target_type, product_id)
            except Exception:
                # Defensive — find_by_target is supposed to return
                # only aggregates that contain the target, but if a
                # race ate the target between the two calls, swallow
                # rather than fail the parent delete.
                continue
            await self.repo.save(rec)
            targets_pruned += 1

        return {
            "source_dropped": bool(source_dropped),
            "targets_pruned": targets_pruned,
        }
