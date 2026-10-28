"""Domain-layer tests for Phase 1 role management.

Covers entity-local invariants only:
    * default role is CUSTOMER
    * promote_to_admin / demote_to_customer transitions
    * idempotent promote (granting admin to an admin is a no-op)

Last-admin protection is intentionally NOT tested here — it lives in the
use-case layer (`tests/application/test_role_management.py`) because the
entity can't see the repository and enforcing it here would violate the
Dependency Rule.
"""

from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole


class TestUserRoleDefault:
    def test_new_user_is_customer(self):
        user = User(email="u@test.ru", name="U")
        assert user.role == UserRole.CUSTOMER
        assert user.is_admin is False


class TestUserRoleTransitions:
    def test_promote_sets_admin(self):
        user = User(email="u@test.ru", name="U")
        user.promote_to_admin()
        assert user.role == UserRole.ADMIN
        assert user.is_admin is True

    def test_demote_sets_customer(self):
        user = User(email="u@test.ru", name="U", role=UserRole.ADMIN)
        user.demote_to_customer()
        assert user.role == UserRole.CUSTOMER
        assert user.is_admin is False

    def test_promote_is_idempotent(self):
        user = User(email="u@test.ru", name="U", role=UserRole.ADMIN)
        user.promote_to_admin()
        assert user.role == UserRole.ADMIN

    def test_demote_is_idempotent(self):
        user = User(email="u@test.ru", name="U", role=UserRole.CUSTOMER)
        user.demote_to_customer()
        assert user.role == UserRole.CUSTOMER


class TestUserRoleValueObject:
    def test_role_is_string_enum(self):
        assert UserRole.ADMIN.value == "ADMIN"
        assert UserRole.CUSTOMER.value == "CUSTOMER"

    def test_role_from_string(self):
        assert UserRole("ADMIN") == UserRole.ADMIN
        assert UserRole("CUSTOMER") == UserRole.CUSTOMER
