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
