from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.domain.user.value_objects import UserRole
from app.infrastructure.security.jwt import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    decoded = decode_access_token(credentials.credentials)
    if decoded is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id, _role = decoded
    return user_id


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    if credentials is None:
        return None
    decoded = decode_access_token(credentials.credentials)
    if decoded is None:
        return None
    return decoded[0]


async def get_current_admin_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """Phase 1 — admin-only guard for `/api/admin/*` routes.

    Two-step check:
    1. Token must decode (401 otherwise — same as `get_current_user_id`).
    2. Token's `role` claim must equal `ADMIN` (403 otherwise).

    NB: we trust the `role` in the token for routing-level gating because
    tokens are signed with `JWT_SECRET`; downgrading `role: ADMIN` would
    require forging a signature. For defense-in-depth, admin use cases
    (e.g. `RevokeAdminRole`) also call `RequireAdmin` which re-reads the
    user from the DB — that closes the window if a role is revoked mid-
    session and the stale token is replayed.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    decoded = decode_access_token(credentials.credentials)
    if decoded is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id, role = decoded
    if role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user_id
