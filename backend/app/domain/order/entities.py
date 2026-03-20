from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import OrderStatus, Address, Money


@dataclass
class OrderItem:
    id: str = field(default_factory=lambda: str(uuid4()))
    design_id: str = ""
    design_name: str = ""
    design_image: str = ""
    size_key: str = ""
    color: str = ""
    quantity: int = 1
    unit_price: int = 0

    @property
    def subtotal(self) -> int:
        return self.unit_price * self.quantity


@dataclass
class Order:
    """Aggregate Root for Order bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    number: str = ""
    user_id: str = ""
    status: OrderStatus = OrderStatus.PLACED
    items: list[OrderItem] = field(default_factory=list)
    address: Address = field(default_factory=lambda: Address("", "", ""))
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def total(self) -> int:
        return sum(item.subtotal for item in self.items)

    def confirm(self) -> None:
        if self.status != OrderStatus.PLACED:
            raise ValueError(f"Cannot confirm order in status {self.status}")
        self.status = OrderStatus.CONFIRMED
        self.updated_at = datetime.utcnow()

    def start_work(self) -> None:
        if self.status != OrderStatus.CONFIRMED:
            raise ValueError(f"Cannot start work on order in status {self.status}")
        self.status = OrderStatus.IN_PROGRESS
        self.updated_at = datetime.utcnow()

    def add_item(self, item: OrderItem) -> None:
        self.items.append(item)
        self.updated_at = datetime.utcnow()
