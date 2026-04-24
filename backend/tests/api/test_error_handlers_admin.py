"""Unit tests for Phase 1 domain→HTTP error handlers.

`last_admin_removal_handler` and `not_authorized_handler` are registered in
`app/main.py` but Phase 1 has no endpoint that raises the exceptions yet
(Phase 5 will). Still, we lock the response shape now so the frontend can
code against the `code` field without waiting for Phase 5 to ship.
"""

import json

import pytest

from app.domain.user.exceptions import LastAdminRemovalError, NotAuthorizedError
from app.infrastructure.api.error_handlers import (
    last_admin_removal_handler,
    not_authorized_handler,
)


@pytest.mark.asyncio
async def test_last_admin_removal_handler_returns_409_with_code():
    exc = LastAdminRemovalError("Cannot remove the last admin")
    resp = await last_admin_removal_handler(request=None, exc=exc)  # type: ignore[arg-type]

    assert resp.status_code == 409
    body = json.loads(resp.body)
    assert body == {
        "detail": "Cannot remove the last admin",
        "code": "last_admin",
    }


@pytest.mark.asyncio
async def test_not_authorized_handler_returns_403_with_code():
    exc = NotAuthorizedError("Actor lacks admin role")
    resp = await not_authorized_handler(request=None, exc=exc)  # type: ignore[arg-type]

    assert resp.status_code == 403
    body = json.loads(resp.body)
    assert body == {
        "detail": "Actor lacks admin role",
        "code": "not_authorized",
    }


def test_handlers_registered_in_app():
    """Guard against main.py being refactored and silently dropping the
    registration (the handlers themselves above are still importable, but
    without registration they never fire).
    """
    from app.main import app

    registered = app.exception_handlers
    assert LastAdminRemovalError in registered
    assert NotAuthorizedError in registered
