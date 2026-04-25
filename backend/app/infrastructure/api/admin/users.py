"""Phase 5 — admin users endpoints.

* `GET  /api/admin/users`                       — paginated list with filters
* `GET  /api/admin/users/{id}`                  — full profile + recent orders
* `POST /api/admin/users/{id}/block`            — disable login
* `POST /api/admin/users/{id}/unblock`          — re-enable login
* `POST /api/admin/users/{id}/grant-admin`      — promote (Phase 1 use case)
* `POST /api/admin/users/{id}/revoke-admin`     — demote (Phase 1 use case)

Domain → HTTP mapping (registered in `app/main.py`):
  `LastAdminRemovalError` → 409 + `{detail, code: "last_admin"}` — covers both
                            revoke-last-admin AND block-last-admin (operationally
                            equivalent, see `BlockUserAdmin`).
  `NotAuthorizedError`    → 403 + `{detail, code: "not_authorized"}`.
  `UserNotFoundError`     → 404 + `{detail, code: "user_not_found"}` — locally
                            raised here (no global handler) so the message stays
                            specific to "user vs order". Code mirrors the
                            admin-panel `{detail, code}` convention so frontend
                            can branch uniformly across all error types.

Why `recent_orders` is bundled into the detail response (not a second GET):
  the user-detail page renders profile + recent-orders as a single panel; the
  admin always needs both. One round-trip beats N+1 cache invalidations on
  block/unblock (the orders list is also filtered by `user_id` in the same
  request). Caller-page pagination on orders happens via the existing
  `/api/admin/orders?user_id=...` endpoint — this `recent_orders` field is a
  3-row preview, not the source of truth.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.order.use_cases import ListOrdersAdmin
from app.application.user.use_cases import (
    BlockUserAdmin,
    GetUserAdmin,
    GrantAdminRole,
    ListUsersAdmin,
    RevokeAdminRole,
    UnblockUserAdmin,
    UserNotFoundError,
)
from app.container import get_audit_repo, get_order_repo, get_user_repo
from app.domain.order.entities import Order
from app.domain.order.filters import OrderFilters
from app.domain.user.entities import User
from app.domain.user.filters import UserFilters
from app.domain.user.value_objects import UserRole
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Response shapes ─────────────────────────────────────────────────


class UserListItemResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: str
    role: str
    is_blocked: bool
    created_at: str


class UsersListResponse(BaseModel):
    items: list[UserListItemResponse] = Field(default_factory=list)
    total: int
    page: int
    size: int


class RecentOrderResponse(BaseModel):
    """Compact view used by the user detail page's "Last orders" preview.

    Mirrors a subset of `OrderListItemResponse` from admin/orders.py — kept
    separate so a future change to that response (e.g. adding `items_count`)
    doesn't accidentally bloat the user-detail payload.
    """
    id: str
    number: str
    status: str
    status_label: str
    total: int
    created_at: str


class UserDetailResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: str
    role: str
    is_blocked: bool
    created_at: str
    addresses: list[dict] = Field(default_factory=list)
    recent_orders: list[RecentOrderResponse] = Field(default_factory=list)


def _to_list_item(u: User) -> UserListItemResponse:
    return UserListItemResponse(
        id=u.id,
        email=u.email,
        name=u.name,
        phone=u.phone,
        role=u.role.value,
        is_blocked=u.is_blocked,
        created_at=u.created_at.isoformat(),
    )


def _to_recent_order(o: Order) -> RecentOrderResponse:
    return RecentOrderResponse(
        id=o.id,
        number=o.number,
        status=o.status.value,
        status_label=o.status.label_ru,
        total=o.total,
        created_at=o.created_at.isoformat(),
    )


def _to_detail(u: User, recent: list[Order]) -> UserDetailResponse:
    return UserDetailResponse(
        id=u.id,
        email=u.email,
        name=u.name,
        phone=u.phone,
        role=u.role.value,
        is_blocked=u.is_blocked,
        created_at=u.created_at.isoformat(),
        addresses=[
            {
                "id": a.id, "label": a.label, "city": a.city,
                "street": a.street, "building": a.building,
                "apartment": a.apartment, "postal_code": a.postal_code,
                "is_default": a.is_default,
            }
            for a in u.addresses
        ],
        recent_orders=[_to_recent_order(o) for o in recent],
    )


# ─── List ────────────────────────────────────────────────────────────


@router.get("/users", response_model=UsersListResponse)
async def list_users_admin(
    # Restrict role values at the HTTP layer (typo → 422 instead of empty
    # list). Match `UserRole` enum: CUSTOMER / ADMIN.
    role: Literal["CUSTOMER", "ADMIN"] | None = Query(None),
    is_blocked: bool | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
):
    filters = UserFilters(
        role=UserRole(role) if role else None,
        is_blocked=is_blocked,
        search=search,
    )
    items, total = await ListUsersAdmin(user_repo).execute(
        filters, page=page, size=size,
    )
    return UsersListResponse(
        items=[_to_list_item(u) for u in items],
        total=total,
        page=page,
        size=size,
    )


# ─── Detail ──────────────────────────────────────────────────────────


def _user_not_found(message: str) -> HTTPException:
    """Single source of truth for the 404 shape.

    Returns the AntD-error-handler-friendly `{detail, code}` envelope used
    across the admin panel. The frontend keys on `code` (not the localised
    `detail` string) when it needs to branch — kept here so a future change
    to the code value happens in one place.
    """
    return HTTPException(
        status_code=404,
        detail={"detail": message, "code": "user_not_found"},
    )


async def _load_detail(
    user_id: str,
    user_repo,
    order_repo,
) -> UserDetailResponse:
    """Fetch user + recent orders and shape the detail response.

    Extracted so the mutation endpoints (block/unblock/grant/revoke) don't
    have to call `get_user_admin()` as a regular function — that pattern
    re-runs the `Depends(get_current_admin_id)` chain conceptually and
    couples the mutations to FastAPI's route function. This helper is
    pure (no `Depends`) and can be unit-tested in isolation.

    `recent` is a 5-row preview; full pagination lives at
    `/api/admin/orders?user_id=...`. We use `ListOrdersAdmin` (not
    `list_by_user`) so the same ordering convention as the orders table
    applies.
    """
    try:
        user = await GetUserAdmin(user_repo).execute(user_id)
    except UserNotFoundError as exc:
        raise _user_not_found(str(exc))
    recent, _total = await ListOrdersAdmin(order_repo).execute(
        OrderFilters(user_id=user_id), page=1, size=5,
    )
    return _to_detail(user, recent)


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_admin(
    user_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
    order_repo=Depends(get_order_repo),
):
    return await _load_detail(user_id, user_repo, order_repo)


# ─── Block / Unblock ─────────────────────────────────────────────────


@router.post("/users/{user_id}/block", response_model=UserDetailResponse)
async def block_user(
    user_id: str,
    admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
    order_repo=Depends(get_order_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    try:
        await BlockUserAdmin(
            user_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(actor_id=admin_id, target_user_id=user_id)
    except UserNotFoundError as exc:
        raise _user_not_found(str(exc))
    # Re-fetch with recent orders so the frontend can `setQueryData(detail)`
    # on success without an extra GET — same pattern as PATCH /status in
    # Phase 4B's order detail.
    return await _load_detail(user_id, user_repo, order_repo)


@router.post("/users/{user_id}/unblock", response_model=UserDetailResponse)
async def unblock_user(
    user_id: str,
    admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
    order_repo=Depends(get_order_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    try:
        await UnblockUserAdmin(
            user_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(actor_id=admin_id, target_user_id=user_id)
    except UserNotFoundError as exc:
        raise _user_not_found(str(exc))
    return await _load_detail(user_id, user_repo, order_repo)


# ─── Grant / Revoke admin role ───────────────────────────────────────


@router.post("/users/{user_id}/grant-admin", response_model=UserDetailResponse)
async def grant_admin(
    user_id: str,
    admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
    order_repo=Depends(get_order_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    try:
        await GrantAdminRole(
            user_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(actor_id=admin_id, target_user_id=user_id)
    except ValueError as exc:
        # GrantAdminRole raises ValueError for missing user. Mirror the
        # 404 mapping used by Get/Block/Unblock so the frontend can branch
        # on status code + `code: user_not_found` uniformly.
        raise _user_not_found(str(exc))
    return await _load_detail(user_id, user_repo, order_repo)


@router.post("/users/{user_id}/revoke-admin", response_model=UserDetailResponse)
async def revoke_admin(
    user_id: str,
    admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
    order_repo=Depends(get_order_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    try:
        await RevokeAdminRole(
            user_repo,
            audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
        ).execute(actor_id=admin_id, target_user_id=user_id)
    except ValueError as exc:
        # Same 404-on-missing-target convention as grant_admin above.
        raise _user_not_found(str(exc))
    return await _load_detail(user_id, user_repo, order_repo)
