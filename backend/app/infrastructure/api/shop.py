"""Phase 8 — public shop endpoints (no auth).

Houses the *read* side of the Shop bounded context that the frontend
constructor + catalog consume. Phase 8A registers
`GET /api/shop/settings`. Phase 8B will register
`GET /api/shop/banners`. Phase 8C will register
`GET /api/subscription-plans` (lives outside this module — alongside
the admin tariff CRUD — because plans are visible enough to deserve
their own URL prefix).

No `Request`-suffix DTOs here; this is a read-only public surface.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.application.shop.settings_use_cases import GetShopSettings
from app.container import get_shop_settings_repo

router = APIRouter()


class ShopSettingsResponse(BaseModel):
    """Public shape — same fields as the admin response.

    Defined here (not imported from `admin/shop_settings.py`) so a
    future admin-only field (audit timestamp, internal flags) does not
    accidentally leak by transitive type sharing. Same posture as
    `PanelSchema` (public catalog) vs `PanelResponse` (admin).
    """
    id: str
    design_overlay_price: int
    installation_price: int
    min_order_amount: int
    updated_at: str


@router.get("/shop/settings", response_model=ShopSettingsResponse)
async def get_shop_settings_public(
    repo=Depends(get_shop_settings_repo),
):
    """Public read of the singleton shop settings.

    No auth — frontend caches this for 5 minutes (TanStack Query) and
    falls back to the legacy `frontend/src/shared/config/constants.ts`
    constants if the request fails (offline-resilient).
    """
    s = await GetShopSettings(repo).execute()
    return ShopSettingsResponse(
        id=s.id,
        design_overlay_price=s.design_overlay_price,
        installation_price=s.installation_price,
        min_order_amount=s.min_order_amount,
        updated_at=s.updated_at.isoformat(),
    )
