"""Phase 7B — admin Panel CRUD use cases.

Mirrors the `*Admin` shape established by Phase 4A/4B (orders) and
Phase 5 (users): one use-case class per verb, repo injected via
constructor, `execute(...)` is the single public method. The API layer
instantiates them inline next to the dependency overrides — keeps the
DI graph trivially inspectable.

Validation strategy:
  Caller-input shape errors (missing field, wrong type, length, range)
  belong to Pydantic at the API layer. *Domain* invariants live here:
    * slug is required but may repeat for the same base form;
    * one named base form may hold 30x30 / 30x60 / 60x60 at most —
      a second row with the same name + dimensions is a 409
      (`PanelSizeConflictError`); name comparison is case-insensitive
      and ignores surrounding whitespace;
    * not-found on update/delete — translated to `PanelNotFoundError`
      so the API maps it to 404 the same way it does for orders.
  Payload size/format validation for `photo_path` is NOT here: the
  admin uploads through `POST /api/admin/media` (Phase 6), receives a
  validated path, and only sends that path back. The Phase 6 use case
  already enforced size/MIME/dimensions; re-validating here would mean
  duplicating the constraint table.
"""
from __future__ import annotations

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
)
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.panel import Panel
from app.domain.catalog.panel_exceptions import (
    PanelNotFoundError,
    PanelSizeConflictError,
    PanelSlugConflictError,
)
from app.domain.catalog.recommendation import RecommendationSourceType
from app.domain.catalog.repositories import PanelRepository
from app.domain.catalog.value_objects import PanelSize


def _normalized_panel_name(name: str) -> str:
    return " ".join(name.strip().casefold().split())


async def _ensure_name_size_unique(
    repo: PanelRepository,
    *,
    name: str,
    width_mm: int,
    height_mm: int,
    ignore_id: str | None = None,
) -> None:
    """Reject a second row with the same form name + dimensions.

    Pages through the repo (500 rows per batch) so the check sees the
    full table, not just the first admin page. `ignore_id` exempts the
    row being patched (a PATCH that keeps its own name/size must not
    collide with itself)."""
    needle = _normalized_panel_name(name)
    offset = 0
    while True:
        batch, total = await repo.list_panels(
            include_inactive=True, offset=offset, limit=500,
        )
        for item in batch:
            if ignore_id is not None and item.id == ignore_id:
                continue
            if (
                _normalized_panel_name(item.name) == needle
                and item.size.width_mm == width_mm
                and item.size.height_mm == height_mm
            ):
                raise PanelSizeConflictError(
                    f"Форма '{item.name}' уже существует в размере "
                    f"{width_mm // 10}×{height_mm // 10} см"
                )
        offset += len(batch)
        if offset >= total or not batch:
            break


class CreatePanelAdmin:
    """Persist a new panel with a distinct ID and reusable form slug.

    Uniqueness key is the normalized form name + size: creating a row
    whose name (case-insensitive, trimmed) and dimensions match an
    existing panel raises `PanelSizeConflictError` → HTTP 409
    (`panel_size_conflict`)."""

    def __init__(self, repo: PanelRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        slug: str,
        size: PanelSize,
        base_price: int,
        availability_status_id: str | None = None,
        description: str = "",
        thickness_mm: int = 3,
        execution: str = "Архитектурное декоративное покрытие",
        mounting_system: str = "Запатентованная система быстрой замены",
        base_material: str = "Ультралёгкий композит высокой плотности",
        packaging: str = "",
        photo_path: str = "",
        photo_paths: list[str] | None = None,
        form_preview_path: str = "",
        is_active: bool = True,
    ) -> Panel:
        if not slug:
            raise ValueError("Panel.slug must not be empty")
        await _ensure_name_size_unique(
            self.repo,
            name=name,
            width_mm=size.width_mm,
            height_mm=size.height_mm,
        )
        # Entity __post_init__ enforces non-negative price + positive size.
        panel = Panel(
            name=name,
            slug=slug,
            size=size,
            base_price=base_price,
            availability_status_id=availability_status_id,
            description=description,
            thickness_mm=thickness_mm,
            execution=execution,
            mounting_system=mounting_system,
            base_material=base_material,
            packaging=packaging,
            photo_path=photo_path,
            # `Panel.__post_init__` -> `sync_photos()` reconciles the two
            # photo fields, so passing either one alone is valid here.
            photo_paths=list(photo_paths or []),
            form_preview_path=form_preview_path,
            is_active=is_active,
        )
        return await self.repo.create(panel)


class UpdatePanelAdmin:
    """Patch-style update: only fields passed (non-None) are written.

    `None` means "don't touch"; an empty string means "clear" (relevant
    for `photo_path` and `description`). This mirrors the PATCH semantics
    used by `users.py` and `orders.py` — the API layer's Pydantic model
    must use `Optional[T] = None` for every patchable field.

    Size patch fields (`width_mm`, `height_mm`, `size_label`) are passed
    individually so we can compose `PanelSize` from current + patch
    without forcing the API layer to pre-load the row (was an N+1 in the
    first cut). For backward compatibility callers MAY still pass a
    pre-composed `size` — if both are given, `size` wins.

    Renaming a form or changing its dimensions re-checks the
    name + size uniqueness (`PanelSizeConflictError` → 409) against
    every OTHER row; keeping the row's own name/size never collides.

    Slug is a grouping label, not a unique identifier. Only an empty
    slug is rejected; panel identity is its ID.
    """

    def __init__(self, repo: PanelRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        panel_id: str,
        name: str | None = None,
        slug: str | None = None,
        size: PanelSize | None = None,
        width_mm: int | None = None,
        height_mm: int | None = None,
        size_label: str | None = None,
        base_price: int | None = None,
        availability_status_id: str | None = None,
        description: str | None = None,
        thickness_mm: int | None = None,
        execution: str | None = None,
        mounting_system: str | None = None,
        base_material: str | None = None,
        packaging: str | None = None,
        photo_path: str | None = None,
        photo_paths: list[str] | None = None,
        form_preview_path: str | None = None,
        is_active: bool | None = None,
    ) -> Panel:
        panel = await self.repo.get_by_id(panel_id)
        if panel is None:
            raise PanelNotFoundError(f"Panel {panel_id} not found")

        if slug is not None and slug != panel.slug:
            if not slug:
                raise ValueError("Panel.slug must not be empty")
            panel.slug = slug

        if name is not None:
            panel.name = name
        # Compose size from individual patch components if any provided —
        # current row supplies the untouched ones. A pre-composed `size`
        # arg overrides this branch (kept for symmetry with other use
        # cases that take VOs directly).
        if size is None and (
            width_mm is not None
            or height_mm is not None
            or size_label is not None
        ):
            size = PanelSize(
                width_mm=width_mm if width_mm is not None else panel.size.width_mm,
                height_mm=height_mm if height_mm is not None else panel.size.height_mm,
                label=size_label if size_label is not None else panel.size.label,
            )
        if size is not None:
            if size.width_mm <= 0 or size.height_mm <= 0:
                raise ValueError("Panel.size dimensions must be positive")
            panel.size = size
        if name is not None or size is not None:
            await _ensure_name_size_unique(
                self.repo,
                name=panel.name,
                width_mm=panel.size.width_mm,
                height_mm=panel.size.height_mm,
                ignore_id=panel_id,
            )
        if base_price is not None:
            if base_price < 0:
                raise ValueError("Panel.base_price cannot be negative")
            panel.base_price = base_price
        if availability_status_id is not None:
            panel.availability_status_id = availability_status_id or None
        if description is not None:
            panel.description = description
        if thickness_mm is not None:
            if thickness_mm <= 0:
                raise ValueError("Panel thickness must be positive")
            panel.thickness_mm = thickness_mm
        for field_name, value in (("execution", execution), ("mounting_system", mounting_system),
                                  ("base_material", base_material), ("packaging", packaging)):
            if value is not None:
                setattr(panel, field_name, value)
        # Photo handling: the gallery is authoritative when supplied
        # (admin drag-ordered it), otherwise a lone `photo_path` patch
        # rewrites the primary slot. `sync_photos()` then re-establishes
        # the "first gallery item == primary" invariant either way, so an
        # empty list correctly clears both fields.
        if photo_paths is not None:
            panel.photo_paths = list(photo_paths)
            panel.photo_path = ""
        if photo_path is not None:
            panel.photo_path = photo_path
            if photo_paths is None:
                # Primary-only patch: rebuild the gallery from scratch so
                # a stale first element can't survive the update.
                panel.photo_paths = []
        if photo_paths is not None or photo_path is not None:
            panel.sync_photos()
        if form_preview_path is not None:
            panel.form_preview_path = form_preview_path
        if is_active is not None:
            panel.is_active = is_active

        return await self.repo.update(panel)


class DeletePanelAdmin:
    """Hard-delete a panel.

    No `PanelInUseError` — order rows reference panels by `size_key`
    text (no FK), so dropping a panel does NOT orphan history. Soft-hide
    is available via `UpdatePanelAdmin(is_active=False)` for admins who
    want to keep the row.

    Returns True on success, False if the id was unknown — same shape as
    `DeleteMedia`. The API layer turns False into 404.

    Phase 9 — when an `audit_recorder` collaborator is wired in, a
    successful delete (and ONLY a successful one) appends a
    `PANEL_DELETE` audit entry. A miss (panel didn't exist) is not
    logged because there is nothing to attribute the event to — same
    rule as the idempotent no-ops in `BlockUserAdmin`.

    Phase 10 — when a `recommendation_cleanup` collaborator is wired in,
    a successful delete also prunes every `Recommendation` row that
    references this panel (as source OR as target). The cleanup result
    `(source_dropped, targets_pruned)` is folded into the PANEL_DELETE
    audit payload so a forensics search shows the cascade footprint
    without a separate event. Cleanup is *optional* to preserve the
    pre-Phase-10 constructor signature for the CLI seeder and legacy
    tests that don't care about the rail.

    `actor_id` is optional to preserve the original signature for
    callers that don't run under an admin context (the CLI seeder, the
    deprecated test path that pre-dates Phase 9). When the audit
    recorder is wired in but `actor_id` is None we skip logging — an
    unattributed entry would fail the entity invariant.
    """

    def __init__(
        self,
        repo: PanelRepository,
        audit_recorder: RecordAuditEntry | None = None,
        recommendation_cleanup: CleanupRecommendationsOnDelete | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder
        self.recommendation_cleanup = recommendation_cleanup

    async def execute(
        self, panel_id: str, *, actor_id: str | None = None,
    ) -> bool:
        # Pre-load so the audit payload can carry the slug/name even
        # though the row is gone after delete(). One extra read per
        # delete is cheap; reconstructing the payload from the soon-to-
        # be-deleted row is impossible after the fact.
        panel = await self.repo.get_by_id(panel_id)
        if panel is None:
            return False
        deleted = await self.repo.delete(panel_id)
        if not deleted:
            return False

        # Cascade — runs AFTER the panel row is gone so a foreign-key
        # cycle (panel A recommends panel B, panel B recommends panel
        # A — both deleted in sequence) cannot resurrect the row. The
        # cleanup is *not* idempotent against the panel itself (the
        # row doesn't exist anymore to re-check) but IS idempotent
        # against the recommendation aggregates — calling it twice
        # finds nothing to prune.
        cascade_report: dict | None = None
        if self.recommendation_cleanup is not None:
            cascade_report = await self.recommendation_cleanup.execute(
                RecommendationSourceType.PANEL, panel_id,
            )

        if self.audit_recorder is not None and actor_id is not None:
            payload: dict = {"name": panel.name, "slug": panel.slug}
            # Only attach the cascade keys when cleanup actually ran;
            # keeps the audit payload minimal for callers that didn't
            # wire the cleanup collaborator.
            if cascade_report is not None:
                payload["recommendations_cleanup"] = cascade_report
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.PANEL_DELETE,
                target_type=AuditTargetType.PANEL,
                target_id=panel_id,
                payload=payload,
            )
        return True


class ListPanelsAdmin:
    """Paginated list for the admin table — includes inactive rows.

    Public catalog uses `ListPanelsPublic` which hard-codes
    `include_inactive=False`. Splitting the two use cases (rather than a
    single one with a flag) means a public endpoint cannot accidentally
    expose hidden panels by passing the wrong query string.

    Phase 7B remediation 2 (FE-B) — accepts `is_active` and `search`
    filters so the admin table can scale past in-page client filtering.
    Both `None` keeps the legacy "show everything" behavior (back-
    compat with first-cut tests).
    """

    def __init__(self, repo: PanelRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        is_active: bool | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Panel], int]:
        return await self.repo.list_panels(
            include_inactive=True,
            is_active=is_active,
            search=search,
            offset=offset,
            limit=limit,
        )


class GetPanelAdmin:
    def __init__(self, repo: PanelRepository):
        self.repo = repo

    async def execute(self, panel_id: str) -> Panel:
        panel = await self.repo.get_by_id(panel_id)
        if panel is None:
            raise PanelNotFoundError(f"Panel {panel_id} not found")
        return panel


class ListPanelsPublic:
    """Public catalog read — active panels only.

    Hard-codes `include_inactive=False` so the public endpoint cannot be
    coerced into leaking hidden SKUs by query-string fiddling. Returns
    the same shape as the admin list for consistency at the response
    schema.
    """

    def __init__(self, repo: PanelRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Panel], int]:
        return await self.repo.list_panels(
            include_inactive=False, offset=offset, limit=limit,
        )
