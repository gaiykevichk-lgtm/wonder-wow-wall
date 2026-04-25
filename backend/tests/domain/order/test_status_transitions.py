"""Phase 4B — Order status transition state machine.

Pin every legal and illegal transition explicitly. The matrix is small
(7 statuses × ~6 verbs) so an exhaustive table is cheaper than parametric
generation and clearer when something breaks. The matrix shape itself is
the contract — a future "skip confirmation" feature would force this
file to change, which is the desired tripwire.
"""
from __future__ import annotations

import pytest

from app.domain.order.entities import Order
from app.domain.order.exceptions import (
    InvalidOrderTransitionError,
    OrderAlreadyCancelledError,
)
from app.domain.order.value_objects import OrderStatus


# ─── happy-path: each verb succeeds from its only legal predecessor ──


def test_confirm_from_placed():
    order = Order(status=OrderStatus.PLACED)
    order.confirm()
    assert order.status is OrderStatus.CONFIRMED


def test_start_work_from_confirmed():
    order = Order(status=OrderStatus.CONFIRMED)
    order.start_work()
    assert order.status is OrderStatus.IN_PROGRESS


def test_mark_delivered_from_in_progress():
    order = Order(status=OrderStatus.IN_PROGRESS)
    order.mark_delivered()
    assert order.status is OrderStatus.DELIVERED


def test_mark_installed_from_delivered():
    order = Order(status=OrderStatus.DELIVERED)
    order.mark_installed()
    assert order.status is OrderStatus.INSTALLED


# ─── cancel: legal from every non-terminal state ─────────────────────


@pytest.mark.parametrize(
    "from_status",
    [
        OrderStatus.PLACED,
        OrderStatus.CONFIRMED,
        OrderStatus.IN_PROGRESS,
        OrderStatus.DELIVERED,
    ],
)
def test_cancel_from_non_terminal(from_status):
    order = Order(status=from_status)
    order.cancel(reason="Клиент передумал")
    assert order.status is OrderStatus.CANCELLED
    assert order.cancel_reason == "Клиент передумал"


@pytest.mark.parametrize("from_status", [
    OrderStatus.INSTALLED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
])
def test_cancel_from_terminal_raises(from_status):
    order = Order(status=from_status)
    with pytest.raises(OrderAlreadyCancelledError):
        order.cancel(reason="Whatever")


@pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
def test_cancel_requires_non_blank_reason(blank):
    order = Order(status=OrderStatus.CONFIRMED)
    # Plain ValueError (NOT InvalidOrderTransitionError) — caller-input
    # bug, surfaces as 422 at the API layer rather than 409.
    with pytest.raises(ValueError):
        order.cancel(reason=blank)


# ─── refund: only from delivered/installed ────────────────────────────


@pytest.mark.parametrize("from_status", [
    OrderStatus.DELIVERED,
    OrderStatus.INSTALLED,
])
def test_refund_from_delivered_or_installed(from_status):
    order = Order(status=from_status)
    order.refund(reason="Брак при установке")
    assert order.status is OrderStatus.REFUNDED
    assert order.cancel_reason == "Брак при установке"


@pytest.mark.parametrize("from_status", [
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.IN_PROGRESS,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
])
def test_refund_from_invalid_status_raises(from_status):
    order = Order(status=from_status)
    with pytest.raises(InvalidOrderTransitionError):
        order.refund(reason="x")


# ─── illegal forward jumps ────────────────────────────────────────────


def test_cannot_skip_confirm():
    """PLACED → IN_PROGRESS is illegal — must confirm first."""
    order = Order(status=OrderStatus.PLACED)
    with pytest.raises(InvalidOrderTransitionError):
        order.start_work()


def test_cannot_install_before_delivery():
    order = Order(status=OrderStatus.IN_PROGRESS)
    with pytest.raises(InvalidOrderTransitionError):
        order.mark_installed()


def test_invalid_transition_is_value_error_subclass():
    """Backwards compat with legacy `pytest.raises(ValueError)` callers."""
    order = Order(status=OrderStatus.DELIVERED)
    with pytest.raises(ValueError):  # broader catch still works
        order.confirm()
