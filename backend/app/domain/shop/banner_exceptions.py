"""Phase 8B — `Banner` domain exceptions.

Kept in their own module so the API layer can import the exception
without pulling the entity definition. Same separation pattern as
`panel_exceptions.py` (Phase 7B) and `media/exceptions.py` (Phase 6).
"""
from __future__ import annotations


class BannerNotFoundError(LookupError):
    """Requested banner id does not exist.

    Mapped to HTTP 404 in the admin API. `LookupError` so plain
    `except LookupError:` blocks in test scaffolding catch it.
    """
