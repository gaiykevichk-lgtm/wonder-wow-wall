from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.application.subscription.use_cases import GetPlans, Subscribe, GetSubscriptionStatus, CancelSubscription
from app.container import get_subscription_repo
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
async def list_plans(request: Request):
    uc = GetPlans()
    plans = await uc.execute()
    return [
        {"id": p.id, "name": p.name, "price": p.price, "period": p.period,
         "area_limit_m2": p.area_limit_m2, "popular": p.popular, "features": p.features}
        for p in plans
    ]


@router.post("", response_model=SubscriptionSchema, status_code=201)
async def subscribe(request: Request, body: SubscribeRequest, user_id: str = Depends(get_current_user_id), subscription_repo=Depends(get_subscription_repo)):
    uc = Subscribe(subscription_repo)
    try:
        sub = await uc.execute(user_id, body.plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _sub_response(sub)


@router.get("/status", response_model=SubscriptionSchema | None)
async def get_status(request: Request, user_id: str = Depends(get_current_user_id), subscription_repo=Depends(get_subscription_repo)):
    uc = GetSubscriptionStatus(subscription_repo)
    sub = await uc.execute(user_id)
    if not sub:
        return None
    return _sub_response(sub)


@router.delete("")
async def cancel(request: Request, user_id: str = Depends(get_current_user_id), subscription_repo=Depends(get_subscription_repo)):
    uc = CancelSubscription(subscription_repo)
    try:
        await uc.execute(user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "cancelled"}


def _sub_response(sub) -> dict:
    remaining = sub.remaining_area_m2
    return {
        "id": sub.id,
        "plan_id": sub.plan_id,
        "status": sub.status.value if hasattr(sub.status, "value") else sub.status,
        "area_used_this_month_m2": sub.area_used_this_month_m2,
        "remaining_area_m2": remaining if remaining != float("inf") else -1,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }
