"""Phase 5 — `Login` refuses blocked accounts with `UserBlockedError`.

This test file covers ONLY the new failure mode added in Phase 5; the
happy-path login regression is in `tests/application/test_user_use_cases.py`
(or wherever Login was originally tested). Keeping the new behavior in its
own file makes the audit trail obvious and stops a future Login refactor
from accidentally erasing the block check during a merge conflict.
"""

import pytest

from app.application.user.use_cases import Login, Register
from app.domain.user.exceptions import UserBlockedError
from app.infrastructure.persistence.repositories.memory import InMemoryUserRepository


@pytest.fixture
def repo() -> InMemoryUserRepository:
    return InMemoryUserRepository()


async def _register(repo, email: str = "u@test.ru", password: str = "secret123") -> str:
    """Register through the Register use case so the password hash matches
    what `verify_password` expects — bypassing it would leave us testing
    a non-realistic state.
    """
    out = await Register(repo).execute(
        name="N", email=email, phone="", password=password,
    )
    return out["user"].id


class TestLoginBlocked:
    @pytest.mark.asyncio
    async def test_blocked_user_cannot_login(self, repo):
        user_id = await _register(repo)
        # Block the user by mutating the in-memory repo directly — we're
        # testing Login, not BlockUserAdmin.
        user = await repo.get_by_id(user_id)
        user.block()
        await repo.update(user)

        with pytest.raises(UserBlockedError):
            await Login(repo).execute(email="u@test.ru", password="secret123")

    @pytest.mark.asyncio
    async def test_active_user_logins_normally(self, repo):
        await _register(repo)
        out = await Login(repo).execute(email="u@test.ru", password="secret123")
        assert out["token"]
        assert out["user"].is_blocked is False

    @pytest.mark.asyncio
    async def test_wrong_password_on_blocked_account_returns_invalid_creds(self, repo):
        # Order of checks matters: a wrong password on a blocked account
        # must surface "Invalid email or password" (ValueError), NOT
        # `UserBlockedError`. Otherwise an attacker probing for valid
        # emails learns "this email is blocked" → confirms the address
        # is registered.
        user_id = await _register(repo)
        user = await repo.get_by_id(user_id)
        user.block()
        await repo.update(user)

        with pytest.raises(ValueError):
            await Login(repo).execute(email="u@test.ru", password="WRONG")

    @pytest.mark.asyncio
    async def test_unblock_restores_login(self, repo):
        user_id = await _register(repo)
        user = await repo.get_by_id(user_id)
        user.block()
        await repo.update(user)

        with pytest.raises(UserBlockedError):
            await Login(repo).execute(email="u@test.ru", password="secret123")

        user.unblock()
        await repo.update(user)
        out = await Login(repo).execute(email="u@test.ru", password="secret123")
        assert out["token"]
