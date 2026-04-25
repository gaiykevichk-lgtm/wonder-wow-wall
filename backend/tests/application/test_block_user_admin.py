"""Phase 5 — `BlockUserAdmin` / `UnblockUserAdmin` use-case tests.

Mirrors the structure of `test_role_management.py`: in-memory repo,
focused on the orchestration that lives ABOVE the entity:
    * authorization (admin-only via `_ensure_actor_is_admin`)
    * idempotence (block-already-blocked / unblock-active = no-op)
    * last-active-admin protection (E1 extended to blocking, not just
      revoking — both have the same operational effect)
    * unknown-target → `UserNotFoundError`
"""

import pytest

from app.application.user.use_cases import (
    BlockUserAdmin,
    UnblockUserAdmin,
    UserNotFoundError,
)
from app.domain.user.entities import User
from app.domain.user.exceptions import LastAdminRemovalError, NotAuthorizedError
from app.domain.user.value_objects import UserRole
from app.infrastructure.persistence.repositories.memory import InMemoryUserRepository


@pytest.fixture
def repo() -> InMemoryUserRepository:
    return InMemoryUserRepository()


async def _seed(
    repo: InMemoryUserRepository,
    *,
    email: str,
    role: UserRole = UserRole.CUSTOMER,
    is_blocked: bool = False,
) -> User:
    user = User(
        email=email, name=email.split("@")[0], role=role, is_blocked=is_blocked,
    )
    return await repo.create(user)


# ─── BlockUserAdmin ──────────────────────────────────────────────────


class TestBlockUserAdmin:
    @pytest.mark.asyncio
    async def test_admin_can_block_customer(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="c@test.ru")

        result = await BlockUserAdmin(repo).execute(
            actor_id=admin.id, target_user_id=target.id,
        )

        assert result.is_blocked is True
        # Persisted to repo (not just mutated locally)
        fresh = await repo.get_by_id(target.id)
        assert fresh.is_blocked is True

    @pytest.mark.asyncio
    async def test_block_is_idempotent(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="c@test.ru", is_blocked=True)

        result = await BlockUserAdmin(repo).execute(
            actor_id=admin.id, target_user_id=target.id,
        )
        assert result.is_blocked is True

    @pytest.mark.asyncio
    async def test_customer_cannot_block(self, repo):
        actor = await _seed(repo, email="c@test.ru")
        target = await _seed(repo, email="t@test.ru")

        with pytest.raises(NotAuthorizedError):
            await BlockUserAdmin(repo).execute(
                actor_id=actor.id, target_user_id=target.id,
            )

        fresh = await repo.get_by_id(target.id)
        assert fresh.is_blocked is False

    @pytest.mark.asyncio
    async def test_block_missing_target_raises_not_found(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        with pytest.raises(UserNotFoundError):
            await BlockUserAdmin(repo).execute(
                actor_id=admin.id, target_user_id="missing",
            )

    @pytest.mark.asyncio
    async def test_admin_can_block_another_admin_when_two_exist(self, repo):
        a1 = await _seed(repo, email="a1@test.ru", role=UserRole.ADMIN)
        a2 = await _seed(repo, email="a2@test.ru", role=UserRole.ADMIN)

        result = await BlockUserAdmin(repo).execute(
            actor_id=a1.id, target_user_id=a2.id,
        )

        assert result.is_blocked is True
        # One active admin remains.
        assert await repo.count_active_admins() == 1

    @pytest.mark.asyncio
    async def test_cannot_block_last_active_admin(self, repo):
        solo = await _seed(repo, email="solo@test.ru", role=UserRole.ADMIN)

        with pytest.raises(LastAdminRemovalError):
            await BlockUserAdmin(repo).execute(
                actor_id=solo.id, target_user_id=solo.id,
            )

        fresh = await repo.get_by_id(solo.id)
        assert fresh.is_blocked is False

    @pytest.mark.asyncio
    async def test_blocking_blocked_admin_does_not_count_against_quota(self, repo):
        # Two admins, one already blocked. The blocked one is a no-op
        # block — must not raise even though there's only ONE active
        # admin left, because we're not removing from the active pool.
        a1 = await _seed(repo, email="a1@test.ru", role=UserRole.ADMIN)
        a2 = await _seed(repo, email="a2@test.ru", role=UserRole.ADMIN, is_blocked=True)

        # Blocking the blocked admin is idempotent and must not raise.
        result = await BlockUserAdmin(repo).execute(
            actor_id=a1.id, target_user_id=a2.id,
        )
        assert result.is_blocked is True

    @pytest.mark.asyncio
    async def test_system_actor_can_block(self, repo):
        # Two admins — same pattern as RevokeAdminRole's SYSTEM test.
        a1 = await _seed(repo, email="a1@test.ru", role=UserRole.ADMIN)
        await _seed(repo, email="a2@test.ru", role=UserRole.ADMIN)

        result = await BlockUserAdmin(repo).execute(
            actor_id="SYSTEM", target_user_id=a1.id,
        )
        assert result.is_blocked is True


# ─── UnblockUserAdmin ────────────────────────────────────────────────


class TestUnblockUserAdmin:
    @pytest.mark.asyncio
    async def test_admin_can_unblock(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="c@test.ru", is_blocked=True)

        result = await UnblockUserAdmin(repo).execute(
            actor_id=admin.id, target_user_id=target.id,
        )

        assert result.is_blocked is False

    @pytest.mark.asyncio
    async def test_unblock_is_idempotent(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="c@test.ru")

        result = await UnblockUserAdmin(repo).execute(
            actor_id=admin.id, target_user_id=target.id,
        )
        assert result.is_blocked is False

    @pytest.mark.asyncio
    async def test_customer_cannot_unblock(self, repo):
        actor = await _seed(repo, email="c@test.ru")
        target = await _seed(repo, email="t@test.ru", is_blocked=True)

        with pytest.raises(NotAuthorizedError):
            await UnblockUserAdmin(repo).execute(
                actor_id=actor.id, target_user_id=target.id,
            )

    @pytest.mark.asyncio
    async def test_unblock_missing_target_raises_not_found(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        with pytest.raises(UserNotFoundError):
            await UnblockUserAdmin(repo).execute(
                actor_id=admin.id, target_user_id="missing",
            )
