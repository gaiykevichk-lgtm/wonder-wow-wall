"""Phase 7A — admin Catalog CRUD use cases (categories + designs).

Mirrors the `*Admin` shape established by Phase 4A/4B (orders), Phase 5
(users), and Phase 7B (panels): one use-case class per verb, repo
injected via constructor, `execute(...)` is the single public method.
The API layer instantiates them inline next to the dependency overrides
— keeps the DI graph trivially inspectable.

Validation strategy:
  Caller-input shape errors (missing field, wrong type, length, range)
  belong to Pydantic at the API layer. *Domain* invariants live here:
    * slug uniqueness — checked against the repo before insert/update so
      the API can branch on `*SlugConflictError → 409` instead of
      letting the SQL UNIQUE constraint surface as an opaque 500.
    * not-found on update/delete → `*NotFoundError` so the API maps it
      to 404 the same way it does for orders/panels.
    * `CategoryInUseError` — refusal to delete a category that still
      has designs. Pre-checked here so cascade safety is a domain
      invariant, not a DB-level FK accident.

Phase 9 — `DeleteDesignAdmin` records `DESIGN_DELETE` audit entries
through the `RecordAuditEntry` collaborator (same pattern as
`DeletePanelAdmin`). Phase 10 — same use case also runs the
`CleanupRecommendationsOnDelete` collaborator so a removed design
cannot leave orphan recommendation rows.
"""
from __future__ import annotations

from app.application.audit.use_cases import RecordAuditEntry
from app.application.catalog.recommendation_use_cases import (
    CleanupRecommendationsOnDelete,
)
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.catalog_exceptions import (
    CategoryInUseError,
    CategoryNotFoundError,
    CategorySlugConflictError,
    DesignNotFoundError,
    DesignSlugConflictError,
)
from app.domain.catalog.entities import Category, Design
from app.domain.catalog.recommendation import RecommendationSourceType
from app.domain.catalog.repositories import (
    CategoryRepository,
    DesignRepository,
)
from app.domain.catalog.value_objects import Color


# ═══════════════════════════════════════════════════════════════════════
# Categories
# ═══════════════════════════════════════════════════════════════════════


class CreateCategoryAdmin:
    """Persist a new Category.

    Slug uniqueness is checked against the repo before insert so the
    error type is a *domain* exception with a stable code, not a leaked
    DB-layer `IntegrityError`. Same race caveat as `CreatePanelAdmin`:
    the SQL UNIQUE constraint is the safety net.
    """

    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        slug: str,
        image: str = "",
    ) -> Category:
        if not slug:
            raise ValueError("Category.slug must not be empty")
        if not name:
            raise ValueError("Category.name must not be empty")
        existing = await self.repo.get_by_slug(slug)
        if existing is not None:
            raise CategorySlugConflictError(
                f"Category with slug {slug!r} already exists"
            )
        category = Category(name=name, slug=slug, image=image)
        return await self.repo.create(category)


class UpdateCategoryAdmin:
    """Patch-style update: only fields passed (non-None) are written.

    `None` means "don't touch"; an empty string means "clear" (relevant
    for `image`). Slug uniqueness is re-checked if `slug` changed; we
    compare against the *current* row's slug to avoid a false 409 when
    the admin saves the modal without touching the slug.

    Audit posture: NOT audited — same rationale as `UpdateDesignAdmin`
    above. Categories are content scaffolding; their delete IS guarded
    by `CategoryInUseError` (cascade refusal), not auditing.
    """

    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        category_id: str,
        name: str | None = None,
        slug: str | None = None,
        image: str | None = None,
    ) -> Category:
        category = await self.repo.get_by_id(category_id)
        if category is None:
            raise CategoryNotFoundError(f"Category {category_id} not found")

        if slug is not None and slug != category.slug:
            if not slug:
                raise ValueError("Category.slug must not be empty")
            taken = await self.repo.get_by_slug(slug)
            if taken is not None and taken.id != category.id:
                raise CategorySlugConflictError(
                    f"Category with slug {slug!r} already exists"
                )
            category.slug = slug

        if name is not None:
            if not name:
                raise ValueError("Category.name must not be empty")
            category.name = name
        if image is not None:
            category.image = image

        return await self.repo.update(category)


class DeleteCategoryAdmin:
    """Hard-delete a category — ONLY if it has zero attached designs.

    Pre-check via `count_designs` is the canonical guard; the DB-level
    FK from `designs.category_id` would also refuse the delete, but
    we want a clean 409 with a stable code rather than a leaked
    `IntegrityError`. Returns True on success, False on miss (the API
    layer turns False into 404 via `CategoryNotFoundError`).
    """

    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    async def execute(self, category_id: str) -> bool:
        category = await self.repo.get_by_id(category_id)
        if category is None:
            return False
        attached = await self.repo.count_designs(category_id)
        if attached > 0:
            raise CategoryInUseError(
                f"Cannot delete category {category_id!r}: "
                f"{attached} design(s) attached"
            )
        return await self.repo.delete(category_id)


class ListCategoriesAdmin:
    """Admin list — every category, with attached-design counts.

    Differs from the public `ListCategories` (in `use_cases.py`) only by
    enriching each row with a freshly counted `count` field — the seed
    data baked the value at creation time, but admin CRUD makes it
    drift quickly. Counting at read-time is simpler than maintaining
    counters at write-time and the dataset is small (dozens of rows).
    """

    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    async def execute(self) -> list[tuple[Category, int]]:
        categories = await self.repo.list_all()
        rows: list[tuple[Category, int]] = []
        for c in categories:
            n = await self.repo.count_designs(c.id)
            rows.append((c, n))
        return rows


# ═══════════════════════════════════════════════════════════════════════
# Designs
# ═══════════════════════════════════════════════════════════════════════


class CreateDesignAdmin:
    """Persist a new Design.

    Slug uniqueness pre-check + category existence check. Both surface
    as domain exceptions (`DesignSlugConflictError` / `CategoryNotFoundError`)
    so the API layer can map them to dedicated codes.

    `colors` is a list of `Color` VO — the admin form sends `[{hex,
    name}]` and the API layer composes the VOs before calling here.
    Defaults to empty list (legal in the entity) so a "no colors yet"
    save is allowed; the public catalog filters by color silently
    skip rows with no colors.
    """

    def __init__(
        self,
        design_repo: DesignRepository,
        category_repo: CategoryRepository,
    ):
        self.design_repo = design_repo
        self.category_repo = category_repo

    async def execute(
        self,
        *,
        name: str,
        slug: str,
        category_id: str,
        style: str = "",
        image: str = "",
        description: str = "",
        price: int = 1200,
        colors: list[Color] | None = None,
        is_published: bool = True,
        is_new: bool = False,
        is_popular: bool = False,
    ) -> Design:
        if not name:
            raise ValueError("Design.name must not be empty")
        if not slug:
            raise ValueError("Design.slug must not be empty")
        if price < 0:
            raise ValueError("Design.price cannot be negative")

        category = await self.category_repo.get_by_id(category_id)
        if category is None:
            raise CategoryNotFoundError(
                f"Category {category_id!r} does not exist"
            )

        existing = await self.design_repo.get_by_slug(slug)
        if existing is not None:
            raise DesignSlugConflictError(
                f"Design with slug {slug!r} already exists"
            )

        design = Design(
            name=name,
            slug=slug,
            category_id=category_id,
            style=style,
            image=image,
            description=description,
            price=price,
            colors=list(colors or []),
            is_published=is_published,
            is_new=is_new,
            is_popular=is_popular,
        )
        return await self.design_repo.create(design)


class UpdateDesignAdmin:
    """Patch-style update for designs.

    Same `None` = "don't touch" semantics as `UpdatePanelAdmin`.
    Re-checks slug uniqueness only when slug actually changed; verifies
    the new `category_id` exists when supplied. `is_published` is
    patched here too — the dedicated `ToggleDesignVisibilityAdmin` is
    a convenience wrapper for the inline switch in the admin table.

    Audit posture (Phase 9 design decision):
      Routine content edits (name/slug/category/style/image/description/
      price/colors/is_new/is_popular) are NOT audited. Rationale: same
      class as `UpdateUserProfile` and order-item edits — content
      changes that don't shift visibility or security posture, on a
      single-tenant admin where attribution is implicit (one or two
      admins, git-blame-style). The destructive action `DESIGN_DELETE`
      and the public-facing flip `DESIGN_VISIBILITY_TOGGLE` ARE audited
      because they change the public catalog surface. If a future ticket
      requires field-level diffs (compliance, multi-admin teams), add
      an `audit_recorder` collaborator here matching the Phase 8A
      `UpdateShopSettingsAdmin` diff-payload pattern.
    """

    def __init__(
        self,
        design_repo: DesignRepository,
        category_repo: CategoryRepository,
    ):
        self.design_repo = design_repo
        self.category_repo = category_repo

    async def execute(
        self,
        *,
        design_id: str,
        name: str | None = None,
        slug: str | None = None,
        category_id: str | None = None,
        style: str | None = None,
        image: str | None = None,
        description: str | None = None,
        price: int | None = None,
        colors: list[Color] | None = None,
        is_published: bool | None = None,
        is_new: bool | None = None,
        is_popular: bool | None = None,
    ) -> Design:
        design = await self.design_repo.get_by_id(design_id)
        if design is None:
            raise DesignNotFoundError(f"Design {design_id} not found")

        if slug is not None and slug != design.slug:
            if not slug:
                raise ValueError("Design.slug must not be empty")
            taken = await self.design_repo.get_by_slug(slug)
            if taken is not None and taken.id != design.id:
                raise DesignSlugConflictError(
                    f"Design with slug {slug!r} already exists"
                )
            design.slug = slug

        if category_id is not None and category_id != design.category_id:
            category = await self.category_repo.get_by_id(category_id)
            if category is None:
                raise CategoryNotFoundError(
                    f"Category {category_id!r} does not exist"
                )
            design.category_id = category_id

        if name is not None:
            if not name:
                raise ValueError("Design.name must not be empty")
            design.name = name
        if style is not None:
            design.style = style
        if image is not None:
            design.image = image
        if description is not None:
            design.description = description
        if price is not None:
            if price < 0:
                raise ValueError("Design.price cannot be negative")
            design.price = price
        if colors is not None:
            design.colors = list(colors)
        if is_published is not None:
            design.is_published = is_published
        if is_new is not None:
            design.is_new = is_new
        if is_popular is not None:
            design.is_popular = is_popular

        return await self.design_repo.update(design)


class ToggleDesignVisibilityAdmin:
    """Flip `is_published` for a design.

    Convenience use case the admin table's inline `<Switch>` calls so
    the front-end doesn't have to read-then-write through the patch
    endpoint. The full PATCH path (`UpdateDesignAdmin`) still works for
    callers that want explicit value control. Returns the updated
    domain entity so the caller can re-render the row immediately.

    Phase 9 — when an `audit_recorder` collaborator is wired in, every
    successful flip records a `DESIGN_VISIBILITY_TOGGLE` audit entry
    with the diff (`{from, to}` booleans, plus `name` / `slug` for
    forensics). Unlike the generic `UpdateDesignAdmin` (routine content
    edit, not audited), publish/unpublish changes the public catalog
    surface and warrants a record. Audit is skipped when `actor_id` is
    None (CLI seeder, legacy tests) — same posture as `DeleteDesignAdmin`.
    """

    def __init__(
        self,
        repo: DesignRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self, design_id: str, *, actor_id: str | None = None,
    ) -> Design:
        design = await self.repo.get_by_id(design_id)
        if design is None:
            raise DesignNotFoundError(f"Design {design_id} not found")
        was = design.is_published
        design.is_published = not was
        updated = await self.repo.update(design)

        if self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.DESIGN_VISIBILITY_TOGGLE,
                target_type=AuditTargetType.DESIGN,
                target_id=design_id,
                payload={
                    "from": was,
                    "to": updated.is_published,
                    "name": updated.name,
                    "slug": updated.slug,
                },
            )
        return updated


class DeleteDesignAdmin:
    """Hard-delete a design.

    Same shape as `DeletePanelAdmin` (Phase 7B):
      * pre-load the row so the audit payload carries name/slug,
      * skip audit on miss (nothing to attribute),
      * run the optional `recommendation_cleanup` collaborator AFTER
        the row is gone — fold the cascade report into the audit
        payload as `recommendations_cleanup` so a forensics search
        sees the cascade footprint without a separate event.

    No "in-use" guard: order rows reference designs by `design_id` text
    plus a snapshotted `design_name`/`design_image` (see `OrderItem`),
    so deleting a design does NOT orphan order history. Recommendations
    that target the deleted design are pruned by the cleanup
    collaborator.
    """

    def __init__(
        self,
        repo: DesignRepository,
        audit_recorder: RecordAuditEntry | None = None,
        recommendation_cleanup: CleanupRecommendationsOnDelete | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder
        self.recommendation_cleanup = recommendation_cleanup

    async def execute(
        self, design_id: str, *, actor_id: str | None = None,
    ) -> bool:
        design = await self.repo.get_by_id(design_id)
        if design is None:
            return False
        deleted = await self.repo.delete(design_id)
        if not deleted:
            return False

        # Cascade — runs AFTER the design row is gone. Same ordering as
        # DeletePanelAdmin: a foreign-key cycle (design A recommends
        # design B, design B recommends design A — both deleted in
        # sequence) cannot resurrect the row. Cleanup is *idempotent*
        # against the recommendation aggregates: calling it twice
        # finds nothing to prune.
        cascade_report: dict | None = None
        if self.recommendation_cleanup is not None:
            cascade_report = await self.recommendation_cleanup.execute(
                RecommendationSourceType.DESIGN, design_id,
            )

        if self.audit_recorder is not None and actor_id:
            payload: dict = {"name": design.name, "slug": design.slug}
            if cascade_report is not None:
                payload["recommendations_cleanup"] = cascade_report
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.DESIGN_DELETE,
                target_type=AuditTargetType.DESIGN,
                target_id=design_id,
                payload=payload,
            )
        return True


class ListDesignsAdmin:
    """Paginated admin design list — sees published AND unpublished rows.

    Unlike the public `ListDesigns` (which the use case in `use_cases.py`
    delegates to with an implicit `is_published=True` filter), this one
    explicitly passes `is_published=None` so the admin table can show
    everything and toggle visibility from inline switches.
    """

    def __init__(self, repo: DesignRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        category_id: str | None = None,
        search: str | None = None,
        sort_by: str = "name",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Design], int]:
        return await self.repo.list_designs(
            category_id, search, sort_by, offset, limit,
            is_published=None,
        )
