from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr

from app.infrastructure.security.rate_limit import limiter

router = APIRouter()


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    message: str


class CalculatorRequest(BaseModel):
    panels: list[dict]
    has_subscription: bool = False


@router.post("/contacts")
@limiter.limit("5/minute")
async def submit_contact(request: Request, body: ContactRequest):
    # In production: send email, save to DB
    return {"status": "sent", "message": "Спасибо! Мы свяжемся с вами в ближайшее время."}


@router.post("/calculator")
async def calculate(body: CalculatorRequest):
    from app.domain.order.services import calculate_wall_cost
    return calculate_wall_cost(body.panels, body.has_subscription)
