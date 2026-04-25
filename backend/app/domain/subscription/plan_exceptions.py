"""Phase 8C — `SubscriptionPlan` domain exceptions.

Kept in their own module so the API layer can import them without
pulling the entity. Same separation as `panel_exceptions.py` (Phase 7B)
and `catalog_exceptions.py` (Phase 7A).
"""
from __future__ import annotations


class SubscriptionPlanNotFoundError(LookupError):
    """Requested plan id does not exist. Mapped to HTTP 404."""


class SubscriptionPlanIdConflictError(ValueError):
    """A plan with the supplied id already exists. Mapped to HTTP 409.

    Differs from the slug-conflict pattern of Panel/Design because
    `SubscriptionPlan.id` IS the slug — there is no separate `slug`
    field. Code is `subscription_plan_id_conflict` so the admin form
    can render an inline message on the id field.
    """


class SubscriptionPlanInUseError(ValueError):
    """Refused to delete a plan that still has active subscriptions.

    Mapped to HTTP 409. The admin must wait for those subscriptions to
    expire (or migrate them to another plan via a separate, currently
    out-of-scope flow). Soft-disable via `is_active=False` is the
    intended path for retiring plans without affecting historic rows.
    """
