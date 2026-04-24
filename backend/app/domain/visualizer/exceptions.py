"""Domain exceptions for the Visualizer bounded context.

Mapped to HTTP responses by `infrastructure/api/error_handlers.py` in Phase 5C:
    CollinearCornersError   → 422  (degenerate_corners)
    StaleSceneVersionError  → 409  (stale_version, with current state)
"""


class CollinearCornersError(ValueError):
    """Perspective quadrilateral has zero/near-zero area (4 collinear or
    near-collinear points). Raised by `PerspectiveCorners.__post_init__`
    and by `PerspectiveCorners.from_dicts` for malformed input.

    Subclasses `ValueError` because a degenerate quad is fundamentally a
    value-domain problem; catch sites that already handle `ValueError`
    for VO validation continue to work.
    """


class DepthEstimationError(Exception):
    """Phase 6 — monocular-depth inference failed.

    Raised by adapters implementing `DepthEstimator`. Failure modes:
    * Model checkpoint missing on disk (deployment misconfiguration).
    * `onnxruntime` import error (production image built without ML deps).
    * Image bytes cannot be decoded (corrupt upload).
    * Inference timed out or threw at the runtime boundary.

    Mapped to HTTP 503 by `infrastructure/api/error_handlers.py` — the user
    keeps manual perspective and the frontend logs/swallows; depth is a
    fallback, never a hard requirement.
    """


class PlaneFittingError(Exception):
    """Phase 6 — RANSAC could not find a dominant plane in the depth map
    inside the wall mask. Typical causes: mask too small (<50 px), depth map
    is uniform (failed inference), wall surface is not planar (curtain, fabric).

    Mapped to HTTP 422 — the request was well-formed but the algorithm could
    not produce a result.
    """


class StaleSceneVersionError(Exception):
    """Optimistic-lock conflict: the `version` carried by the inbound
    `VisualizationProject` does not match the row in the database.

    Multi-tab scenario (E8 in plan): tab A writes version 7, tab B —
    still holding version 6 — tries to PATCH; server raises this so
    the API can return 409 with the current state and the frontend
    can prompt the user to reconcile.

    Carries `client_version` and `server_version` so the API layer can
    surface them in the 409 body — the frontend uses `server_version` as
    the next read-marker when it refetches (B45 closure).
    """

    def __init__(self, message: str, client_version: int | None = None,
                 server_version: int | None = None):
        super().__init__(message)
        self.client_version = client_version
        self.server_version = server_version
