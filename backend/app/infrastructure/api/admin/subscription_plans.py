"""Phase 8C — admin Subscription Plan CRUD endpoints.

* `GET    /api/admin/subscription-plans`        — list (incl. inactive)
* `GET    /api/admin/subscription-plans/{id}`   — single
* `POST   /api/admin/subscription-plans`        — create (201)
* `PATCH  /api/admin/subscription-plans/{id}`   — partial update
* `DELETE /api/admin/subscription-plans/{id}`   — refused if in use (409)

Domain → HTTP mapping (registered in `app/main.py`):
  `SubscriptionPlanNotFoundError`     → 404 + `subscription_plan_not_found`
  `SubscriptionPlanIdConflictError`   → 409 + `subscription_plan_id_conflict`
  `SubscriptionPlanInUseError`        → 409 + `subscription_plan_in_use`
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.subscription.plan_use_cases import (
    CreateSubscriptionPlanAdmin,
    DeleteSubscriptionPlanAdmin,
    GetSubscriptionPlanAdmin,
    ListSubscriptionPlansAdmin,
    UpdateSubscriptionPlanAdmin,
)
from app.container import (
    get_audit_repo,
    get_subscription_plan_repo,
    get_subscription_repo,
)
from app.domain.subscription.entities import SubscriptionPlan
from app.domain.subscription.plan_exceptions import (
    SubscriptionPlanNotFoundError,
)
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────


class SubscriptionPlanResponse(BaseModel):
    id: str
    name: str
    price: int
    period: str
    area_limit_m2: float
    popular: bool
    is_active: bool
    sort_order: int
    features: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class SubscriptionPlanListResponse(BaseModel):
    items: list[SubscriptionPlanResponse] = Field(default_factory=list)


class SubscriptionPlanCreate(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    price: int = Field(ge=0)
    period: str = Field(default="мес", max_length=32)
    area_limit_m2: float = Field(default=0, ge=0)
    popular: bool = False
    is_active: bool = True
    sort_order: int = Field(default=0)
    features: list[str] = Field(default_factory=list)


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    price: int | None = Field(default=None, ge=0)
    period: str | None = Field(default=None, max_length=32)
    area_limit_m2: float | None = Field(default=None, ge=0)
    popular: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    features: list[str] | None = None


def _to_response(p: SubscriptionPlan) -> SubscriptionPlanResponse:
    return SubscriptionPlanResponse(
        id=p.id, name=p.name, price=p.price, period=p.period,
        area_limit_m2=p.area_limit_m2, popular=p.popular,
        is_active=p.is_active, sort_order=p.sort_order,
        features=list(p.features),
        created_at=p.created_at.isoformat(),
        updated_at=p.updated_at.isoformat(),
    )


# ─── Endpoints ───────────────────────────────────────────────────────


@router.get("/subscription-plans", response_model=SubscriptionPlanListResponse)
async def list_plans_admin(
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_subscription_plan_repo),
):
    items = await ListSubscriptionPlansAdmin(repo).execute()
    return SubscriptionPlanListResponse(items=[_to_response(p) for p in items])


@router.get(
    "/subscription-plans/{plan_id}", response_model=SubscriptionPlanResponse,
)
async def get_plan_admin(
    plan_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_subscription_plan_repo),
):
    plan = await GetSubscriptionPlanAdmin(repo).execute(plan_id)
    return _to_response(plan)


@router.post(
    "/subscription-plans",
    response_model=SubscriptionPlanResponse,
    status_code=201,
)
async def create_plan_admin(
    body: SubscriptionPlanCreate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_subscription_plan_repo),
):
    plan = await CreateSubscriptionPlanAdmin(repo).execute(
        plan_id=body.id, name=body.name, price=body.price, period=body.period,
        area_limit_m2=body.area_limit_m2, popular=body.popular,
        is_active=body.is_active, sort_order=body.sort_order,
        features=body.features,
    )
    return _to_response(plan)


@router.patch(
    "/subscription-plans/{plan_id}", response_model=SubscriptionPlanResponse,
)
async def update_plan_admin(
    plan_id: str,
    body: SubscriptionPlanUpdate,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_subscription_plan_repo),
):
    plan = await UpdateSubscriptionPlanAdmin(repo).execute(
        plan_id=plan_id, name=body.name, price=body.price, period=body.period,
        area_limit_m2=body.area_limit_m2, popular=body.popular,
        is_active=body.is_active, sort_order=body.sort_order,
        features=body.features,
    )
    return _to_response(plan)


@router.delete("/subscription-plans/{plan_id}", status_code=204)
async def delete_plan_admin(
    plan_id: str,
    admin_id: str = Depends(get_current_admin_id),
    plan_repo=Depends(get_subscription_plan_repo),
    sub_repo=Depends(get_subscription_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    # Use case raises `SubscriptionPlanInUseError` if active
    # subscriptions still reference the plan.
    deleted = await DeleteSubscriptionPlanAdmin(
        plan_repo, sub_repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(plan_id, actor_id=admin_id)
    if not deleted:
        raise SubscriptionPlanNotFoundError(f"Plan {plan_id} not found")
    return Response(status_code=204)
