"""Domain exceptions for the User bounded context.

Phase 1 (admin panel): role-management errors used by role-related use cases
and mapped to HTTP responses in `infrastructure/api/error_handlers.py`.

    LastAdminRemovalError   → 409 (last_admin)
    NotAuthorizedError      → 403 (not_authorized)
"""


class LastAdminRemovalError(Exception):
    """Attempted to demote / revoke the only remaining admin.

    The system must always keep at least one admin to avoid a bricked deploy
    where no user can reach `/api/admin/*`. Enforced at the use-case layer
    (`RevokeAdminRole.execute`) via `UserRepository.count_admins()`.
    """


class NotAuthorizedError(Exception):
    """Actor lacks the role required for the requested operation.

    Distinct from "not authenticated" (401, raised by `get_current_user_id`
    when no/invalid token): this one is "you *are* signed in, but your role
    is not sufficient" → 403.
    """
