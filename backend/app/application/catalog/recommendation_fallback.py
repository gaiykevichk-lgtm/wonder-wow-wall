"""Phase 10 — production heuristic for `RecommendationFallbackProvider`.

When the admin curated list is empty (or too short) the public read
falls back to this provider so the «с этим покупают» rail is never
empty. The heuristic mirrors the legacy client-only logic that lived
in `frontend/src/domains/catalog/ui/ProductPage.tsx:96–107` so the
behaviour is unchanged on a fresh install (no admin curation yet).

Heuristic rules (in order, only Designs are returned):
  1. Same category as the source design — best signal of "similar
     product" we have without ML.
  2. Highest-rated first within that bucket — matches what an admin
     would intuitively recommend.
  3. If the bucket is short, top up with any remaining popular designs
     across all categories so the rail still fills.

PANEL sources fall through to "any popular design" — panels don't
have a category-style affinity in the current data model, but the
admin almost always curates these explicitly, so the heuristic just
prevents an empty rail rather than trying to be clever.

The provider returns ONLY `RecommendationTargetType.DESIGN` targets
because the legacy heuristic only ever surfaced designs. Cross-type
targets (DESIGN → PANEL, PANEL → PANEL) are exclusively the admin's
domain — the heuristic deliberately stays in its lane.
"""
from __future__ import annotations

from app.domain.catalog.recommendation import (
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.domain.catalog.repositories import DesignRepository


class DesignSimilarityFallback:
    """Default `RecommendationFallbackProvider`.

    Reads from the existing `DesignRepository` — no new persistence,
    no separate index. Cheap because the design catalog is small
    (hundreds, not millions) and the lookup is per-page-load.
    """

    def __init__(self, design_repo: DesignRepository):
        self.design_repo = design_repo

    async def suggest(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
        *,
        limit: int,
        exclude: set[tuple[RecommendationTargetType, str]],
    ) -> list[RecommendationTarget]:
        if limit <= 0:
            return []

        # ─── Step 1: same-category bucket for design sources ────────
        category_pool: list = []
        if source_type == RecommendationSourceType.DESIGN:
            source_design = await self.design_repo.get_by_id(source_id)
            if source_design is not None and source_design.category_id:
                # Pull a generous slice — the dedup against `exclude`
                # may eat several rows, and we sort by rating client-
                # side so a fixed `limit=` here is fine.
                bucket, _ = await self.design_repo.list_designs(
                    category_id=source_design.category_id,
                    sort_by="rating",
                    offset=0,
                    limit=max(limit * 4, 12),
                )
                category_pool = bucket

        # ─── Step 2: backfill from any popular design ───────────────
        # Always fetch — even when the category bucket filled the limit,
        # we may have to skip rows that collide with `exclude`.
        general, _ = await self.design_repo.list_designs(
            sort_by="rating", offset=0, limit=max(limit * 4, 12),
        )

        # ─── Compose: dedup, exclude, trim ──────────────────────────
        # Defensive: always exclude the source itself (caller adds it,
        # but a buggy upstream skipping that step would otherwise let
        # the source recommend itself via the fallback).
        local_exclude: set[tuple[RecommendationTargetType, str]] = set(exclude)
        if source_type == RecommendationSourceType.DESIGN:
            local_exclude.add(
                (RecommendationTargetType.DESIGN, source_id)
            )

        out: list[RecommendationTarget] = []
        seen: set[tuple[RecommendationTargetType, str]] = set()
        for design in [*category_pool, *general]:
            key = (RecommendationTargetType.DESIGN, design.id)
            if key in local_exclude or key in seen:
                continue
            seen.add(key)
            out.append(
                RecommendationTarget(
                    target_type=RecommendationTargetType.DESIGN,
                    target_id=design.id,
                )
            )
            if len(out) >= limit:
                break
        return out
