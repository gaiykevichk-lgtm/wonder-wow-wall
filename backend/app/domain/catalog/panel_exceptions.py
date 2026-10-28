"""Phase 7B — `Panel` domain exceptions.

Kept in their own module (not `entities.py`) so the API layer can import
the exception without pulling the entity definition. Same separation as
`media/exceptions.py` from Phase 6.
"""
from __future__ import annotations


class PanelNotFoundError(LookupError):
    """Requested panel id (or slug) does not exist.

    `LookupError` so plain `except LookupError:` blocks in test scaffolding
    catch it; mapped to HTTP 404 in the admin API layer.
    """


class PanelSlugConflictError(ValueError):
    """A panel with the supplied slug already exists.

    Mapped to HTTP 409 by the admin API. We surface this as an explicit
    domain exception (not a bare `ValueError`) so the frontend can branch
    on `code == "panel_slug_conflict"` and highlight the slug input
    rather than rendering a generic toast.
    """


class PanelSizeConflictError(ValueError):
    """A base form (name) already has the requested size.

    One named form may exist in 30x30, 30x60 and 60x60 at most — never
    two rows with the same name + dimensions. Mapped to HTTP 409 with
    `code == "panel_size_conflict"` so the admin UI can show the error
    next to the size picker instead of creating an exact duplicate.
    """
