"""In-memory repository implementations for development and testing.

These will be replaced by SQLAlchemy implementations when connected to PostgreSQL.
"""

from datetime import datetime
from typing import Callable
from uuid import uuid4

from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.panel import Panel
from app.domain.catalog.recommendation import (
    Recommendation,
    RecommendationSourceType,
    RecommendationTargetType,
)
from app.domain.catalog.repositories import (
    DesignRepository, CategoryRepository, ReviewRepository, PanelRepository,
    RecommendationFilters, RecommendationRepository,
)
from app.domain.order.entities import Order, OrderNote
from app.domain.order.filters import OrderFilters
from app.domain.order.repositories import OrderRepository
from app.domain.subscription.entities import Subscription
from app.domain.subscription.repositories import SubscriptionRepository
from app.domain.user.entities import User
from app.domain.user.filters import UserFilters
from app.domain.user.repositories import UserRepository
from app.domain.user.value_objects import UserRole
from app.domain.media.entities import MediaAsset
from app.domain.media.repositories import MediaAssetRepository
from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.repositories import (
    BannerRepository,
    ShopSettingsRepository,
)
from app.domain.shop.settings import ShopSettings
from app.domain.subscription.entities import SubscriptionPlan
from app.domain.subscription.repositories import SubscriptionPlanRepository
from app.domain.audit.entities import AuditEntry
from app.domain.audit.filters import AuditFilters
from app.domain.audit.repositories import AuditEntryRepository


# ─── Catalog ─────────────────────────────────────────────────────────

class InMemoryDesignRepository(DesignRepository):
    def __init__(self, designs: list[Design] | None = None):
        self._designs: list[Design] = designs or []

    async def list_designs(
        self, category_id=None, search=None, sort_by="name", offset=0, limit=20,
        *, color=None, style=None, is_new=None, is_published=True,
    ):
        result = list(self._designs)
        # Phase 7A — public catalog passes `is_published=True`; admin
        # passes `None` to see everything. Filter is applied first so
        # subsequent count/sort work on the visible-set, mirroring the
        # SQL repo's `WHERE is_published = ?` clause.
        if is_published is not None:
            result = [d for d in result if d.is_published == is_published]
        if category_id:
            result = [d for d in result if d.category_id == category_id]
        if search:
            q = search.lower()
            result = [d for d in result if q in d.name.lower() or q in d.description.lower()]
        if color:
            color_lower = color.lower()
            result = [d for d in result if any(c.name.lower() == color_lower for c in d.colors)]
        if style:
            style_lower = style.lower()
            result = [d for d in result if d.style.lower() == style_lower]
        if is_new is not None:
            result = [d for d in result if d.is_new == is_new]
        if sort_by == "price":
            result.sort(key=lambda d: d.price)
        elif sort_by == "rating":
            result.sort(key=lambda d: d.rating, reverse=True)
        else:
            result.sort(key=lambda d: d.name)
        total = len(result)
        return result[offset:offset + limit], total

    async def get_by_id(self, design_id):
        return next((d for d in self._designs if d.id == design_id), None)

    async def get_by_slug(self, slug):
        return next((d for d in self._designs if d.slug == slug), None)

    async def update(self, design):
        self._designs = [d if d.id != design.id else design for d in self._designs]
        return design

    async def create(self, design):
        # Defence-in-depth — match the SQL `UNIQUE(slug)` so a test
        # passing in-memory cannot surprise postgres. Same pattern as
        # `InMemoryPanelRepository.create` (Phase 7B).
        if any(d.slug == design.slug for d in self._designs):
            raise ValueError(f"Design.slug collision: {design.slug}")
        self._designs.append(design)
        return design

    async def delete(self, design_id):
        before = len(self._designs)
        self._designs = [d for d in self._designs if d.id != design_id]
        return len(self._designs) != before


class InMemoryCategoryRepository(CategoryRepository):
    def __init__(
        self,
        categories: list[Category] | None = None,
        # Optional callback returning the live design list for
        # `count_designs` — mirrors the `users_source` trick on
        # `InMemoryOrderRepository`. Allows the singleton container
        # to wire counts without coupling the repo to another repo.
        designs_source: Callable[[], list[Design]] | None = None,
    ):
        self._categories: list[Category] = categories or []
        self._designs_source = designs_source

    async def list_all(self):
        return list(self._categories)

    async def get_by_id(self, category_id):
        return next((c for c in self._categories if c.id == category_id), None)

    async def get_by_slug(self, slug):
        return next((c for c in self._categories if c.slug == slug), None)

    async def create(self, category):
        if any(c.slug == category.slug for c in self._categories):
            raise ValueError(f"Category.slug collision: {category.slug}")
        self._categories.append(category)
        return category

    async def update(self, category):
        for i, c in enumerate(self._categories):
            if c.id == category.id:
                if any(
                    other.slug == category.slug and other.id != category.id
                    for other in self._categories
                ):
                    raise ValueError(f"Category.slug collision: {category.slug}")
                self._categories[i] = category
                return category
        raise LookupError(f"Category {category.id} not found")

    async def delete(self, category_id):
        before = len(self._categories)
        self._categories = [c for c in self._categories if c.id != category_id]
        return len(self._categories) != before

    async def count_designs(self, category_id):
        # If a designs_source was wired in, use the live list. Otherwise
        # fall back to 0 — tests that don't care about cascade-guard
        # behaviour shouldn't be forced to seed designs.
        if self._designs_source is None:
            return 0
        return sum(1 for d in self._designs_source() if d.category_id == category_id)


class InMemoryReviewRepository(ReviewRepository):
    def __init__(self):
        self._reviews: list[DesignReview] = []

    async def list_by_design(self, design_id, offset=0, limit=20):
        result = [r for r in self._reviews if r.design_id == design_id]
        result.sort(key=lambda r: r.created_at, reverse=True)
        return result[offset:offset + limit]

    async def add(self, review):
        self._reviews.append(review)
        return review


# ─── Order ───────────────────────────────────────────────────────────

class InMemoryOrderRepository(OrderRepository):
    def __init__(self, users_source: Callable[[], list[User]] | None = None):
        self._orders: list[Order] = []
        self._counter = 0
        # Optional callback returning the live user list. Used ONLY by
        # `find_paginated` when the admin searches by email/name — the
        # SQL repo achieves the same via a JOIN. Keeping it optional means
        # existing constructions (`InMemoryOrderRepository()`) keep working
        # and customer-facing methods stay free of user-repo coupling.
        self._users_source = users_source

    async def create(self, order):
        self._orders.append(order)
        return order

    async def get_by_id(self, order_id):
        return next((o for o in self._orders if o.id == order_id), None)

    async def list_by_user(self, user_id, offset=0, limit=20):
        result = [o for o in self._orders if o.user_id == user_id]
        result.sort(key=lambda o: o.created_at, reverse=True)
        return result[offset:offset + limit]

    async def update(self, order):
        self._orders = [o if o.id != order.id else order for o in self._orders]
        return order

    async def add_note(self, order_id: str, note: OrderNote) -> OrderNote:
        # In-memory variant: locate the parent and append to its `notes`
        # list. SQL repo persists into a separate table; semantics are
        # equivalent — the next `get_by_id` returns the order with the
        # new note attached.
        parent = next((o for o in self._orders if o.id == order_id), None)
        if parent is None:
            raise ValueError(f"Order {order_id} not found")
        # `Order.add_note` already populated the parent's notes list when
        # the use case called it; the SQL repo needs an explicit insert.
        # Avoid duplicating the entry if it's already there.
        if not any(n.id == note.id for n in parent.notes):
            parent.notes.append(note)
        return note

    async def generate_order_number(self):
        self._counter += 1
        return f"WW-{datetime.utcnow().year}-{self._counter:03d}"

    async def find_paginated(self, filters: OrderFilters, page: int = 1, size: int = 50):
        result = list(self._orders)
        if filters.status is not None:
            result = [o for o in result if o.status == filters.status]
        if filters.user_id is not None:
            result = [o for o in result if o.user_id == filters.user_id]
        if filters.date_from is not None:
            result = [o for o in result if o.created_at >= filters.date_from]
        if filters.date_to is not None:
            result = [o for o in result if o.created_at < filters.date_to]
        if filters.search is not None:
            q = filters.search.lower()
            matching_user_ids: set[str] = set()
            if self._users_source is not None:
                for u in self._users_source():
                    if q in u.email.lower() or q in u.name.lower():
                        matching_user_ids.add(u.id)
            result = [
                o for o in result
                if q in o.number.lower() or o.user_id in matching_user_ids
            ]
        # Stable newest-first ordering — the SQL repo uses the same
        # `ORDER BY created_at DESC`. Equality of `created_at` falls back
        # to insertion order via Python's stable sort, which is fine for
        # tests since fakes typically use distinct timestamps.
        result.sort(key=lambda o: o.created_at, reverse=True)
        total = len(result)
        offset = (page - 1) * size
        return result[offset:offset + size], total


# ─── Subscription ────────────────────────────────────────────────────

class InMemorySubscriptionRepository(SubscriptionRepository):
    def __init__(self):
        self._subs: list[Subscription] = []

    async def get_active_by_user(self, user_id):
        return next(
            (s for s in self._subs if s.user_id == user_id and s.status.value == "active"),
            None,
        )

    async def create(self, subscription):
        self._subs.append(subscription)
        return subscription

    async def update(self, subscription):
        self._subs = [s if s.id != subscription.id else subscription for s in self._subs]
        return subscription

    async def count_active_by_plan(self, plan_id: str) -> int:
        # Phase 8C — `DeleteSubscriptionPlanAdmin` cascade-guard.
        # Mirrors the SQL `SELECT COUNT(*) WHERE plan_id = ? AND status = 'active'`.
        return sum(
            1 for s in self._subs
            if s.plan_id == plan_id and s.status.value == "active"
        )


# ─── User ────────────────────────────────────────────────────────────

class InMemoryUserRepository(UserRepository):
    def __init__(self):
        self._users: list[User] = []

    async def create(self, user):
        self._users.append(user)
        return user

    async def get_by_id(self, user_id):
        return next((u for u in self._users if u.id == user_id), None)

    async def get_by_email(self, email):
        return next((u for u in self._users if u.email == email), None)

    async def update(self, user):
        self._users = [u if u.id != user.id else user for u in self._users]
        return user

    async def count_admins(self):
        return sum(1 for u in self._users if u.role == UserRole.ADMIN)

    # ─── Phase 5 — admin user list ───────────────────────────────────

    async def count_active_admins(self):
        # `is_blocked` defaults to False on legacy seeded users so the
        # count stays accurate even before the migration runs in tests.
        return sum(
            1 for u in self._users
            if u.role == UserRole.ADMIN and not u.is_blocked
        )

    async def find_paginated(self, filters: UserFilters, page: int = 1, size: int = 50):
        result = list(self._users)
        if filters.role is not None:
            result = [u for u in result if u.role == filters.role]
        if filters.is_blocked is not None:
            result = [u for u in result if u.is_blocked == filters.is_blocked]
        if filters.search is not None:
            q = filters.search.lower()
            result = [
                u for u in result
                if q in u.email.lower()
                or q in u.name.lower()
                or q in (u.phone or "").lower()
            ]
        # Newest-first — matches orders. Stable sort preserves insertion
        # order for ties (test fixtures usually use distinct timestamps).
        result.sort(key=lambda u: u.created_at, reverse=True)
        total = len(result)
        offset = (page - 1) * size
        return result[offset:offset + size], total


# ─── Media (Phase 6) ─────────────────────────────────────────────────

class InMemoryMediaAssetRepository(MediaAssetRepository):
    """List-backed mirror of `SqlMediaAssetRepository`.

    Used by the test suite (`USE_MEMORY_REPOS=true`) so admin-media
    endpoint tests can run without a postgres instance. Mutations operate
    on the same singleton as the API (see `container.py`); tests reset
    `_assets` per-test to avoid cross-pollution — same pattern as
    `_mem_user_repo._users.clear()`.
    """

    def __init__(self):
        self._assets: list[MediaAsset] = []

    async def create(self, asset: MediaAsset) -> MediaAsset:
        # Defend the UNIQUE(path) constraint that the SQL repo enforces
        # at the DB level — keeps the two implementations behaviourally
        # equivalent so a test that passes in-memory doesn't surprise
        # the postgres deployment.
        if any(a.path == asset.path for a in self._assets):
            raise ValueError(f"MediaAsset.path collision: {asset.path}")
        self._assets.append(asset)
        return asset

    async def get_by_id(self, asset_id: str) -> MediaAsset | None:
        return next((a for a in self._assets if a.id == asset_id), None)

    async def delete(self, asset_id: str) -> bool:
        before = len(self._assets)
        self._assets = [a for a in self._assets if a.id != asset_id]
        return len(self._assets) != before


# ─── Panels (Phase 7B) ──────────────────────────────────────────────

class InMemoryPanelRepository(PanelRepository):
    """List-backed mirror of `SqlPanelRepository`.

    Defends the SQL UNIQUE(slug) constraint with an explicit collision
    check in `create`/`update` so a test passing in-memory does not
    surprise the postgres deployment. Same defence-in-depth pattern as
    `InMemoryMediaAssetRepository.create` (Phase 6).
    """

    def __init__(self, panels: list[Panel] | None = None):
        self._panels: list[Panel] = panels or []

    async def list_panels(
        self,
        *,
        include_inactive: bool = False,
        is_active: bool | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Panel], int]:
        rows = self._panels if include_inactive else [
            p for p in self._panels if p.is_active
        ]
        # Phase 7B remediation 2 (FE-B) — explicit `is_active=True/False`
        # narrows further on top of `include_inactive`. Mutually consistent:
        # the admin's «Inactive only» tab passes `include_inactive=True`
        # (use case keeps that hard-coded) AND `is_active=False`.
        if is_active is not None:
            rows = [p for p in rows if p.is_active == is_active]
        if search:
            needle = search.lower()
            rows = [
                p for p in rows
                if needle in p.name.lower() or needle in p.slug.lower()
            ]
        # Newest-first matches the admin table default sort. Stable sort
        # preserves insertion order for ties.
        ordered = sorted(rows, key=lambda p: p.created_at, reverse=True)
        total = len(ordered)
        return ordered[offset:offset + limit], total

    async def get_by_id(self, panel_id: str) -> Panel | None:
        return next((p for p in self._panels if p.id == panel_id), None)

    async def get_by_slug(self, slug: str) -> Panel | None:
        return next((p for p in self._panels if p.slug == slug), None)

    async def create(self, panel: Panel) -> Panel:
        if any(p.slug == panel.slug for p in self._panels):
            raise ValueError(f"Panel.slug collision: {panel.slug}")
        self._panels.append(panel)
        return panel

    async def update(self, panel: Panel) -> Panel:
        # Replace by id; raise if not present so callers can rely on the
        # postcondition "the row I asked to update is now stored".
        for i, p in enumerate(self._panels):
            if p.id == panel.id:
                # Defend slug-uniqueness across other rows; the use case
                # already pre-checks but the repo enforces invariantly.
                if any(
                    other.slug == panel.slug and other.id != panel.id
                    for other in self._panels
                ):
                    raise ValueError(f"Panel.slug collision: {panel.slug}")
                self._panels[i] = panel
                return panel
        raise LookupError(f"Panel {panel.id} not found")

    async def delete(self, panel_id: str) -> bool:
        before = len(self._panels)
        self._panels = [p for p in self._panels if p.id != panel_id]
        return len(self._panels) != before


# ─── Shop settings (Phase 8A) ───────────────────────────────────────

class InMemoryShopSettingsRepository(ShopSettingsRepository):
    """Singleton-row mirror of `SqlShopSettingsRepository`.

    Holds exactly one `ShopSettings` instance; default-constructed if
    not seeded explicitly. Test fixtures can mutate the row in-place
    via the public `_settings` attribute (mirroring the other repos
    where tests poke `_panels.append(...)` etc.).
    """

    def __init__(self, settings: ShopSettings | None = None):
        self._settings: ShopSettings = settings or ShopSettings()

    async def get(self) -> ShopSettings:
        return self._settings

    async def update(self, settings: ShopSettings) -> ShopSettings:
        # Replace in place so other holders of the singleton see the new
        # values (the SQL counterpart has no such issue — Postgres is
        # the single source of truth).
        self._settings = settings
        return self._settings


# ─── Banners (Phase 8B) ─────────────────────────────────────────────


class InMemoryBannerRepository(BannerRepository):
    """List-backed mirror of `SqlBannerRepository`.

    Uses a singleton `_banners` list (mutated in place) so test fixtures
    can poke `_mem_banner_repo._banners.append(...)` and the API sees
    the new row — same pattern as `_mem_panel_repo`.
    """

    def __init__(self, banners: list[Banner] | None = None):
        self._banners: list[Banner] = banners or []

    async def list_banners(
        self,
        *,
        position: BannerPosition | None = None,
        active_only: bool = False,
    ) -> list[Banner]:
        rows = list(self._banners)
        if position is not None:
            rows = [b for b in rows if b.position == position]
        if active_only:
            rows = [b for b in rows if b.is_active]
        # Stable sort: priority asc, then created_at asc (insertion order
        # for ties). Matches the SQL `ORDER BY priority, created_at`.
        rows.sort(key=lambda b: (b.priority, b.created_at))
        return rows

    async def get_by_id(self, banner_id: str) -> Banner | None:
        return next((b for b in self._banners if b.id == banner_id), None)

    async def create(self, banner: Banner) -> Banner:
        self._banners.append(banner)
        return banner

    async def update(self, banner: Banner) -> Banner:
        for i, b in enumerate(self._banners):
            if b.id == banner.id:
                self._banners[i] = banner
                return banner
        raise LookupError(f"Banner {banner.id} not found")

    async def delete(self, banner_id: str) -> bool:
        before = len(self._banners)
        self._banners = [b for b in self._banners if b.id != banner_id]
        return len(self._banners) != before


# ─── Subscription plans (Phase 8C) ──────────────────────────────────


class InMemorySubscriptionPlanRepository(SubscriptionPlanRepository):
    """List-backed mirror of `SqlSubscriptionPlanRepository`.

    Defends the SQL `PRIMARY KEY (id)` with an explicit collision check
    in `create` so test seeding cannot surprise postgres. Same posture
    as `InMemoryPanelRepository.create` (Phase 7B).
    """

    def __init__(self, plans: list[SubscriptionPlan] | None = None):
        self._plans: list[SubscriptionPlan] = plans or []

    async def list_plans(
        self, *, active_only: bool = False,
    ) -> list[SubscriptionPlan]:
        rows = list(self._plans)
        if active_only:
            rows = [p for p in rows if p.is_active]
        rows.sort(key=lambda p: p.sort_order)
        return rows

    async def get_by_id(self, plan_id: str) -> SubscriptionPlan | None:
        return next((p for p in self._plans if p.id == plan_id), None)

    async def create(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        if any(p.id == plan.id for p in self._plans):
            raise ValueError(f"SubscriptionPlan id collision: {plan.id}")
        self._plans.append(plan)
        return plan

    async def update(self, plan: SubscriptionPlan) -> SubscriptionPlan:
        for i, p in enumerate(self._plans):
            if p.id == plan.id:
                self._plans[i] = plan
                return plan
        raise LookupError(f"SubscriptionPlan {plan.id} not found")

    async def delete(self, plan_id: str) -> bool:
        before = len(self._plans)
        self._plans = [p for p in self._plans if p.id != plan_id]
        return len(self._plans) != before


# ─── Audit log (Phase 9) ────────────────────────────────────────────

class InMemoryAuditEntryRepository(AuditEntryRepository):
    """List-backed mirror of `SqlAuditEntryRepository`.

    `_entries` is the seed/inspection backdoor mirrored across the
    other in-memory repos in this file. The filter implementation
    mirrors the SQL one literally so a regression in either is caught
    by the shared use-case tests.
    """

    def __init__(self, entries: list[AuditEntry] | None = None):
        self._entries: list[AuditEntry] = entries or []

    async def append(self, entry: AuditEntry) -> AuditEntry:
        self._entries.append(entry)
        return entry

    async def find_paginated(
        self,
        filters: AuditFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[AuditEntry], int]:
        rows = list(self._entries)
        if filters.action is not None:
            rows = [r for r in rows if r.action == filters.action]
        if filters.actor_id is not None:
            rows = [r for r in rows if r.actor_id == filters.actor_id]
        if filters.target_type is not None:
            rows = [r for r in rows if r.target_type == filters.target_type]
        if filters.target_id is not None:
            rows = [r for r in rows if r.target_id == filters.target_id]
        if filters.date_from is not None:
            rows = [r for r in rows if r.created_at >= filters.date_from]
        if filters.date_to is not None:
            rows = [r for r in rows if r.created_at <= filters.date_to]
        # `created_at desc` matches the SQL composite-index sort.
        rows.sort(key=lambda r: r.created_at, reverse=True)
        total = len(rows)
        return rows[offset:offset + limit], total


# ─── Recommendations (Phase 10) ─────────────────────────────────────


class InMemoryRecommendationRepository(RecommendationRepository):
    """List-backed mirror of `SqlRecommendationRepository`.

    Holds full `Recommendation` aggregates (parent + targets) in a
    single list so filter/find calls don't have to reassemble across
    structures the way the SQL layer does. Mutations replace the entry
    by id (the natural-key uniqueness check happens before the swap).

    Defends the SQL UNIQUE(source_type, source_id) constraint with an
    explicit collision check in `save` so a test passing in-memory
    cannot surprise the postgres deployment — same defence-in-depth
    pattern as `InMemoryPanelRepository.create`.
    """

    def __init__(self, recommendations: list[Recommendation] | None = None):
        self._recs: list[Recommendation] = recommendations or []

    async def find_by_source(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> Recommendation | None:
        return next(
            (
                r for r in self._recs
                if r.source_type == source_type and r.source_id == source_id
            ),
            None,
        )

    async def save(self, recommendation: Recommendation) -> Recommendation:
        # Upsert by (source_type, source_id). The aggregate carries its
        # own uuid which we keep stable across saves so any external
        # holder of the id (e.g., audit log) keeps resolving.
        for i, r in enumerate(self._recs):
            if (
                r.source_type == recommendation.source_type
                and r.source_id == recommendation.source_id
            ):
                # Same row — replace in place. Defend the natural-key
                # uniqueness against any *other* row having sneaked in
                # under the same key (shouldn't happen but cheap).
                if any(
                    other is not r
                    and other.source_type == recommendation.source_type
                    and other.source_id == recommendation.source_id
                    for other in self._recs
                ):
                    raise ValueError(
                        "Recommendation source uniqueness violated"
                    )
                self._recs[i] = recommendation
                return recommendation
        # Fresh insert — pre-check natural-key uniqueness across all
        # existing rows.
        if any(
            r.source_type == recommendation.source_type
            and r.source_id == recommendation.source_id
            for r in self._recs
        ):
            raise ValueError("Recommendation source uniqueness violated")
        self._recs.append(recommendation)
        return recommendation

    async def delete(
        self,
        source_type: RecommendationSourceType,
        source_id: str,
    ) -> bool:
        before = len(self._recs)
        self._recs = [
            r for r in self._recs
            if not (r.source_type == source_type and r.source_id == source_id)
        ]
        return len(self._recs) != before

    async def list_paginated(
        self,
        filters: RecommendationFilters,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Recommendation], int]:
        rows = list(self._recs)
        if filters.source_type is not None:
            rows = [r for r in rows if r.source_type == filters.source_type]
        if filters.has_manual is not None:
            if filters.has_manual:
                rows = [r for r in rows if len(r.targets) > 0]
            else:
                rows = [r for r in rows if len(r.targets) == 0]
        if filters.search:
            # Phase 10 LOW-6 + REC-N1 — substring match on `source_id`
            # OR on any `target_id` of the aggregate. Mirrors the SQL
            # `OR EXISTS (...)` predicate so the in-memory and Postgres
            # paths agree on filtered totals.
            needle = filters.search.lower()
            rows = [
                r for r in rows
                if needle in r.source_id.lower()
                or any(needle in t.target_id.lower() for t in r.targets)
            ]
        # Newest-first matches the SQL repo's ORDER BY updated_at DESC —
        # keeps the admin table consistent across implementations.
        rows.sort(key=lambda r: r.updated_at, reverse=True)
        total = len(rows)
        return rows[offset:offset + limit], total

    async def find_by_target(
        self,
        target_type: RecommendationTargetType,
        target_id: str,
    ) -> list[Recommendation]:
        # Cascade-cleanup hook — return every aggregate that lists this
        # (target_type, target_id) among its targets. Returning a list
        # (not an iterator) so the caller can see len() upfront for
        # report-building.
        return [
            r for r in self._recs
            if any(
                t.target_type == target_type and t.target_id == target_id
                for t in r.targets
            )
        ]
