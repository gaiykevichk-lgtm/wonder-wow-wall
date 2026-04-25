"""Phase 8B — domain exceptions for the `Banner` aggregate.

Mirrors the Phase 7B `panel_exceptions.py` posture: each exception is a
plain `LookupError` / `ValueError` subclass so callers that don't
explicitly catch them still see the right semantic family. The HTTP
mapping lives in `infrastructure/api/error_handlers.py`.
"""
from __future__ import annotations


class BannerNotFoundError(LookupError):
    """Raised when a use case is asked to load a banner id that doesn't
    exist (admin update/delete/get on a stale id). Maps to HTTP 404 +
    `{detail, code: "banner_not_found"}` at the API layer.
    """
