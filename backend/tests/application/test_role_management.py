"""Use-case-layer tests for Phase 1 role management.

Scope:
    * authorization check (`_ensure_actor_is_admin`) for Grant/Revoke
    * SYSTEM bootstrap actor bypass (CLI seeds the first admin)
    * happy path for promote/demote
    * last-admin protection (E1) — lives here, not in the entity, because
      the domain can't see the repository (Dependency Rule)
    * idempotent revoke on a non-admin target
    * `RequireAdmin` pure-gate use case
"""

import pytest

from app.application.user.use_cases import (
    GrantAdminRole,
    RevokeAdminRole,
    RequireAdmin,
)
from app.domain.user.entities import User
from app.domain.user.exceptions import LastAdminRemovalError, NotAuthorizedError, UserNotFoundError
from app.domain.user.value_objects import UserRole
from app.infrastructure.persistence.repositories.memory import InMemoryUserRepository


@pytest.fixture
def repo() -> InMemoryUserRepository:
    return InMemoryUserRepository()


async def _seed(repo: InMemoryUserRepository, *, email: str, role: UserRole = UserRole.CUSTOMER) -> User:
    user = User(email=email, name=email.split("@")[0], role=role)
    return await repo.create(user)


# ─── GrantAdminRole ──────────────────────────────────────────────────

class TestGrantAdminRole:
    @pytest.mark.asyncio
    async def test_system_actor_can_grant_first_admin(self, repo):
        target = await _seed(repo, email="first@test.ru")
        uc = GrantAdminRole(repo)

        result = await uc.execute(actor_id="SYSTEM", target_user_id=target.id)

        assert result.role == UserRole.ADMIN
        assert result.is_admin is True

    @pytest.mark.asyncio
    async def test_admin_actor_can_grant_another_admin(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="new@test.ru")
        uc = GrantAdminRole(repo)

        result = await uc.execute(actor_id=admin.id, target_user_id=target.id)

        assert result.role == UserRole.ADMIN
        assert await repo.count_admins() == 2

    @pytest.mark.asyncio
    async def test_customer_cannot_grant_admin(self, repo):
        actor = await _seed(repo, email="c@test.ru")
        target = await _seed(repo, email="t@test.ru")
        uc = GrantAdminRole(repo)

        with pytest.raises(NotAuthorizedError):
            await uc.execute(actor_id=actor.id, target_user_id=target.id)

        fresh = await repo.get_by_id(target.id)
        assert fresh.role == UserRole.CUSTOMER

    @pytest.mark.asyncio
    async def test_unknown_actor_raises_not_authorized(self, repo):
        target = await _seed(repo, email="t@test.ru")
        uc = GrantAdminRole(repo)

        with pytest.raises(NotAuthorizedError):
            await uc.execute(actor_id="does-not-exist", target_user_id=target.id)

    @pytest.mark.asyncio
    async def test_grant_on_missing_target_raises_not_found(self, repo):
        uc = GrantAdminRole(repo)
        with pytest.raises(UserNotFoundError):
            await uc.execute(actor_id="SYSTEM", target_user_id="missing")

    @pytest.mark.asyncio
    async def test_grant_on_existing_admin_is_idempotent(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        target = await _seed(repo, email="already@test.ru", role=UserRole.ADMIN)
        uc = GrantAdminRole(repo)

        result = await uc.execute(actor_id=admin.id, target_user_id=target.id)

        assert result.role == UserRole.ADMIN
        assert await repo.count_admins() == 2


# ─── RevokeAdminRole ─────────────────────────────────────────────────

class TestRevokeAdminRole:
    @pytest.mark.asyncio
    async def test_admin_can_revoke_another_admin(self, repo):
        a1 = await _seed(repo, email="a1@test.ru", role=UserRole.ADMIN)
        a2 = await _seed(repo, email="a2@test.ru", role=UserRole.ADMIN)
        uc = RevokeAdminRole(repo)

        result = await uc.execute(actor_id=a1.id, target_user_id=a2.id)

        assert result.role == UserRole.CUSTOMER
        assert await repo.count_admins() == 1

    @pytest.mark.asyncio
    async def test_cannot_revoke_last_admin(self, repo):
        solo = await _seed(repo, email="solo@test.ru", role=UserRole.ADMIN)
        uc = RevokeAdminRole(repo)

        with pytest.raises(LastAdminRemovalError):
            await uc.execute(actor_id=solo.id, target_user_id=solo.id)

        # And the admin remains admin after the failed call
        fresh = await repo.get_by_id(solo.id)
        assert fresh.role == UserRole.ADMIN

    @pytest.mark.asyncio
    async def test_revoke_on_customer_is_idempotent_noop(self, repo):
        admin = await _seed(repo, email="admin@test.ru", role=UserRole.ADMIN)
        customer = await _seed(repo, email="c@test.ru")
        uc = RevokeAdminRole(repo)

        result = await uc.execute(actor_id=admin.id, target_user_id=customer.id)

        assert result.role == UserRole.CUSTOMER
        assert await repo.count_admins() == 1

    @pytest.mark.asyncio
    async def test_customer_cannot_revoke(self, repo):
        actor = await _seed(repo, email="c@test.ru")
        admin = await _seed(repo, email="a@test.ru", role=UserRole.ADMIN)
        uc = RevokeAdminRole(repo)

        with pytest.raises(NotAuthorizedError):
            await uc.execute(actor_id=actor.id, target_user_id=admin.id)

    @pytest.mark.asyncio
    async def test_revoke_on_missing_target_raises_not_found(self, repo):
        admin = await _seed(repo, email="a@test.ru", role=UserRole.ADMIN)
        uc = RevokeAdminRole(repo)

        with pytest.raises(UserNotFoundError):
            await uc.execute(actor_id=admin.id, target_user_id="missing")

    @pytest.mark.asyncio
    async def test_system_actor_can_revoke(self, repo):
        # Seed two admins so last-admin protection does not fire
        a1 = await _seed(repo, email="a1@test.ru", role=UserRole.ADMIN)
        await _seed(repo, email="a2@test.ru", role=UserRole.ADMIN)
        uc = RevokeAdminRole(repo)

        result = await uc.execute(actor_id="SYSTEM", target_user_id=a1.id)

        assert result.role == UserRole.CUSTOMER


# ─── RequireAdmin (pure gate) ────────────────────────────────────────

class TestRequireAdminUseCase:
    @pytest.mark.asyncio
    async def test_passes_for_admin(self, repo):
        admin = await _seed(repo, email="a@test.ru", role=UserRole.ADMIN)
        uc = RequireAdmin(repo)

        # Should not raise
        await uc.execute(admin.id)

    @pytest.mark.asyncio
    async def test_raises_for_customer(self, repo):
        customer = await _seed(repo, email="c@test.ru")
        uc = RequireAdmin(repo)

        with pytest.raises(NotAuthorizedError):
            await uc.execute(customer.id)

    @pytest.mark.asyncio
    async def test_raises_for_unknown_user(self, repo):
        uc = RequireAdmin(repo)

        with pytest.raises(NotAuthorizedError):
            await uc.execute("ghost")
