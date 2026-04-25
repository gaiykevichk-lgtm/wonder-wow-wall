from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.application.subscription.use_cases import (
    CancelSubscription,
    GetPlans,
    GetSubscriptionStatus,
    Subscribe,
    compute_remaining_area_m2,
)
from app.container import get_subscription_plan_repo, get_subscription_repo
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionPlanRepository
from app.utils.dependencies import get_current_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class PlanSchema(BaseModel):
    id: str
    name: str
    price: int
    period: str
    area_limit_m2: float
    popular: bool
    features: list[str]


class SubscribeRequest(BaseModel):
    plan_id: str


class SubscriptionSchema(BaseModel):
    id: str
    plan_id: str
    status: str
    area_used_this_month_m2: float
    remaining_area_m2: float
    started_at: str
    expires_at: str


# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanSchema])
async def list_plans(
    request: Request,
    plan_repo: SubscriptionPlanRepository = Depends(get_subscription_plan_repo),
):
    """Phase 8C — read plans from the admin-editable repository.

    Same data the public `/api/subscription-plans` endpoint exposes.
    Kept under the `/subscriptions/` prefix for back-compat with the
    pre-Phase-8C frontend client.
    """
    uc = GetPlans(plan_repo)
    plans = await uc.execute()
    return [
        {"id": p.id, "name": p.name, "price": p.price, "period": p.period,
         "area_limit_m2": p.area_limit_m2, "popular": p.popular, "features": p.features}
        for p in plans
    ]


@router.post("", response_model=SubscriptionSchema, status_code=201)
async def subscribe(
    request: Request,
    body: SubscribeRequest,
    user_id: str = Depends(get_current_user_id),
    subscription_repo=Depends(get_subscription_repo),
    plan_repo: SubscriptionPlanRepository = Depends(get_subscription_plan_repo),
):
    uc = Subscribe(subscription_repo, plan_repo)
    try:
        sub = await uc.execute(user_id, body.plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _sub_response(sub, plan_repo)


@router.get("/status", response_model=SubscriptionSchema | None)
async def get_status(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    subscription_repo=Depends(get_subscription_repo),
    plan_repo: SubscriptionPlanRepository = Depends(get_subscription_plan_repo),
):
    uc = GetSubscriptionStatus(subscription_repo)
    sub = await uc.execute(user_id)
    if not sub:
        return None
    return await _sub_response(sub, plan_repo)


@router.delete("")
async def cancel(request: Request, user_id: str = Depends(get_current_user_id), subscription_repo=Depends(get_subscription_repo)):
    uc = CancelSubscription(subscription_repo)
    try:
        await uc.execute(user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "cancelled"}


async def _sub_response(
    sub: Subscription, plan_repo: SubscriptionPlanRepository,
) -> dict:
    # Phase 8C — `remaining_area_m2` is now computed against a freshly
    # fetched plan (admin can change `area_limit_m2` at runtime). The
    # legacy `Subscription.remaining_area_m2` property continues to work
    # against the hardcoded const for backwards-compat with domain tests.
    plan = await plan_repo.get_by_id(sub.plan_id)
    remaining = compute_remaining_area_m2(sub, plan)
    return {
        "id": sub.id,
        "plan_id": sub.plan_id,
        "status": sub.status.value if hasattr(sub.status, "value") else sub.status,
        "area_used_this_month_m2": sub.area_used_this_month_m2,
        "remaining_area_m2": remaining if remaining != float("inf") else -1,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }
