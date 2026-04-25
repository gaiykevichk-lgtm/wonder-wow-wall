"""Phase 10 — admin Recommendation CRUD endpoints.

* `GET    /api/admin/recommendations`                              — paginated list
* `GET    /api/admin/recommendations/{source_type}/{source_id}`    — single aggregate
* `PUT    /api/admin/recommendations/{source_type}/{source_id}`    — idempotent upsert
* `DELETE /api/admin/recommendations/{source_type}/{source_id}`    — drop curation

Path shape `(source_type, source_id)` mirrors the natural key on the
aggregate. We deliberately did NOT route via the surrogate uuid (`id`)
because:
  * the admin always reaches the editor from a product detail page, where
    `(source_type, source_id)` is what they have in hand;
  * a stable URL means a deep link never breaks across re-creates.

Domain → HTTP mapping (registered in `app/main.py`):
  `SelfRecommendationError`           → 422 + `code: "self_reference"`
  `DuplicateRecommendationTargetError`→ 422 + `code: "duplicate_target"`
  `RecommendationLimitExceededError`  → 422 + `code: "limit_exceeded"`
  `RecommendationTargetNotFoundError` → 404 + `code: "target_not_found"`
  `RecommendationNotFoundError`       → 404 + `code: "recommendation_not_found"`

Why PUT (not PATCH) for the upsert:
  The editor manages a draft list locally and saves once; granular
  add/remove/reorder operations would require optimistic-concurrency
  tokens we don't have yet (Phase 5C only added them for visualizer
  scenes). PUT-style replace is idempotent and matches what the editor
  actually does.

GET for a missing source returns an *empty* aggregate (200 + `targets:
[]`) so the editor can render uniformly without a special-case 404
branch — same pattern as the empty-state in `GetShopSettings`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.recommendation_fallback import (
    DesignSimilarityFallback,
)
from app.application.catalog.recommendation_use_cases import (
    CopyRecommendationsAdmin,
    DeleteRecommendationAdmin,
    GetRecommendationAdmin,
    ListRecommendationsAdmin,
    UpsertRecommendationAdmin,
)
from app.container import (
    get_audit_repo,
    get_design_repo,
    get_recommendation_repo,
    get_shop_settings_repo,
)
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationNotFoundError,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetType,
)
from app.domain.catalog.repositories import RecommendationFilters
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Response shapes ─────────────────────────────────────────────────


class RecommendationTargetResponse(BaseModel):
    target_type: str
    target_id: str


class RecommendationResponse(BaseModel):
    """Aggregate as a single payload (parent + ordered targets).

    Order of `targets` is the canonical display order — the editor
    re-uses it as the initial list state so the UI never has to sort.

    Phase 10 LOW-7 — `fallback_suggestions` is the list the heuristic
    would surface for this source if no curation existed. The admin
    UI uses it for «Принять авто-предложение» one-click pickers next
    to the empty editor; on the list endpoint the field is omitted
    (would be a per-row N+1) and stays empty when the GET returns the
    detail view of an already-curated source whose targets fully cover
    the limit. Order matches the heuristic's own ranking (same-category
    by rating first, then popular fill).
    """

    id: str
    source_type: str
    source_id: str
    targets: list[RecommendationTargetResponse] = Field(default_factory=list)
    updated_at: str
    fallback_suggestions: list[RecommendationTargetResponse] = Field(
        default_factory=list,
    )


class RecommendationListResponse(BaseModel):
    items: list[RecommendationResponse] = Field(default_factory=list)
    total: int
    page: int
    size: int


def _to_response(
    rec: Recommendation,
    *,
    fallback_suggestions: list[RecommendationTarget] | None = None,
) -> RecommendationResponse:
    return RecommendationResponse(
        id=rec.id,
        source_type=rec.source_type.value,
        source_id=rec.source_id,
        targets=[
            RecommendationTargetResponse(
                target_type=t.target_type.value,
                target_id=t.target_id,
            )
            for t in rec.targets
        ],
        updated_at=rec.updated_at.isoformat(),
        fallback_suggestions=[
            RecommendationTargetResponse(
                target_type=t.target_type.value,
                target_id=t.target_id,
            )
            for t in (fallback_suggestions or [])
        ],
    )


def _empty_response(
    source_type: RecommendationSourceType,
    source_id: str,
    *,
    fallback_suggestions: list[RecommendationTarget] | None = None,
) -> RecommendationResponse:
    """Default-aggregate payload returned when no curation exists.

    `id` is empty (the row does not exist yet); the editor uses
    `source_type`/`source_id` as the natural key for the subsequent
    PUT, so a missing surrogate doesn't break the save flow.
    """
    return RecommendationResponse(
        id="",
        source_type=source_type.value,
        source_id=source_id,
        targets=[],
        updated_at="",
        fallback_suggestions=[
            RecommendationTargetResponse(
                target_type=t.target_type.value,
                target_id=t.target_id,
            )
            for t in (fallback_suggestions or [])
        ],
    )


# ─── Request shapes ──────────────────────────────────────────────────


class RecommendationTargetInput(BaseModel):
    target_type: str = Field(min_length=1, max_length=16)
    target_id: str = Field(min_length=1, max_length=36)


class RecommendationCopyBody(BaseModel):
    """Phase 10 follow-up — bulk copy from another source.

    `mode='replace'` overwrites the destination's existing curation;
    `mode='append'` keeps existing manual targets and adds the source's
    targets that aren't already present (dedup by `(target_type,
    target_id)`). Both modes trim to the live `recommendations_limit_per_source`.
    """

    from_source_type: str = Field(min_length=1, max_length=16)
    from_source_id: str = Field(min_length=1, max_length=36)
    mode: str = Field(default="replace", pattern="^(replace|append)$")


class RecommendationUpsertBody(BaseModel):
    """PUT body — full target list in display order.

    `targets` length cap matches the hard-coded
    `ShopSettings.recommendations_limit_per_source` (default 12) but we
    don't enforce the limit here — the use case re-reads it from
    settings so admin-tunability survives. The Pydantic length cap is
    a defence-in-depth ceiling against a malformed bulk request.
    """

    targets: list[RecommendationTargetInput] = Field(
        default_factory=list, max_length=200,
    )


# ─── Helpers ─────────────────────────────────────────────────────────


def _parse_source_type(value: str) -> RecommendationSourceType:
    """Translate the path segment into the typed enum.

    A bad value lands at 422 (uniform validation error) rather than the
    opaque 404 / 500 the FastAPI default machinery would produce — the
    frontend branches on `status_code == 422` for all input-shape errors.
    """
    try:
        return RecommendationSourceType(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown source_type {value!r}; "
                f"expected one of {[s.value for s in RecommendationSourceType]}"
            ),
        ) from exc


def _parse_target_type(value: str) -> RecommendationTargetType:
    try:
        return RecommendationTargetType(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown target_type {value!r}; "
                f"expected one of {[s.value for s in RecommendationTargetType]}"
            ),
        ) from exc


# ─── List ────────────────────────────────────────────────────────────


@router.get("/recommendations", response_model=RecommendationListResponse)
async def list_recommendations_admin(
    source_type: str | None = Query(
        default=None,
        description="Filter by source_type (`design` / `panel`).",
    ),
    has_manual: bool | None = Query(
        default=None,
        description="True → only sources with at least 1 curated target.",
    ),
    search: str | None = Query(
        default=None,
        max_length=200,
        description="Phase 10 LOW-6 — case-insensitive substring on source_id.",
    ),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _admin_id: str = Depends(get_current_admin_id),
    rec_repo=Depends(get_recommendation_repo),
):
    """Admin overview table.

    Returns `(items, total)` like the other admin lists. `page`/`size`
    pagination matches `users` / `orders` (1-based page index).
    """
    filters = RecommendationFilters(
        source_type=_parse_source_type(source_type) if source_type else None,
        has_manual=has_manual,
        search=(search or "").strip() or None,
    )
    items, total = await ListRecommendationsAdmin(rec_repo).execute(
        filters, page=page, size=size,
    )
    return RecommendationListResponse(
        items=[_to_response(r) for r in items],
        total=total,
        page=page,
        size=size,
    )


# ─── Detail ──────────────────────────────────────────────────────────


@router.get(
    "/recommendations/{source_type}/{source_id}",
    response_model=RecommendationResponse,
)
async def get_recommendation_admin(
    source_type: str,
    source_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    rec_repo=Depends(get_recommendation_repo),
    design_repo=Depends(get_design_repo),
    settings_repo=Depends(get_shop_settings_repo),
):
    """Editor read.

    Returns an empty aggregate (200) when no curation exists yet so
    the editor renders uniformly — see module docstring on why this
    is preferable to a 404.

    Phase 10 LOW-7 — alongside the curated `targets`, surface the
    `fallback_suggestions` the heuristic would emit so the admin can
    one-click «Принять авто-предложение» without leaving the editor.
    Existing manual targets + the source itself are excluded so the
    suggestion list never duplicates the curated list. Limit comes
    from `ShopSettings.recommendations_limit_per_source` so the
    suggestion bucket size matches the live cap.
    """
    st = _parse_source_type(source_type)
    rec = await GetRecommendationAdmin(rec_repo).execute(st, source_id)

    settings = await settings_repo.get()
    cap = settings.recommendations_limit_per_source
    existing_targets = list(rec.targets) if rec is not None else []
    exclude: set[tuple[RecommendationTargetType, str]] = {
        (t.target_type, t.target_id) for t in existing_targets
    }
    # Slots remaining under the live cap; once curation already fills
    # the cap we still hand back a few suggestions (capped at `cap`)
    # so the admin can swap items out — UI decides whether to render.
    headroom = max(cap - len(existing_targets), 0)
    fallback_limit = headroom if headroom > 0 else cap
    fallback_suggestions: list[RecommendationTarget] = []
    if fallback_limit > 0:
        fallback = DesignSimilarityFallback(design_repo)
        fallback_suggestions = await fallback.suggest(
            st, source_id,
            limit=fallback_limit,
            exclude=exclude,
        )

    if rec is None:
        return _empty_response(
            st, source_id, fallback_suggestions=fallback_suggestions,
        )
    return _to_response(rec, fallback_suggestions=fallback_suggestions)


# ─── Upsert ──────────────────────────────────────────────────────────


@router.put(
    "/recommendations/{source_type}/{source_id}",
    response_model=RecommendationResponse,
)
async def upsert_recommendation_admin(
    source_type: str,
    source_id: str,
    body: RecommendationUpsertBody,
    admin_id: str = Depends(get_current_admin_id),
    rec_repo=Depends(get_recommendation_repo),
    settings_repo=Depends(get_shop_settings_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    """Idempotent PUT — replaces the entire target list.

    Re-running the same body produces the same final state. The use
    case re-reads `recommendations_limit_per_source` on every call so
    a runtime tweak by the admin takes effect immediately.
    """
    st = _parse_source_type(source_type)
    targets = [
        RecommendationTarget(
            target_type=_parse_target_type(t.target_type),
            target_id=t.target_id,
        )
        for t in body.targets
    ]
    saved = await UpsertRecommendationAdmin(
        rec_repo,
        settings_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(
        actor_id=admin_id,
        source_type=st,
        source_id=source_id,
        targets=targets,
    )
    return _to_response(saved)


# ─── Copy from another source ────────────────────────────────────────


@router.post(
    "/recommendations/{source_type}/{source_id}/copy-from",
    response_model=RecommendationResponse,
)
async def copy_recommendations_admin(
    source_type: str,
    source_id: str,
    body: RecommendationCopyBody,
    admin_id: str = Depends(get_current_admin_id),
    rec_repo=Depends(get_recommendation_repo),
    settings_repo=Depends(get_shop_settings_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    """Phase 10 bulk-copy — seed/extend a destination from another source.

    Both source types live under the same admin route prefix because
    the destination is the natural URL anchor (admin lands on the
    editor of B and chooses to import from A). On 404 from the
    `RecommendationNotFoundError` (no curation to copy) the global
    handler returns the standard envelope `{detail, code:
    "recommendation_not_found"}` so the UI can branch consistently.
    """
    dest_st = _parse_source_type(source_type)
    from_st = _parse_source_type(body.from_source_type)
    saved = await CopyRecommendationsAdmin(
        rec_repo,
        settings_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(
        actor_id=admin_id,
        dest_source_type=dest_st,
        dest_source_id=source_id,
        from_source_type=from_st,
        from_source_id=body.from_source_id,
        mode=body.mode,
    )
    return _to_response(saved)


# ─── Delete ──────────────────────────────────────────────────────────


@router.delete(
    "/recommendations/{source_type}/{source_id}", status_code=204,
)
async def delete_recommendation_admin(
    source_type: str,
    source_id: str,
    admin_id: str = Depends(get_current_admin_id),
    rec_repo=Depends(get_recommendation_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    """Drop the manual curation.

    Public reads fall back to the heuristic on the next call, so the
    rail keeps working — the admin is choosing to undo their override,
    not to disable the feature for this product.

    Returns 204 on a real delete, 404 on a miss so the admin UI can
    distinguish "I just deleted it" from "someone else already did".
    Same idempotency-meets-feedback compromise as `DELETE /panels/{id}`.
    """
    st = _parse_source_type(source_type)
    deleted = await DeleteRecommendationAdmin(
        rec_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(
        actor_id=admin_id,
        source_type=st,
        source_id=source_id,
    )
    if not deleted:
        raise RecommendationNotFoundError(
            f"No recommendation for {source_type}:{source_id}"
        )
    return Response(status_code=204)
