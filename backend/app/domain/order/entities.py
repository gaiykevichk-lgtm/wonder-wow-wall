from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .exceptions import (
    InvalidOrderTransitionError,
    OrderAlreadyCancelledError,
)
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
class OrderNote:
    """Phase 4B — internal admin annotation on an order.

    Notes are admin-only context (call summaries, dispute notes, ops
    handoffs). They are NEVER shown to the customer; the API serializer
    omits them from the customer-facing endpoints.
    """

    id: str = field(default_factory=lambda: str(uuid4()))
    author_id: str = ""
    text: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


# Terminal states cannot transition further. Used by `cancel`/`refund` to
# reject re-cancellation of an already-closed order with the more specific
# `OrderAlreadyCancelledError` (still a 409, but easier to recognise).
_TERMINAL_STATUSES = frozenset(
    {OrderStatus.INSTALLED, OrderStatus.CANCELLED, OrderStatus.REFUNDED}
)


@dataclass
class Order:
    """Aggregate Root for Order bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    number: str = ""
    user_id: str = ""
    status: OrderStatus = OrderStatus.PLACED
    items: list[OrderItem] = field(default_factory=list)
    address: Address = field(default_factory=lambda: Address("", "", ""))
    installation_date: datetime | None = None
    # Phase 4B — termination context. Single column reused for both
    # `cancel` and `refund` because the states are mutually exclusive and
    # both need a free-form admin-supplied reason.
    cancel_reason: str | None = None
    notes: list[OrderNote] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def total(self) -> int:
        return sum(item.subtotal for item in self.items)

    def confirm(self) -> None:
        if self.status != OrderStatus.PLACED:
            raise InvalidOrderTransitionError(
                f"Cannot confirm order in status {self.status}"
            )
        self.status = OrderStatus.CONFIRMED
        self.updated_at = datetime.utcnow()

    def start_work(self) -> None:
        if self.status != OrderStatus.CONFIRMED:
            raise InvalidOrderTransitionError(
                f"Cannot start work on order in status {self.status}"
            )
        self.status = OrderStatus.IN_PROGRESS
        self.updated_at = datetime.utcnow()

    def mark_delivered(self) -> None:
        """IN_PROGRESS → DELIVERED. Phase 4B."""
        if self.status != OrderStatus.IN_PROGRESS:
            raise InvalidOrderTransitionError(
                f"Cannot mark delivered from status {self.status}"
            )
        self.status = OrderStatus.DELIVERED
        self.updated_at = datetime.utcnow()

    def mark_installed(self) -> None:
        """DELIVERED → INSTALLED (terminal happy state). Phase 4B."""
        if self.status != OrderStatus.DELIVERED:
            raise InvalidOrderTransitionError(
                f"Cannot mark installed from status {self.status}"
            )
        self.status = OrderStatus.INSTALLED
        self.updated_at = datetime.utcnow()

    def cancel(self, reason: str) -> None:
        """Phase 4B — cancel order from any non-terminal state.

        `reason` is required (free text from admin) so we can answer
        "why was this cancelled?" later — empty/whitespace is rejected to
        avoid a useless audit trail.
        """
        if self.status in _TERMINAL_STATUSES:
            raise OrderAlreadyCancelledError(
                f"Cannot cancel order in terminal status {self.status}"
            )
        if not reason or not reason.strip():
            raise ValueError("Cancel reason is required")
        self.status = OrderStatus.CANCELLED
        self.cancel_reason = reason.strip()
        self.updated_at = datetime.utcnow()

    def refund(self, reason: str) -> None:
        """Phase 4B — refund a *delivered* or *installed* order.

        Only paid-and-shipped orders can be refunded; refunding from
        earlier statuses would mean "cancel", which is the right verb for
        that case. Plan calls out refund as a separate action so the
        downstream finance flow can branch on `OrderStatus.REFUNDED`.
        """
        if self.status not in {OrderStatus.DELIVERED, OrderStatus.INSTALLED}:
            raise InvalidOrderTransitionError(
                f"Cannot refund order in status {self.status}"
            )
        if not reason or not reason.strip():
            raise ValueError("Refund reason is required")
        self.status = OrderStatus.REFUNDED
        self.cancel_reason = reason.strip()
        self.updated_at = datetime.utcnow()

    def add_note(self, author_id: str, text: str) -> OrderNote:
        """Phase 4B — append an internal admin note. Returns the created note."""
        if not text or not text.strip():
            raise ValueError("Note text is required")
        if not author_id:
            raise ValueError("Note author_id is required")
        note = OrderNote(author_id=author_id, text=text.strip())
        self.notes.append(note)
        self.updated_at = datetime.utcnow()
        return note

    def add_item(self, item: OrderItem) -> None:
        self.items.append(item)
        self.updated_at = datetime.utcnow()
