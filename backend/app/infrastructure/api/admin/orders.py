"""Phase 4A/4B — admin orders endpoints.

* `GET  /api/admin/orders`                 — paginated list with filters (4A)
* `GET  /api/admin/orders/{id}`            — full detail (4B)
* `PATCH /api/admin/orders/{id}/status`    — transition + optional reason (4B)
* `POST /api/admin/orders/{id}/notes`      — append internal admin note (4B)

Why two date params instead of `?days=` like the dashboard:
  the admin selects an arbitrary range via the table's RangePicker, so
  collapsing to a discrete window would lose information. Validation that
  `from < to` lives in the `OrderFilters` VO so HTTP layer stays thin.

Domain → HTTP mapping:
  `InvalidOrderTransitionError` → 409 + `{detail, code: "invalid_transition"}`,
  registered in `app/main.py`. Plain `ValueError` (missing reason) bubbles
  to FastAPI's default 422 — same as Pydantic body-validation errors.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.order.use_cases import (
    AddOrderNoteAdmin,
    GetOrderAdmin,
    ListOrdersAdmin,
    OrderNotFoundError,
    UpdateOrderStatusAdmin,
)
from app.container import get_audit_repo, get_order_repo, get_user_repo
from app.domain.order.entities import Order, OrderNote
from app.domain.order.exceptions import InvalidOrderTransitionError
from app.domain.order.filters import InvalidOrderFilterError, OrderFilters
from app.domain.order.value_objects import OrderStatus
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


class OrderListItemResponse(BaseModel):
    id: str
    number: str
    user_id: str
    # Phase 4A follow-up — resolved customer fields so the admin table
    # shows name / email / phone instead of just the opaque UUID. Phone
    # is the primary contact channel for moving an order forward (see
    # «Заказы» tab UX), so it lives next to email at the top level.
    user_email: str
    user_name: str
    user_phone: str
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


def _to_item(
    o: Order, users: dict[str, tuple[str, str, str]],
) -> OrderListItemResponse:
    customer_email, customer_name, customer_phone = users.get(
        o.user_id, ("", "", ""),
    )
    return OrderListItemResponse(
        id=o.id,
        number=o.number,
        user_id=o.user_id,
        user_email=customer_email,
        user_name=customer_name,
        user_phone=customer_phone,
        status=o.status.value,
        status_label=o.status.label_ru,
        total=o.total,
        address=o.address.full,
        created_at=o.created_at.isoformat(),
        items_count=len(o.items),
    )


# ─── Phase 4B — detail / status transition / notes ───────────────────


class OrderItemResponse(BaseModel):
    id: str
    design_id: str
    design_name: str
    design_image: str
    size_key: str
    color: str
    quantity: int
    unit_price: int
    subtotal: int


class OrderNoteResponse(BaseModel):
    id: str
    author_id: str
    author_name: str  # Resolved via UserRepository — empty if user vanished.
    text: str
    created_at: str


class OrderDetailResponse(BaseModel):
    id: str
    number: str
    user_id: str
    user_email: str  # Resolved via UserRepository for the sidebar.
    user_name: str
    # Phone is the primary contact channel for moving an order (call,
    # SMS, WhatsApp). Surfaced here so support doesn't have to bounce
    # to the «Пользователи» tab to find it.
    user_phone: str
    status: str
    status_label: str
    total: int
    address: str
    address_full: dict  # Structured for the detail page (city/street/etc).
    installation_date: str | None
    cancel_reason: str | None
    items: list[OrderItemResponse] = Field(default_factory=list)
    notes: list[OrderNoteResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str


# Admin-settable target statuses. PLACED is excluded — it's the initial
# state, "uncreating" an order is not a valid action. Pydantic's Literal
# reflects that constraint at the HTTP layer (422 for invalid input).
StatusUpdateLiteral = Literal[
    "confirmed", "in_progress", "delivered", "installed",
    "cancelled", "refunded",
]


class StatusUpdateRequest(BaseModel):
    status: StatusUpdateLiteral
    # Required for cancelled/refunded; ignored for the other transitions.
    # Validation happens in the domain (`Order.cancel`/`Order.refund`),
    # so the API layer does not branch on `status` here.
    reason: str | None = None


class NoteCreateRequest(BaseModel):
    # Min length 1 here surfaces "пустая заметка" as a 422 instead of a
    # generic ValueError 500 — same UX as other Pydantic-rejected inputs.
    text: str = Field(min_length=1, max_length=2000)


async def _resolve_users(
    user_repo, ids: set[str],
) -> dict[str, tuple[str, str, str]]:
    """Return `{user_id: (email, name, phone)}` for a set of ids.

    Missing user → `("", "", "")` so the row still renders gracefully
    (e.g., a user-deleted account leaves a historical order intact —
    we don't want a 500 from a NULL ref).
    """
    out: dict[str, tuple[str, str, str]] = {}
    for uid in ids:
        user = await user_repo.get_by_id(uid)
        out[uid] = (
            (user.email, user.name, user.phone) if user else ("", "", "")
        )
    return out


def _to_item_detail(it) -> OrderItemResponse:
    return OrderItemResponse(
        id=it.id,
        design_id=it.design_id,
        design_name=it.design_name,
        design_image=it.design_image,
        size_key=it.size_key,
        color=it.color,
        quantity=it.quantity,
        unit_price=it.unit_price,
        subtotal=it.subtotal,
    )


def _to_note_response(n: OrderNote, author_name: str) -> OrderNoteResponse:
    return OrderNoteResponse(
        id=n.id,
        author_id=n.author_id,
        author_name=author_name,
        text=n.text,
        created_at=n.created_at.isoformat(),
    )


def _to_detail(
    o: Order, users: dict[str, tuple[str, str, str]],
) -> OrderDetailResponse:
    customer_email, customer_name, customer_phone = users.get(
        o.user_id, ("", "", ""),
    )
    return OrderDetailResponse(
        id=o.id,
        number=o.number,
        user_id=o.user_id,
        user_email=customer_email,
        user_name=customer_name,
        user_phone=customer_phone,
        status=o.status.value,
        status_label=o.status.label_ru,
        total=o.total,
        address=o.address.full,
        address_full={
            "city": o.address.city,
            "street": o.address.street,
            "building": o.address.building,
            "apartment": o.address.apartment,
            "postal_code": o.address.postal_code,
        },
        installation_date=o.installation_date.isoformat() if o.installation_date else None,
        cancel_reason=o.cancel_reason,
        items=[_to_item_detail(it) for it in o.items],
        notes=[
            # users.get(...) returns (email, name, phone) — index [1] is name.
            _to_note_response(n, users.get(n.author_id, ("", "", ""))[1])
            for n in o.notes
        ],
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
async def get_order_admin(
    order_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    order_repo=Depends(get_order_repo),
    user_repo=Depends(get_user_repo),
):
    try:
        order = await GetOrderAdmin(order_repo).execute(order_id)
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    # Resolve author names + customer name in one pass — avoids N+1
    # queries on the detail page even for orders with many notes.
    user_ids = {order.user_id} | {n.author_id for n in order.notes}
    users = await _resolve_users(user_repo, user_ids)
    return _to_detail(order, users)


@router.patch("/orders/{order_id}/status", response_model=OrderDetailResponse)
async def update_order_status_admin(
    order_id: str,
    body: StatusUpdateRequest,
    admin_id: str = Depends(get_current_admin_id),
    order_repo=Depends(get_order_repo),
    user_repo=Depends(get_user_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    target = OrderStatus(body.status)
    try:
        order = await UpdateOrderStatusAdmin(
            order_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(
            actor_id=admin_id,
            order_id=order_id,
            new_status=target,
            reason=body.reason,
        )
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        # Plain ValueError = caller-input bug (e.g. missing reason on
        # cancel). Surface as 422 here rather than letting it bubble to
        # a 500 — same UX as Pydantic body-validation failures.
        # `InvalidOrderTransitionError` is a `ValueError` subclass but is
        # caught by the global handler first (it's registered earlier),
        # so it does NOT reach this branch.
        if isinstance(exc, InvalidOrderTransitionError):
            raise  # let global 409 handler take it
        raise HTTPException(status_code=422, detail=str(exc))
    user_ids = {order.user_id} | {n.author_id for n in order.notes}
    users = await _resolve_users(user_repo, user_ids)
    return _to_detail(order, users)


@router.post("/orders/{order_id}/notes", response_model=OrderNoteResponse, status_code=201)
async def add_order_note_admin(
    order_id: str,
    body: NoteCreateRequest,
    admin_id: str = Depends(get_current_admin_id),
    order_repo=Depends(get_order_repo),
    user_repo=Depends(get_user_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    try:
        note = await AddOrderNoteAdmin(
            order_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(
            actor_id=admin_id,
            order_id=order_id,
            text=body.text,
        )
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    author = await user_repo.get_by_id(admin_id)
    return _to_note_response(note, author.name if author else "")


@router.get("/orders", response_model=OrdersListResponse)
async def list_orders_admin(
    # Status is restricted to the canonical OrderStatus values so a typo
    # surfaces as 422 instead of an empty list. Phase 4B added the two
    # terminal "unhappy" states (cancelled/refunded) so admins can list
    # them from the same filter — the frontend's STATUS_OPTIONS already
    # exposes them.
    status: Literal[
        "placed", "confirmed", "in_progress", "delivered", "installed",
        "cancelled", "refunded",
    ] | None = Query(None),
    user_id: str | None = Query(None),
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _admin_id: str = Depends(get_current_admin_id),
    order_repo=Depends(get_order_repo),
    user_repo=Depends(get_user_repo),
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
    # Phase 4A follow-up — resolve customer email/name/phone for the
    # rendered page in one batched lookup so the admin table can render
    # «Анна Сергеева · +7 999 111 11 11» instead of a UUID. One repo
    # round-trip per unique user_id on the current page (typical: 5-20).
    user_ids = {o.user_id for o in items}
    users = await _resolve_users(user_repo, user_ids)
    return OrdersListResponse(
        items=[_to_item(o, users) for o in items],
        total=total,
        page=page,
        size=size,
    )
