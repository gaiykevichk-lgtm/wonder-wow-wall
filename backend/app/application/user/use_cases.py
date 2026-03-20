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
