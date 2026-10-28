"""Phase 5 — domain-level tests for `User.block` / `User.unblock`.

Mirrors the structure of `test_user_role.py`: pure entity invariants only,
no repository, no use-case orchestration. Last-admin protection is a
use-case concern (see `tests/application/test_block_user_admin.py`).
"""

from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole


class TestUserBlock:
    def test_default_is_not_blocked(self):
        user = User(name="N", email="n@test.ru")
        assert user.is_blocked is False

    def test_block_sets_flag(self):
        user = User(name="N", email="n@test.ru")
        user.block()
        assert user.is_blocked is True

    def test_block_is_idempotent(self):
        # No exception raised, flag stays True.
        user = User(name="N", email="n@test.ru", is_blocked=True)
        user.block()
        assert user.is_blocked is True

    def test_unblock_clears_flag(self):
        user = User(name="N", email="n@test.ru", is_blocked=True)
        user.unblock()
        assert user.is_blocked is False

    def test_unblock_is_idempotent(self):
        user = User(name="N", email="n@test.ru")
        user.unblock()
        assert user.is_blocked is False

    def test_block_does_not_change_role(self):
        # Blocking an admin keeps their role — when unblocked they remain
        # admin. This matters for the unblock flow: the admin row should
        # still appear in the "admins" filter after the round-trip.
        admin = User(name="A", email="a@test.ru", role=UserRole.ADMIN)
        admin.block()
        assert admin.role == UserRole.ADMIN
        admin.unblock()
        assert admin.role == UserRole.ADMIN
