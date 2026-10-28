import re
from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self):
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(pattern, self.value):
            raise ValueError(f"Invalid email: {self.value}")

    def __str__(self) -> str:
        return self.value


class UserRole(str, Enum):
    """Role gate for admin-panel access (Phase 1).

    Binary for MVP (OQ4): `CUSTOMER` is the default for every new user,
    `ADMIN` is granted explicitly via `GrantAdminRole` use case / CLI.
    Fine-grained roles (operator, content manager, etc.) are deliberately
    out of scope — audit log (Phase 9) covers accountability on top of the
    binary gate.
    """

    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"
