"""Phase 8A — admin shop-settings endpoints.

* `GET   /api/admin/shop/settings`   — read current singleton row
* `PATCH /api/admin/shop/settings`   — update one or more knobs

There is no POST/DELETE because the row is a singleton seeded by
migration `012`. PATCH semantics: `None` means "don't touch", an
explicit `0` means "set to zero" (relevant for `installation_price`
and `min_order_amount` — `0` disables the feature).

The public counterpart lives in `infrastructure/api/shop.py` (no auth,
same payload shape).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.application.audit.use_cases import RecordAuditEntry
from app.application.shop.settings_use_cases import (
    GetShopSettings,
    UpdateShopSettingsAdmin,
)
from app.container import get_audit_repo, get_shop_settings_repo
from app.domain.shop.settings import ShopSettings
from app.utils.dependencies import get_current_admin_id, get_request_ip

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────


class ShopSettingsResponse(BaseModel):
    id: str
    design_overlay_price: int
    installation_price: int
    min_order_amount: int
    updated_at: str


class ShopSettingsUpdate(BaseModel):
    """PATCH semantics — `None` means "don't touch".

    `ge=0` enforced at the DTO so an oversize-negative payload bounces
    at 422 before the use case is invoked. The use case re-validates as
    a defence-in-depth (a non-API caller could bypass Pydantic).
    """
    design_overlay_price: int | None = Field(default=None, ge=0)
    installation_price: int | None = Field(default=None, ge=0)
    min_order_amount: int | None = Field(default=None, ge=0)


def _to_response(s: ShopSettings) -> ShopSettingsResponse:
    return ShopSettingsResponse(
        id=s.id,
        design_overlay_price=s.design_overlay_price,
        installation_price=s.installation_price,
        min_order_amount=s.min_order_amount,
        updated_at=s.updated_at.isoformat(),
    )


# ─── Endpoints ───────────────────────────────────────────────────────


@router.get("/shop/settings", response_model=ShopSettingsResponse)
async def get_shop_settings_admin(
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_shop_settings_repo),
):
    settings = await GetShopSettings(repo).execute()
    return _to_response(settings)


@router.patch("/shop/settings", response_model=ShopSettingsResponse)
async def patch_shop_settings_admin(
    body: ShopSettingsUpdate,
    admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_shop_settings_repo),
    audit_repo=Depends(get_audit_repo),
    ip: str | None = Depends(get_request_ip),
):
    settings = await UpdateShopSettingsAdmin(
        repo,
        audit_recorder=RecordAuditEntry(audit_repo, request_ip=ip),
    ).execute(
        actor_id=admin_id,
        design_overlay_price=body.design_overlay_price,
        installation_price=body.installation_price,
        min_order_amount=body.min_order_amount,
    )
    return _to_response(settings)
