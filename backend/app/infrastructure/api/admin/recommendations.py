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
from app.application.catalog.recommendation_use_cases import (
    DeleteRecommendationAdmin,
    GetRecommendationAdmin,
    ListRecommendationsAdmin,
    UpsertRecommendationAdmin,
)
from app.container import (
    get_audit_repo,
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
    """

    id: str
    source_type: str
    source_id: str
    targets: list[RecommendationTargetResponse] = Field(default_factory=list)
    updated_at: str


class RecommendationListResponse(BaseModel):
    items: list[RecommendationResponse] = Field(default_factory=list)
    total: int
    page: int
    size: int


def _to_response(rec: Recommendation) -> RecommendationResponse:
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
    )


def _empty_response(
    source_type: RecommendationSourceType, source_id: str,
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
    )


# ─── Request shapes ──────────────────────────────────────────────────


class RecommendationTargetInput(BaseModel):
    target_type: str = Field(min_length=1, max_length=16)
    target_id: str = Field(min_length=1, max_length=36)


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
):
    """Editor read.

    Returns an empty aggregate (200) when no curation exists yet so
    the editor renders uniformly — see module docstring on why this
    is preferable to a 404.
    """
    st = _parse_source_type(source_type)
    rec = await GetRecommendationAdmin(rec_repo).execute(st, source_id)
    if rec is None:
        return _empty_response(st, source_id)
    return _to_response(rec)


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
