"""Phase 7A — `Design` and `Category` domain exceptions.

Kept in their own module (not `entities.py`) so the API layer can import
the exception without pulling the entity definition. Same separation as
`panel_exceptions.py` (Phase 7B) and `media/exceptions.py` (Phase 6).
"""
from __future__ import annotations


class DesignNotFoundError(LookupError):
    """Requested design id does not exist.

    `LookupError` so plain `except LookupError:` blocks in test scaffolding
    catch it; mapped to HTTP 404 in the admin API layer.
    """


class DesignSlugConflictError(ValueError):
    """A design with the supplied slug already exists.

    Mapped to HTTP 409 by the admin API. Surfaced as an explicit domain
    exception (not a bare `ValueError`) so the frontend can branch on
    `code == "design_slug_conflict"` and highlight the slug input rather
    than rendering a generic toast.
    """


class CategoryNotFoundError(LookupError):
    """Requested category id does not exist."""


class CategorySlugConflictError(ValueError):
    """A category with the supplied slug already exists."""


class CategoryInUseError(ValueError):
    """Refused to delete a category that still has designs attached.

    Mapped to HTTP 409 by the admin API. The admin must move or delete
    the bound designs first; we do NOT cascade-delete designs because
    they may be referenced from order rows (`OrderItem.design_id`) and
    from `Recommendation` aggregates — silently nuking them would be a
    data-loss footgun. Same posture as `OrderInUseError`-style refusals
    in other domains.
    """
