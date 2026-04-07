from app.domain.user.entities import User
from app.domain.user.repositories import UserRepository
from app.domain.user.value_objects import Email
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
        token = create_access_token(user.id)
        return {"user": user, "token": token}


class Login:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def execute(self, email: str, password: str) -> dict:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        token = create_access_token(user.id)
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
