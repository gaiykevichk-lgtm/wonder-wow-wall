from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import UserRole


@dataclass
class UserAddress:
    id: str = field(default_factory=lambda: str(uuid4()))
    label: str = ""
    city: str = ""
    street: str = ""
    building: str = ""
    apartment: str = ""
    postal_code: str = ""
    is_default: bool = False


@dataclass
class User:
    """Aggregate Root for User bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    email: str = ""
    password_hash: str = ""
    name: str = ""
    phone: str = ""
    addresses: list[UserAddress] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    role: UserRole = UserRole.CUSTOMER

    def update_profile(self, name: str | None = None, phone: str | None = None) -> None:
        if name is not None:
            self.name = name
        if phone is not None:
            self.phone = phone

    def add_address(self, address: UserAddress) -> None:
        if address.is_default:
            for a in self.addresses:
                a.is_default = False
        self.addresses.append(address)

    def remove_address(self, address_id: str) -> None:
        self.addresses = [a for a in self.addresses if a.id != address_id]

    def set_default_address(self, address_id: str) -> None:
        for a in self.addresses:
            a.is_default = a.id == address_id

    # ─── Role management (Phase 1) ───────────────────────────────────

    def promote_to_admin(self) -> None:
        """Idempotent: granting ADMIN to an already-ADMIN is a no-op (E2)."""
        self.role = UserRole.ADMIN

    def demote_to_customer(self) -> None:
        """Demotes to CUSTOMER. Last-admin protection is enforced at the
        use-case layer (`RevokeAdminRole`), NOT here — the entity has no
        view of the repository, and injecting it would break the Dependency
        Rule. The entity's job is local invariants only.
        """
        self.role = UserRole.CUSTOMER

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN
