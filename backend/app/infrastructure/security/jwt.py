from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"

# Phase 1 — legacy tokens (issued before `role` was added to the payload)
# get this default so existing customers do NOT have to re-login. See R1.
_LEGACY_ROLE_DEFAULT = "CUSTOMER"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, role: str = _LEGACY_ROLE_DEFAULT) -> str:
    """Encode `{sub, role, exp}` JWT.

    `role` defaults to `CUSTOMER` so a handful of test sites that still call
    `create_access_token(user_id)` keep working; production paths (Login /
    Register) pass the real role explicitly.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> tuple[str, str] | None:
    """Returns `(user_id, role)` or `None` if invalid.

    R1 — legacy tokens without a `role` claim are decoded as
    `(user_id, "CUSTOMER")` so customers stay signed in during the rollout
    of Phase 1. This is safe because admin routes also check the role via
    `require_admin`, which queries the DB.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    role = payload.get("role", _LEGACY_ROLE_DEFAULT)
    return user_id, role
