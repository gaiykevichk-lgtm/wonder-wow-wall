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
