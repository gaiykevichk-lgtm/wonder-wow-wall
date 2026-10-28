"""Phase 4B — domain-level exceptions for Order status transitions.

Why a dedicated module
──────────────────────
The original aggregate raised plain `ValueError` for forbidden transitions.
Phase 4B needs the API layer to translate transition errors into HTTP 409
(plus a machine-readable `code` for the frontend to branch on), which is
only safe with a *typed* exception that the handler can register.

Backwards compatibility
───────────────────────
`InvalidOrderTransitionError` extends `ValueError` so the existing
`tests/domain/test_order.py` assertions written as
`pytest.raises(ValueError)` keep passing. New call sites can catch the
narrower type to differentiate "wrong status" (recoverable, user error)
from a generic ValueError (programmer error).
"""

from __future__ import annotations


class InvalidOrderTransitionError(ValueError):
    """Order status transition not allowed from the current state.

    Mapped to HTTP 409 by `error_handlers.invalid_order_transition_handler`
    with `code: "invalid_transition"` so the admin UI can show a toast
    instead of a generic error.
    """


class OrderAlreadyCancelledError(InvalidOrderTransitionError):
    """Specialised case: cancel/refund called on an already-terminal order.

    Kept as a subclass so generic 409 mapping still applies, but call sites
    that want to distinguish "double-click on Cancel" from "wrong-status
    transition" can catch this type specifically.
    """
