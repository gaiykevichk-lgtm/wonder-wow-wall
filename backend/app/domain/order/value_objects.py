from dataclasses import dataclass
from enum import Enum


class OrderStatus(str, Enum):
    PLACED = "placed"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    INSTALLED = "installed"

    @property
    def label_ru(self) -> str:
        return {
            "placed": "Оформлен",
            "confirmed": "Подтверждён",
            "in_progress": "В работе",
            "delivered": "Доставлен",
            "installed": "Установлен",
        }[self.value]


@dataclass(frozen=True)
class Address:
    city: str
    street: str
    building: str
    apartment: str = ""
    postal_code: str = ""

    @property
    def full(self) -> str:
        parts = [self.city, self.street, f"д. {self.building}"]
        if self.apartment:
            parts.append(f"кв. {self.apartment}")
        return ", ".join(parts)


@dataclass(frozen=True)
class Money:
    amount: int
    currency: str = "RUB"

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError("Cannot add different currencies")
        return Money(self.amount + other.amount, self.currency)

    def __mul__(self, factor: int) -> "Money":
        return Money(self.amount * factor, self.currency)
