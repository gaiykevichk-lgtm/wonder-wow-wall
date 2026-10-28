"""Phase 8C — admin Subscription Plan CRUD + public listing.

Mirrors the `*Admin` shape from Phase 7B `panel_use_cases.py`. The
public list (`ListSubscriptionPlansPublic`) hard-codes `active_only=True`
so a public endpoint cannot accidentally expose retired plans by URL
fiddling.

Validation:
  Pydantic shape errors at the API; domain invariants live here:
    * `id` non-empty AND not already taken (`SubscriptionPlanIdConflictError`).
    * Delete refused if `count_active_by_plan(id) > 0`
      (`SubscriptionPlanInUseError`). Soft-disable via `is_active=False`
      is the alternative for retiring plans without breaking historic
      `Subscription` rows.
"""
from __future__ import annotations

from datetime import datetime

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.subscription.entities import SubscriptionPlan
from app.domain.subscription.plan_exceptions import (
    SubscriptionPlanIdConflictError,
    SubscriptionPlanInUseError,
    SubscriptionPlanNotFoundError,
)
from app.domain.subscription.repositories import (
    SubscriptionPlanRepository,
    SubscriptionRepository,
)


class CreateSubscriptionPlanAdmin:
    def __init__(self, repo: SubscriptionPlanRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        plan_id: str,
        name: str,
        price: int,
        period: str = "мес",
        area_limit_m2: float = 0,
        popular: bool = False,
        is_active: bool = True,
        sort_order: int = 0,
        features: list[str] | None = None,
    ) -> SubscriptionPlan:
        if not plan_id:
            raise ValueError("SubscriptionPlan.id must not be empty")
        if not name:
            raise ValueError("SubscriptionPlan.name must not be empty")
        existing = await self.repo.get_by_id(plan_id)
        if existing is not None:
            raise SubscriptionPlanIdConflictError(
                f"SubscriptionPlan with id {plan_id!r} already exists"
            )
        plan = SubscriptionPlan(
            id=plan_id, name=name, price=price, period=period,
            area_limit_m2=area_limit_m2, popular=popular,
            is_active=is_active, sort_order=sort_order,
            features=list(features or []),
        )
        return await self.repo.create(plan)


class UpdateSubscriptionPlanAdmin:
    """Patch-style update — `None` = "don't touch".

    `id` is the PK and cannot be patched (would break
    `Subscription.plan_id` references). Admin who needs to "rename"
    creates a new plan, migrates the subscriptions manually, then
    deletes the old.
    """

    def __init__(self, repo: SubscriptionPlanRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        plan_id: str,
        name: str | None = None,
        price: int | None = None,
        period: str | None = None,
        area_limit_m2: float | None = None,
        popular: bool | None = None,
        is_active: bool | None = None,
        sort_order: int | None = None,
        features: list[str] | None = None,
    ) -> SubscriptionPlan:
        plan = await self.repo.get_by_id(plan_id)
        if plan is None:
            raise SubscriptionPlanNotFoundError(
                f"SubscriptionPlan {plan_id} not found"
            )
        if name is not None:
            if not name:
                raise ValueError("SubscriptionPlan.name must not be empty")
            plan.name = name
        if price is not None:
            if price < 0:
                raise ValueError("SubscriptionPlan.price cannot be negative")
            plan.price = price
        if period is not None:
            plan.period = period
        if area_limit_m2 is not None:
            if area_limit_m2 < 0:
                raise ValueError(
                    "SubscriptionPlan.area_limit_m2 cannot be negative"
                )
            plan.area_limit_m2 = area_limit_m2
        if popular is not None:
            plan.popular = popular
        if is_active is not None:
            plan.is_active = is_active
        if sort_order is not None:
            plan.sort_order = sort_order
        if features is not None:
            plan.features = list(features)
        plan.updated_at = datetime.utcnow()
        return await self.repo.update(plan)


class DeleteSubscriptionPlanAdmin:
    """Hard-delete a plan — refused if any active subscription references it.

    Pre-check via `subscription_repo.count_active_by_plan` mirrors the
    `CategoryInUseError` pattern from Phase 7A. The `subscription_repo`
    is required (not optional) because the in-use guard is the entire
    point of this use case — a delete without it would orphan running
    subscriptions silently.

    Audit (Phase 9) — successful delete records `SETTINGS_UPDATE` with
    `payload={op: "subscription_plan_delete", id, name, price}`. Same
    enum reuse rationale as `DeleteBannerAdmin`.
    """

    def __init__(
        self,
        plan_repo: SubscriptionPlanRepository,
        subscription_repo: SubscriptionRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.plan_repo = plan_repo
        self.subscription_repo = subscription_repo
        self.audit_recorder = audit_recorder

    async def execute(
        self, plan_id: str, *, actor_id: str | None = None,
    ) -> bool:
        plan = await self.plan_repo.get_by_id(plan_id)
        if plan is None:
            return False
        active = await self.subscription_repo.count_active_by_plan(plan_id)
        if active > 0:
            raise SubscriptionPlanInUseError(
                f"Cannot delete plan {plan_id!r}: "
                f"{active} active subscription(s)"
            )
        deleted = await self.plan_repo.delete(plan_id)
        if not deleted:
            return False
        if self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.SETTINGS_UPDATE,
                target_type=AuditTargetType.SETTINGS,
                target_id=plan_id,
                payload={
                    "op": "subscription_plan_delete",
                    "id": plan_id,
                    "name": plan.name,
                    "price": plan.price,
                },
            )
        return True


class GetSubscriptionPlanAdmin:
    def __init__(self, repo: SubscriptionPlanRepository):
        self.repo = repo

    async def execute(self, plan_id: str) -> SubscriptionPlan:
        plan = await self.repo.get_by_id(plan_id)
        if plan is None:
            raise SubscriptionPlanNotFoundError(
                f"SubscriptionPlan {plan_id} not found"
            )
        return plan


class ListSubscriptionPlansAdmin:
    """Admin list — every plan, sorted by `sort_order`."""

    def __init__(self, repo: SubscriptionPlanRepository):
        self.repo = repo

    async def execute(self) -> list[SubscriptionPlan]:
        return await self.repo.list_plans(active_only=False)


class ListSubscriptionPlansPublic:
    """Public list — active plans only.

    Hard-codes `active_only=True` so the public catalog cannot leak
    retired plans via query-string fiddling.
    """

    def __init__(self, repo: SubscriptionPlanRepository):
        self.repo = repo

    async def execute(self) -> list[SubscriptionPlan]:
        return await self.repo.list_plans(active_only=True)
