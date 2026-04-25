"""Phase 9 — value objects for the audit log.

`AuditAction` is the closed set of action codes the application is
allowed to record. Storing as `str` Enum (not raw string) so a typo at
the call site fails at import time, not at incident-investigation
time, AND so the DB column stores the literal which keeps logs
human-readable even if the enum is reordered.

`AuditTargetType` mirrors the bounded contexts that own the
audit-target. We keep it small and additive — adding a new variant is
cheap, removing one would require a data migration.

Why two enums (action + target_type) instead of a single
`USER_BLOCK` action that implies target_type=USER?
  * The same target type can be the subject of multiple actions
    (USER_BLOCK and USER_UNBLOCK both target USER) — pairing them lets
    the read API filter by target without hardcoding the action map.
  * Future actions like `EXPORT_USERS` (no specific target) need a
    NULL target_type — the split keeps that legal.
"""
from __future__ import annotations

from enum import Enum


class AuditAction(str, Enum):
    """Closed set of admin actions tracked by the audit log.

    Ordered roughly by bounded-context (user → order → catalog → shop
    → media) so a future reader of the enum can scan it top-down. The
    serialised value is `snake_case` — that's what lands in the DB
    column, the JSON API response, and admin UI filters.
    """

    USER_BLOCK = "user_block"
    USER_UNBLOCK = "user_unblock"
    ROLE_GRANT = "role_grant"
    ROLE_REVOKE = "role_revoke"

    ORDER_STATUS_CHANGE = "order_status_change"
    ORDER_REFUND = "order_refund"
    ORDER_NOTE_ADD = "order_note_add"

    DESIGN_DELETE = "design_delete"
    # Phase 7A — publish/unpublish toggle. Tracked separately from
    # generic edits because flipping `is_published` changes the public
    # catalog surface; future incident review needs to attribute who
    # hid/showed which design and when.
    DESIGN_VISIBILITY_TOGGLE = "design_visibility_toggle"
    PANEL_DELETE = "panel_delete"
    RECOMMENDATION_UPSERT = "recommendation_upsert"
    RECOMMENDATION_DELETE = "recommendation_delete"

    SETTINGS_UPDATE = "settings_update"

    MEDIA_UPLOAD_SUSPICIOUS = "media_upload_suspicious"


class AuditTargetType(str, Enum):
    """The bounded-context the audit-target lives in.

    Used by the admin UI to construct deep links (`USER` → `/admin/users/{id}`).
    A `None` target_type is legal in the entity for actions that have
    no single target (bulk exports, settings-without-id), but the
    enum here only enumerates the typed cases.
    """

    USER = "user"
    ORDER = "order"
    DESIGN = "design"
    PANEL = "panel"
    SETTINGS = "settings"
    MEDIA = "media"
    RECOMMENDATION = "recommendation"
