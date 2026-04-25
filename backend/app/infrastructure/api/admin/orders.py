"""Phase 4A — admin orders list endpoint.

`GET /api/admin/orders` returns a paginated list with optional filters.
Status, date window, user scope, and free-text search are all optional;
combining them ANDs them together.

Why two date params instead of `?days=` like the dashboard:
  the admin selects an arbitrary range via the table's RangePicker, so
  collapsing to a discrete window would lose information. Validation that
  `from < to` lives in the `OrderFilters` VO so HTTP layer stays thin.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.application.order.use_cases import ListOrdersAdmin
from app.container import get_order_repo
from app.domain.order.entities import Order
from app.domain.order.filters import InvalidOrderFilterError, OrderFilters
from app.domain.order.value_objects import OrderStatus
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


class OrderListItemResponse(BaseModel):
    id: str
    number: str
    user_id: str
    status: str
    status_label: str
    total: int
    address: str
    created_at: str
    items_count: int


class OrdersListResponse(BaseModel):
    items: list[OrderListItemResponse] = Field(default_factory=list)
    total: int
    page: int
    size: int


def _to_item(o: Order) -> OrderListItemResponse:
    return OrderListItemResponse(
        id=o.id,
        number=o.number,
        user_id=o.user_id,
        status=o.status.value,
        status_label=o.status.label_ru,
        total=o.total,
        address=o.address.full,
        created_at=o.created_at.isoformat(),
        items_count=len(o.items),
    )


@router.get("/orders", response_model=OrdersListResponse)
async def list_orders_admin(
    # Status is restricted to the canonical OrderStatus values so a typo
    # surfaces as 422 instead of an empty list.
    status: Literal[
        "placed", "confirmed", "in_progress", "delivered", "installed"
    ] | None = Query(None),
    user_id: str | None = Query(None),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _admin_id: str = Depends(get_current_admin_id),
    order_repo=Depends(get_order_repo),
):
    try:
        filters = OrderFilters(
            status=OrderStatus(status) if status else None,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            search=search,
        )
    except InvalidOrderFilterError as exc:
        # The VO already produces a friendly message; surface it as 422
        # (semantic validation, not a 500) — the only invariant is
        # date_from < date_to.
        raise HTTPException(status_code=422, detail=str(exc))

    items, total = await ListOrdersAdmin(order_repo).execute(filters, page=page, size=size)
    return OrdersListResponse(
        items=[_to_item(o) for o in items],
        total=total,
        page=page,
        size=size,
    )
