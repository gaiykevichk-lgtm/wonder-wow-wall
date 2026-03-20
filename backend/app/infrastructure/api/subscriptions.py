from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.application.subscription.use_cases import GetPlans, Subscribe, GetSubscriptionStatus, CancelSubscription
from app.container import subscription_repo
from app.utils.dependencies import get_current_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class PlanSchema(BaseModel):
    id: str
    name: str
    price: int
    period: str
    overlays_per_month: int
    popular: bool
    features: list[str]


class SubscribeRequest(BaseModel):
    plan_id: str


class SubscriptionSchema(BaseModel):
    id: str
    plan_id: str
    status: str
    overlays_used_this_month: int
    remaining_overlays: float
    started_at: str
    expires_at: str


# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanSchema])
async def list_plans():
    uc = GetPlans()
    plans = await uc.execute()
    return [
        {"id": p.id, "name": p.name, "price": p.price, "period": p.period,
         "overlays_per_month": p.overlays_per_month, "popular": p.popular, "features": p.features}
        for p in plans
    ]


@router.post("", response_model=SubscriptionSchema, status_code=201)
async def subscribe(body: SubscribeRequest, user_id: str = Depends(get_current_user_id)):
    uc = Subscribe(subscription_repo)
    try:
        sub = await uc.execute(user_id, body.plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _sub_response(sub)


@router.get("/status", response_model=SubscriptionSchema | None)
async def get_status(user_id: str = Depends(get_current_user_id)):
    uc = GetSubscriptionStatus(subscription_repo)
    sub = await uc.execute(user_id)
    if not sub:
        return None
    return _sub_response(sub)


@router.delete("")
async def cancel(user_id: str = Depends(get_current_user_id)):
    uc = CancelSubscription(subscription_repo)
    try:
        await uc.execute(user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "cancelled"}


def _sub_response(sub) -> dict:
    remaining = sub.remaining_overlays
    return {
        "id": sub.id,
        "plan_id": sub.plan_id,
        "status": sub.status.value if hasattr(sub.status, "value") else sub.status,
        "overlays_used_this_month": sub.overlays_used_this_month,
        "remaining_overlays": remaining if remaining != float("inf") else -1,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }
