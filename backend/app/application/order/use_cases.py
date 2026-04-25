from datetime import datetime

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.order.entities import Order, OrderItem, OrderNote
from app.domain.order.exceptions import InvalidOrderTransitionError
from app.domain.order.filters import OrderFilters
from app.domain.order.repositories import OrderRepository
from app.domain.order.value_objects import Address, OrderStatus
from app.domain.order.services import calculate_wall_cost


class CreateOrder:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(
        self, user_id: str, items: list[dict], address: dict,
        installation_date: datetime | None = None,
    ) -> Order:
        number = await self.repo.generate_order_number()
        order = Order(
            number=number,
            user_id=user_id,
            address=Address(**address),
            installation_date=installation_date,
        )
        for item_data in items:
            order.add_item(OrderItem(
                design_id=item_data.get("design_id", ""),
                design_name=item_data.get("design_name", ""),
                design_image=item_data.get("design_image", ""),
                size_key=item_data.get("size_key", ""),
                color=item_data.get("color", ""),
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price", 0),
            ))
        return await self.repo.create(order)


class GetOrderHistory:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(self, user_id: str, offset: int = 0, limit: int = 20) -> list[Order]:
        return await self.repo.list_by_user(user_id, offset, limit)


class GetOrderDetails:
    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(self, order_id: str, user_id: str) -> Order | None:
        order = await self.repo.get_by_id(order_id)
        if order and order.user_id != user_id:
            return None
        return order


class CalculateWallCost:
    async def execute(self, panels: list[dict], has_subscription: bool = False) -> dict:
        return calculate_wall_cost(panels, has_subscription)


class OrderNotFoundError(LookupError):
    """Raised when an admin requests an order that doesn't exist.

    Mapped to HTTP 404 by the API layer. Subclasses LookupError so generic
    catch-all handlers don't accidentally swallow it as an internal error.
    """


class GetOrderAdmin:
    """Phase 4B — full-detail order fetch for the admin detail page.

    No user-scope check (unlike `GetOrderDetails` which restricts to the
    order owner): admins can view any order. Authorisation is enforced at
    the API layer by `get_current_admin_id` so this use case is a thin
    wrapper that just turns the "missing" case into a typed exception.
    """

    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(self, order_id: str) -> Order:
        order = await self.repo.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(f"Order {order_id} not found")
        return order


# Status → bound method on Order. Each value is the **name** of the
# instance method to call; `UpdateOrderStatusAdmin` resolves it via
# `getattr` so adding a new status only requires one line here plus the
# method on the entity. Statuses NOT in this map cannot be set directly
# (e.g. PLACED is the initial state — there's no "un-confirm" verb).
_STATUS_TRANSITIONS: dict[OrderStatus, str] = {
    OrderStatus.CONFIRMED: "confirm",
    OrderStatus.IN_PROGRESS: "start_work",
    OrderStatus.DELIVERED: "mark_delivered",
    OrderStatus.INSTALLED: "mark_installed",
    # CANCELLED / REFUNDED are special-cased below — they take a `reason`.
}


class UpdateOrderStatusAdmin:
    """Phase 4B — transition an order's status from the admin panel.

    Dispatches to the right `Order` method based on the requested target
    status. `cancel`/`refund` get the explicit-reason branch; everything
    else uses the lookup table above.

    The aggregate raises `InvalidOrderTransitionError` for forbidden
    transitions (e.g. PLACED → DELIVERED); the API layer maps that to a
    409 with `code: "invalid_transition"` so the UI can show a toast.
    """

    def __init__(
        self,
        repo: OrderRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self,
        actor_id: str,
        order_id: str,
        new_status: OrderStatus,
        reason: str | None = None,
    ) -> Order:
        order = await self.repo.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(f"Order {order_id} not found")

        previous_status = order.status

        if new_status is OrderStatus.CANCELLED:
            order.cancel(reason or "")
        elif new_status is OrderStatus.REFUNDED:
            order.refund(reason or "")
        elif new_status is OrderStatus.PLACED:
            # PLACED is the initial state; transitioning *back* to it would
            # mean "un-do the order" which is not a valid business action.
            raise InvalidOrderTransitionError(
                "Cannot transition back to PLACED"
            )
        else:
            method_name = _STATUS_TRANSITIONS[new_status]
            getattr(order, method_name)()

        updated = await self.repo.update(order)

        # Phase 9 — Refund gets its own action key so the audit page can
        # surface "money moved" events distinctly from regular workflow
        # transitions; everything else is logged as ORDER_STATUS_CHANGE.
        if self.audit_recorder is not None:
            action = (
                AuditAction.ORDER_REFUND
                if new_status is OrderStatus.REFUNDED
                else AuditAction.ORDER_STATUS_CHANGE
            )
            payload: dict = {
                "number": updated.number,
                "from": previous_status.value,
                "to": new_status.value,
            }
            if reason:
                payload["reason"] = reason
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=action,
                target_type=AuditTargetType.ORDER,
                target_id=order_id,
                payload=payload,
            )
        return updated


class AddOrderNoteAdmin:
    """Phase 4B — append an internal admin note to an order."""

    def __init__(
        self,
        repo: OrderRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self, actor_id: str, order_id: str, text: str,
    ) -> OrderNote:
        order = await self.repo.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(f"Order {order_id} not found")
        # Domain validates non-empty text + author. The note is appended
        # to the loaded aggregate AND persisted via the repo so subsequent
        # reads (within the same session or not) see it.
        note = order.add_note(author_id=actor_id, text=text)
        await self.repo.add_note(order_id, note)

        if self.audit_recorder is not None:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.ORDER_NOTE_ADD,
                target_type=AuditTargetType.ORDER,
                target_id=order_id,
                # Truncate the note text so the audit log row stays compact
                # and bulk reads (the admin audit page) don't have to ship
                # 2 KB blobs over the wire just for the actor history.
                payload={
                    "number": order.number,
                    "note_id": note.id,
                    "text_preview": text[:200],
                },
            )
        return note


class ListOrdersAdmin:
    """Phase 4A — admin paginated order list.

    Pure pass-through to the repository. Authorisation (admin role) is
    enforced at the API layer by `get_current_admin_id`, so this use case
    has no dependency on the user repository or actor identity. Keeping
    it minimal mirrors the pattern in `GetDashboardSnapshot`.
    """

    MAX_PAGE_SIZE = 200

    def __init__(self, repo: OrderRepository):
        self.repo = repo

    async def execute(
        self, filters: OrderFilters, page: int = 1, size: int = 50,
    ) -> tuple[list[Order], int]:
        if page < 1:
            raise ValueError(f"page must be >= 1, got {page}")
        if size < 1 or size > self.MAX_PAGE_SIZE:
            raise ValueError(
                f"size must be in 1..{self.MAX_PAGE_SIZE}, got {size}"
            )
        return await self.repo.find_paginated(filters, page=page, size=size)
