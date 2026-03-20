from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.application.order.use_cases import CreateOrder, GetOrderHistory, GetOrderDetails, CalculateWallCost
from app.container import order_repo
from app.utils.dependencies import get_current_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class OrderItemRequest(BaseModel):
    design_id: str
    design_name: str
    design_image: str = ""
    size_key: str
    color: str = ""
    quantity: int = 1
    unit_price: int = 0


class AddressRequest(BaseModel):
    city: str
    street: str
    building: str
    apartment: str = ""
    postal_code: str = ""


class CreateOrderRequest(BaseModel):
    items: list[OrderItemRequest]
    address: AddressRequest


class OrderItemSchema(BaseModel):
    id: str
    design_name: str
    design_image: str
    size_key: str
    color: str
    quantity: int
    unit_price: int


class OrderSchema(BaseModel):
    id: str
    number: str
    status: str
    total: int
    address: str
    items: list[OrderItemSchema]
    created_at: str


class CalculateRequest(BaseModel):
    panels: list[dict]
    has_subscription: bool = False


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post("", response_model=OrderSchema, status_code=201)
async def create_order(body: CreateOrderRequest, user_id: str = Depends(get_current_user_id)):
    uc = CreateOrder(order_repo)
    order = await uc.execute(
        user_id=user_id,
        items=[item.model_dump() for item in body.items],
        address=body.address.model_dump(),
    )
    return _order_to_response(order)


@router.get("", response_model=list[OrderSchema])
async def list_orders(user_id: str = Depends(get_current_user_id)):
    uc = GetOrderHistory(order_repo)
    orders = await uc.execute(user_id)
    return [_order_to_response(o) for o in orders]


@router.get("/{order_id}", response_model=OrderSchema)
async def get_order(order_id: str, user_id: str = Depends(get_current_user_id)):
    uc = GetOrderDetails(order_repo)
    order = await uc.execute(order_id, user_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_response(order)


@router.post("/calculate")
async def calculate_cost(body: CalculateRequest):
    uc = CalculateWallCost()
    return await uc.execute(body.panels, body.has_subscription)


def _order_to_response(order) -> dict:
    return {
        "id": order.id,
        "number": order.number,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "total": order.total,
        "address": order.address.full if hasattr(order.address, "full") else str(order.address),
        "items": [
            {
                "id": i.id, "design_name": i.design_name, "design_image": i.design_image,
                "size_key": i.size_key, "color": i.color, "quantity": i.quantity, "unit_price": i.unit_price,
            }
            for i in order.items
        ],
        "created_at": order.created_at.isoformat(),
    }
