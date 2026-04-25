from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.domain.user.value_objects import UserRole
from app.infrastructure.security.jwt import decode_access_token

security = HTTPBearer(auto_error=False)


def get_request_ip(request: Request) -> str | None:
    """Phase 9 — extract the originating IP for audit-log stamping.

    Order of precedence:
      1. `X-Forwarded-For` first hop — when behind nginx/Cloudflare
         the real client IP lives there; `request.client.host` is the
         reverse proxy. We keep only the *first* entry because
         intermediate hops are appended on the right and an attacker
         can spoof the leftmost entries by setting the header
         themselves; the trust boundary is "the proxy we run".
      2. `request.client.host` — direct connection (local dev, tests).
      3. None — TestClient without an origin host.

    Returning a plain `str | None` lets the call site pass it straight
    to `RecordAuditEntry(audit_repo, request_ip=...)` without a
    separate null-check; the recorder treats None as "don't stamp".
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    return request.client.host if request.client else None


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
