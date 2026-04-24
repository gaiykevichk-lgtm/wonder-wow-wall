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


class StaleSceneVersionError(Exception):
    """Optimistic-lock conflict: the `version` carried by the inbound
    `VisualizationProject` does not match the row in the database.

    Multi-tab scenario (E8 in plan): tab A writes version 7, tab B —
    still holding version 6 — tries to PATCH; server raises this so
    the API can return 409 with the current state and the frontend
    can prompt the user to reconcile.
    """
