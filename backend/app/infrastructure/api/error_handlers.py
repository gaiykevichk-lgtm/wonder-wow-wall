"""HTTP-mapping for domain exceptions.

Per `backend/CONVENTIONS.md` § "Маппинг доменных ошибок в HTTP", domain-layer
exceptions must not import FastAPI; the translation lives here at the API
boundary. Handlers are registered in `app/main.py` once at startup.

Phase 5C wires:
* `CollinearCornersError` → 422 + `{detail, code: "degenerate_corners"}` so the
  frontend can distinguish a "too-collinear" payload from a generic Pydantic
  422 (where there is no `code` field).
* `StaleSceneVersionError` → 409 + `{detail, code: "stale_version"}` so the
  frontend knows to refetch and surface a "data changed in another tab" toast.
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.order.exceptions import InvalidOrderTransitionError
from app.domain.user.exceptions import (
    LastAdminRemovalError,
    NotAuthorizedError,
    UserBlockedError,
)
from app.domain.visualizer.exceptions import (
    CollinearCornersError,
    DepthEstimationError,
    PlaneFittingError,
    StaleSceneVersionError,
)
from app.domain.media.exceptions import (
    MediaCorruptError,
    MediaInvalidDimensionsError,
    MediaInvalidMimeError,
    MediaTooLargeError,
)
from app.domain.catalog.catalog_exceptions import (
    CategoryInUseError,
    CategoryNotFoundError,
    CategorySlugConflictError,
    DesignNotFoundError,
    DesignSlugConflictError,
)
from app.domain.catalog.panel_exceptions import (
    PanelNotFoundError,
    PanelSlugConflictError,
)
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.domain.subscription.plan_exceptions import (
    SubscriptionPlanIdConflictError,
    SubscriptionPlanInUseError,
    SubscriptionPlanNotFoundError,
)
from app.domain.catalog.recommendation import (
    DuplicateRecommendationTargetError,
    RecommendationLimitExceededError,
    RecommendationNotFoundError,
    RecommendationTargetNotFoundError,
    SelfRecommendationError,
)


async def collinear_corners_handler(request: Request, exc: CollinearCornersError):
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "degenerate_corners"},
    )


async def stale_scene_version_handler(request: Request, exc: StaleSceneVersionError):
    # B45 closure — surface `server_version` so the frontend can use it as the
    # next read-marker without an extra round-trip. Both fields default to
    # `None` for callers that constructed the exception with the legacy
    # message-only signature.
    return JSONResponse(
        status_code=409,
        content={
            "detail": str(exc),
            "code": "stale_version",
            "client_version": exc.client_version,
            "server_version": exc.server_version,
        },
    )


# ─── Phase 6 — depth-based auto-perspective ──────────────────────────
# Both failure modes fall back to the client's existing manual-perspective
# flow, so the frontend branches on `code` to decide messaging rather than
# being forced into a hard error state.


async def depth_estimation_handler(request: Request, exc: DepthEstimationError):
    """Depth model unavailable / inference error → 503.

    The request was fine; the ML backend is the blocker. 503 tells the
    frontend this may be transient — retry or fall back to manual.
    """
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc), "code": "depth_unavailable"},
    )


async def plane_fitting_handler(request: Request, exc: PlaneFittingError):
    """RANSAC couldn't find a dominant plane → 422.

    Well-formed request, but the algorithm couldn't produce corners on this
    image (e.g. textureless wall, mask too small). Caller falls back to
    manual 4-corner drag.
    """
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "plane_fit_failed"},
    )


# ─── Phase 1 — admin-panel user/role errors ──────────────────────────
# Closes the gap where `RevokeAdminRole`/`RequireAdmin` could bubble
# domain exceptions up as 500. Fronted by Фаза 5 user-management UI
# which branches on the `code` field.


async def last_admin_removal_handler(request: Request, exc: LastAdminRemovalError):
    """Attempt to demote the only remaining admin → 409.

    Same `code` pattern as `stale_version` so the frontend can map it to a
    dedicated toast ("Нельзя снять роль у последнего администратора").
    """
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "last_admin"},
    )


# ─── Phase 4B — admin order status transitions ───────────────────────


async def invalid_order_transition_handler(
    request: Request, exc: InvalidOrderTransitionError
):
    """Forbidden status transition (e.g. PLACED → DELIVERED) → 409.

    Same `code` pattern as `stale_version` so the admin UI can map it to
    a "Нельзя выполнить переход" toast and refetch the order to display
    the actual current status. Plain `ValueError`s (missing reason etc.)
    keep going to 422 — those are caller-input bugs, not workflow errors.
    """
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "invalid_transition"},
    )


async def not_authorized_handler(request: Request, exc: NotAuthorizedError):
    """Actor is signed in but lacks the required role → 403.

    Distinct from `get_current_admin_id`'s inline 403 because this one is
    raised deep inside a use case (e.g. when an admin was just demoted and
    replays a stale JWT). `code` lets the frontend detect "force re-login"
    rather than showing a generic forbidden page.
    """
    return JSONResponse(
        status_code=403,
        content={"detail": str(exc), "code": "not_authorized"},
    )


# ─── Phase 5 — blocked accounts cannot log in ────────────────────────


async def user_blocked_handler(request: Request, exc: UserBlockedError):
    """Login attempt on a blocked account → 403 + `code: "user_blocked"`.

    The frontend's login form branches on `code` to show "Аккаунт
    заблокирован, обратитесь к поддержке" instead of the generic
    "Неверный email или пароль" — different UX because the user *is*
    valid, just disabled. 403 (not 401) signals "request understood,
    refused" rather than "credentials missing/invalid".
    """
    return JSONResponse(
        status_code=403,
        content={"detail": str(exc), "code": "user_blocked"},
    )


# ─── Phase 6 — admin file uploads ────────────────────────────────────
# The four media-validation failures map to distinct status codes so the
# admin UI can render a precise message ("file too big" vs "wrong type")
# without parsing the localized `detail` string. See exceptions.py for
# the rationale of each code split.


async def media_too_large_handler(request: Request, exc: MediaTooLargeError):
    """Upload exceeds per-purpose or global cap → 413."""
    return JSONResponse(
        status_code=413,
        content={"detail": str(exc), "code": "media_too_large"},
    )


async def media_invalid_mime_handler(request: Request, exc: MediaInvalidMimeError):
    """Detected MIME isn't allowed → 415 (Unsupported Media Type)."""
    return JSONResponse(
        status_code=415,
        content={"detail": str(exc), "code": "media_invalid_mime"},
    )


async def media_invalid_dimensions_handler(
    request: Request, exc: MediaInvalidDimensionsError,
):
    """Image decoded fine but its pixel dimensions are out of policy → 422."""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "media_invalid_dimensions"},
    )


async def media_corrupt_handler(request: Request, exc: MediaCorruptError):
    """Pillow could not decode the bytes (truncated / not an image) → 422."""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "media_corrupt"},
    )


# ─── Phase 7B — admin panel SKU CRUD ─────────────────────────────────
# Two domain errors: 404 for "id unknown" and 409 for slug collisions.
# Stable `code` values let the modal show a precise message ("такой
# slug уже занят") instead of parsing the localized `detail` string.


async def panel_not_found_handler(request: Request, exc: PanelNotFoundError):
    """Admin requested a panel id that no longer exists → 404.

    Same shape as `OrderNotFound`/`UserNotFound` from Phase 4/5 — the
    use case raises this when `get_by_id` returns None on update/delete.
    """
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "panel_not_found"},
    )


async def panel_slug_conflict_handler(
    request: Request, exc: PanelSlugConflictError,
):
    """Slug collision on create/update → 409.

    Pre-checked at the use-case layer (`CreatePanelAdmin`/`UpdatePanelAdmin`)
    before hitting the DB UNIQUE constraint, so the admin gets a clean
    409 rather than a leaked IntegrityError 500.
    """
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "panel_slug_conflict"},
    )


# ─── Phase 7A — admin catalog (categories + designs) ─────────────────
# Three error families, mirrors of the Panel handlers above:
# 404 for unknown id, 409 for slug conflict, 409 for in-use guard.


async def design_not_found_handler(request: Request, exc: DesignNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "design_not_found"},
    )


async def design_slug_conflict_handler(
    request: Request, exc: DesignSlugConflictError,
):
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "design_slug_conflict"},
    )


async def category_not_found_handler(
    request: Request, exc: CategoryNotFoundError,
):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "category_not_found"},
    )


async def category_slug_conflict_handler(
    request: Request, exc: CategorySlugConflictError,
):
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "category_slug_conflict"},
    )


async def category_in_use_handler(request: Request, exc: CategoryInUseError):
    """Refusal to delete a category with attached designs → 409.

    Distinct `code` from `category_slug_conflict` so the admin UI can
    render the precise message ("В категории есть N дизайнов") and
    suggest moving them first.
    """
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "category_in_use"},
    )


# ─── Phase 10 — admin recommendations ────────────────────────────────
# Five domain errors split across 422 (semantic invariants) and 404
# (missing rows). Stable `code` values let the editor render precise
# inline messages instead of parsing the localized `detail` string.


async def self_recommendation_handler(
    request: Request, exc: SelfRecommendationError,
):
    """Source product cannot recommend itself → 422."""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "self_reference"},
    )


async def duplicate_recommendation_target_handler(
    request: Request, exc: DuplicateRecommendationTargetError,
):
    """Same target appeared twice in one aggregate → 422."""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "duplicate_target"},
    )


async def recommendation_limit_exceeded_handler(
    request: Request, exc: RecommendationLimitExceededError,
):
    """Targets count exceeds `recommendations_limit_per_source` → 422.

    The editor already enforces the limit client-side via the settings
    fetch; this handler covers a stale-cache race (admin lowered the
    limit in another tab between the editor's load and the save).
    """
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "limit_exceeded"},
    )


async def recommendation_target_not_found_handler(
    request: Request, exc: RecommendationTargetNotFoundError,
):
    """Reorder/remove referenced a target not in the aggregate → 404.

    Currently unreachable from the PUT-style upsert endpoint, but we
    register the handler now so future granular endpoints (planned for
    Phase 10.5+) get the right shape without retrofitting `main.py`.
    """
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "target_not_found"},
    )


async def recommendation_not_found_handler(
    request: Request, exc: RecommendationNotFoundError,
):
    """No aggregate exists for the requested (source_type, source_id) → 404.

    The admin DELETE endpoint raises this on a miss; the public GET
    deliberately does NOT (it falls back to heuristics so the rail is
    never empty).
    """
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "recommendation_not_found"},
    )


# ─── Phase 8B — banner CRUD ──────────────────────────────────────────


async def banner_not_found_handler(request: Request, exc: BannerNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "banner_not_found"},
    )


# ─── Phase 8C — subscription plan CRUD ───────────────────────────────


async def subscription_plan_not_found_handler(
    request: Request, exc: SubscriptionPlanNotFoundError,
):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "code": "subscription_plan_not_found"},
    )


async def subscription_plan_id_conflict_handler(
    request: Request, exc: SubscriptionPlanIdConflictError,
):
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "subscription_plan_id_conflict"},
    )


async def subscription_plan_in_use_handler(
    request: Request, exc: SubscriptionPlanInUseError,
):
    """Refusal to delete a plan with active subscriptions → 409.

    Distinct `code` from the `id_conflict` so the admin UI can render
    the precise message ("В тарифе N активных подписок") and suggest
    soft-disabling via `is_active=False` instead.
    """
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc), "code": "subscription_plan_in_use"},
    )
