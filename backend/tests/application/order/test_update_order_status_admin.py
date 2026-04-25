"""Phase 4B — admin status-transition + notes use cases.

These exercise the dispatch table in `UpdateOrderStatusAdmin` (one branch
per target status) plus the wiring between use case and repository: the
update IS persisted, the not-found case raises a typed exception, and
notes go through both `Order.add_note` AND `repo.add_note`.
"""
from __future__ import annotations

import pytest

from app.application.order.use_cases import (
    AddOrderNoteAdmin,
    GetOrderAdmin,
    OrderNotFoundError,
    UpdateOrderStatusAdmin,
)
from app.domain.order.entities import Order
from app.domain.order.exceptions import InvalidOrderTransitionError
from app.domain.order.value_objects import OrderStatus
from app.infrastructure.persistence.repositories.memory import (
    InMemoryOrderRepository,
)


@pytest.fixture
def repo_with_order():
    """Repo seeded with one PLACED order, ready to be advanced through the chain."""
    repo = InMemoryOrderRepository()
    repo._orders.append(Order(id="o-1", status=OrderStatus.PLACED, user_id="u-1"))
    return repo


@pytest.mark.asyncio
async def test_get_order_admin_returns_order(repo_with_order):
    order = await GetOrderAdmin(repo_with_order).execute("o-1")
    assert order.id == "o-1"


@pytest.mark.asyncio
async def test_get_order_admin_missing_raises():
    repo = InMemoryOrderRepository()
    with pytest.raises(OrderNotFoundError):
        await GetOrderAdmin(repo).execute("ghost")


@pytest.mark.asyncio
async def test_update_status_confirms_placed_order(repo_with_order):
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    updated = await use_case.execute(
        actor_id="admin-1",
        order_id="o-1",
        new_status=OrderStatus.CONFIRMED,
    )
    assert updated.status is OrderStatus.CONFIRMED
    # And the repo has it persisted (next get returns the new status).
    again = await repo_with_order.get_by_id("o-1")
    assert again.status is OrderStatus.CONFIRMED


@pytest.mark.asyncio
async def test_update_status_full_happy_chain(repo_with_order):
    """PLACED → CONFIRMED → IN_PROGRESS → DELIVERED → INSTALLED."""
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    for target in (
        OrderStatus.CONFIRMED,
        OrderStatus.IN_PROGRESS,
        OrderStatus.DELIVERED,
        OrderStatus.INSTALLED,
    ):
        order = await use_case.execute(
            actor_id="admin-1", order_id="o-1", new_status=target,
        )
        assert order.status is target


@pytest.mark.asyncio
async def test_update_status_cancel_with_reason(repo_with_order):
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    order = await use_case.execute(
        actor_id="admin-1",
        order_id="o-1",
        new_status=OrderStatus.CANCELLED,
        reason="Клиент отказался",
    )
    assert order.status is OrderStatus.CANCELLED
    assert order.cancel_reason == "Клиент отказался"


@pytest.mark.asyncio
async def test_update_status_cancel_without_reason_raises(repo_with_order):
    """Reason validation lives in the domain — propagates as ValueError."""
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    with pytest.raises(ValueError):
        await use_case.execute(
            actor_id="admin-1",
            order_id="o-1",
            new_status=OrderStatus.CANCELLED,
            reason=None,
        )


@pytest.mark.asyncio
async def test_update_status_invalid_transition_raises(repo_with_order):
    """PLACED → DELIVERED skips the chain — must surface as 409 candidate."""
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    with pytest.raises(InvalidOrderTransitionError):
        await use_case.execute(
            actor_id="admin-1",
            order_id="o-1",
            new_status=OrderStatus.DELIVERED,
        )


@pytest.mark.asyncio
async def test_update_status_not_found_raises():
    repo = InMemoryOrderRepository()
    with pytest.raises(OrderNotFoundError):
        await UpdateOrderStatusAdmin(repo).execute(
            actor_id="a", order_id="ghost", new_status=OrderStatus.CONFIRMED,
        )


@pytest.mark.asyncio
async def test_update_status_back_to_placed_rejected(repo_with_order):
    """No 'unconfirm' verb — PLACED is an initial state only."""
    use_case = UpdateOrderStatusAdmin(repo_with_order)
    with pytest.raises(InvalidOrderTransitionError):
        await use_case.execute(
            actor_id="admin-1",
            order_id="o-1",
            new_status=OrderStatus.PLACED,
        )


@pytest.mark.asyncio
async def test_add_note_persists(repo_with_order):
    use_case = AddOrderNoteAdmin(repo_with_order)
    note = await use_case.execute(
        actor_id="admin-1", order_id="o-1", text="First note",
    )
    assert note.text == "First note"
    assert note.author_id == "admin-1"
    # Visible after re-fetch — covers both `Order.add_note` (in-memory
    # mutation) and the repo persist call.
    order = await repo_with_order.get_by_id("o-1")
    assert len(order.notes) == 1
    assert order.notes[0].id == note.id


@pytest.mark.asyncio
async def test_add_note_to_missing_order_raises():
    repo = InMemoryOrderRepository()
    use_case = AddOrderNoteAdmin(repo)
    with pytest.raises(OrderNotFoundError):
        await use_case.execute(actor_id="a", order_id="ghost", text="hi")


@pytest.mark.asyncio
async def test_add_note_blank_text_raises(repo_with_order):
    use_case = AddOrderNoteAdmin(repo_with_order)
    with pytest.raises(ValueError):
        await use_case.execute(actor_id="admin-1", order_id="o-1", text="   ")
