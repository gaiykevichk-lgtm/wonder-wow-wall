"""Domain exceptions for the User bounded context.

Phase 1 (admin panel): role-management errors used by role-related use cases
and mapped to HTTP responses in `infrastructure/api/error_handlers.py`.

    LastAdminRemovalError   → 409 (last_admin)
    NotAuthorizedError      → 403 (not_authorized)
    UserBlockedError        → 403 (user_blocked)   # Phase 5
    UserNotFoundError       → 404 (user_not_found)  # Phase 5 review
"""


class LastAdminRemovalError(Exception):
    """Attempted to demote / revoke the only remaining admin.

    The system must always keep at least one admin to avoid a bricked deploy
    where no user can reach `/api/admin/*`. Enforced at the use-case layer
    (`RevokeAdminRole.execute`) via `UserRepository.count_admins()`.

    Phase 5 — also raised by `BlockUserAdmin` if the target is the last
    admin (a blocked admin cannot log in, which has the same effect as
    demoting the last admin: no one can reach `/api/admin/*`).
    """


class NotAuthorizedError(Exception):
    """Actor lacks the role required for the requested operation.

    Distinct from "not authenticated" (401, raised by `get_current_user_id`
    when no/invalid token): this one is "you *are* signed in, but your role
    is not sufficient" → 403.
    """


class UserBlockedError(Exception):
    """Login refused because the account is blocked (Phase 5).

    Distinct from `NotAuthorizedError`: the user *might* have valid
    credentials, but the account itself is disabled. The frontend branches
    on `code: "user_blocked"` to show "Аккаунт заблокирован, обратитесь
    к поддержке" instead of the generic "Неверный email или пароль".
    """


class UserNotFoundError(LookupError):
    """Requested user does not exist.

    Mapped to 404 + `{detail, code: "user_not_found"}` by the global
    handler in `error_handlers.py`. Subclasses `LookupError` so callers
    can use a generic `except` if they don't care about the bounded
    context — same convention as `OrderNotFoundError`.
    """
