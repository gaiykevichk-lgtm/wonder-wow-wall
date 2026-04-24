from app.domain.user.entities import User
from app.domain.user.exceptions import LastAdminRemovalError, NotAuthorizedError
from app.domain.user.repositories import UserRepository
from app.domain.user.value_objects import Email, UserRole
from app.infrastructure.security.jwt import hash_password, verify_password, create_access_token


class Register:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, name: str, email: str, phone: str, password: str) -> dict:
        # Validate email format
        Email(email)

        # Check uniqueness
        existing = await self.repo.get_by_email(email)
        if existing:
            raise ValueError("Email already registered")

        user = User(
            email=email,
            password_hash=hash_password(password),
            name=name,
            phone=phone,
        )
        user = await self.repo.create(user)
        token = create_access_token(user.id, user.role.value)
        return {"user": user, "token": token}


class Login:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, email: str, password: str) -> dict:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        token = create_access_token(user.id, user.role.value)
        return {"user": user, "token": token}


class GetProfile:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, user_id: str) -> User | None:
        return await self.repo.get_by_id(user_id)


class UpdateProfile:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, user_id: str, name: str | None = None, phone: str | None = None) -> User | None:
        user = await self.repo.get_by_id(user_id)
        if not user:
            return None
        user.update_profile(name=name, phone=phone)
        return await self.repo.update(user)


class ForgotPassword:
    """Generate a 6-digit reset token and store it in memory (placeholder for Redis).

    WARNING: _tokens is an in-memory dict — works only with a single uvicorn worker.
    Replace with Redis/DB storage before scaling to multiple workers.
    """
    _tokens: dict = {}

    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, email: str) -> dict:
        from datetime import datetime, timedelta
        import secrets
        user = await self.repo.get_by_email(email)
        if not user:
            # Don't reveal whether the email exists
            return {"status": "sent"}
        token = f"{secrets.randbelow(900000) + 100000}"
        ForgotPassword._tokens[email.lower()] = {
            "token": token,
            "expires": datetime.utcnow() + timedelta(minutes=15),
        }
        # Placeholder: log to console instead of real email
        print(f"[RESET PASSWORD] Email: {email}, Token: {token}")
        return {"status": "sent"}


class ResetPassword:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, email: str, token: str, new_password: str) -> dict:
        from datetime import datetime
        record = ForgotPassword._tokens.get(email.lower())
        if not record or record["token"] != token:
            raise ValueError("Invalid or expired token")
        if record["expires"] < datetime.utcnow():
            ForgotPassword._tokens.pop(email.lower(), None)
            raise ValueError("Invalid or expired token")
        user = await self.repo.get_by_email(email)
        if not user:
            raise ValueError("User not found")
        user.password_hash = hash_password(new_password)
        await self.repo.update(user)
        ForgotPassword._tokens.pop(email.lower(), None)
        return {"status": "reset"}


# ─── Phase 1: Role management ────────────────────────────────────────

class GrantAdminRole:
    """Promote a user to ADMIN. `actor_id` is captured for the Phase 9
    audit decorator; today it is only validated (actor must be admin or
    the `SYSTEM` bootstrap actor used by the CLI).
    """

    SYSTEM_ACTOR = "SYSTEM"

    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, actor_id: str, target_user_id: str) -> User:
        await _ensure_actor_is_admin(self.repo, actor_id)

        target = await self.repo.get_by_id(target_user_id)
        if target is None:
            raise ValueError(f"User not found: {target_user_id}")

        target.promote_to_admin()
        return await self.repo.update(target)


class RevokeAdminRole:
    """Demote an admin back to CUSTOMER. Blocks the operation if the target
    is the last remaining admin (E1) — raises `LastAdminRemovalError`.
    """

    SYSTEM_ACTOR = "SYSTEM"

    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, actor_id: str, target_user_id: str) -> User:
        await _ensure_actor_is_admin(self.repo, actor_id)

        target = await self.repo.get_by_id(target_user_id)
        if target is None:
            raise ValueError(f"User not found: {target_user_id}")

        if target.role != UserRole.ADMIN:
            # Idempotent no-op — consistent with GrantAdminRole for already-ADMIN.
            return target

        admin_count = await self.repo.count_admins()
        if admin_count <= 1:
            raise LastAdminRemovalError(
                "Cannot demote the last remaining admin — the system would become unmanageable."
            )

        target.demote_to_customer()
        return await self.repo.update(target)


class RequireAdmin:
    """Pure check: raises `NotAuthorizedError` if the user is not admin.
    Used by API dependency (`get_current_admin_id`) and anywhere we need a
    gate inside a composed use case.
    """

    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, user_id: str) -> None:
        user = await self.repo.get_by_id(user_id)
        if user is None or user.role != UserRole.ADMIN:
            raise NotAuthorizedError("Admin role required")


async def _ensure_actor_is_admin(repo: UserRepository, actor_id: str) -> None:
    """Internal helper — bootstrap `SYSTEM` actor bypasses the DB check so
    the CLI (`python -m app.cli grant_admin <email>`) can seed the very
    first admin before any admin exists. In audit entries the `SYSTEM`
    actor is recorded verbatim.
    """
    if actor_id == GrantAdminRole.SYSTEM_ACTOR:
        return
    actor = await repo.get_by_id(actor_id)
    if actor is None or actor.role != UserRole.ADMIN:
        raise NotAuthorizedError("Admin role required to manage roles")
