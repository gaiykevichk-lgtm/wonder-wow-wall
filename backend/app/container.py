"""Dependency container — wires use cases to repository implementations.

Provides FastAPI dependency functions for repository injection.
Set USE_MEMORY_REPOS=true to use in-memory (for tests / no-DB dev).
"""

import threading

from fastapi import Depends

from app.config import settings
from app.seed_data import SEED_CATEGORIES, SEED_DESIGNS

from app.infrastructure.persistence.repositories.memory import (
    InMemoryDesignRepository,
    InMemoryCategoryRepository,
    InMemoryReviewRepository,
    InMemoryOrderRepository,
    InMemorySubscriptionRepository,
    InMemoryUserRepository,
    InMemoryMediaAssetRepository,
    InMemoryPanelRepository,
    InMemoryTextureRepository,
    InMemoryTextureColorRepository,
    InMemoryVariantImageRepository,
    InMemoryShopSettingsRepository,
    InMemoryBannerRepository,
    InMemorySubscriptionPlanRepository,
    InMemoryAuditEntryRepository,
    InMemoryRecommendationRepository,
)
from app.infrastructure.persistence.repositories.project_repo import (
    InMemoryProjectRepository,
)
from app.infrastructure.persistence.repositories.visualization_repo import (
    InMemoryVisualizationProjectRepository,
)
from app.infrastructure.persistence.repositories.analytics_repo import (
    InMemoryAnalyticsRepository,
)


# ─── In-Memory Singletons (used when USE_MEMORY_REPOS=true or for tests) ──

_mem_design_repo = InMemoryDesignRepository(SEED_DESIGNS)
# Phase 7A — `count_designs` lambda lets the singleton see live writes
# from `_mem_design_repo` (admin creates/deletes designs in tests),
# mirroring the `users_source` callback on `_mem_order_repo`.
_mem_category_repo = InMemoryCategoryRepository(
    SEED_CATEGORIES,
    designs_source=lambda: _mem_design_repo._designs,
)
_mem_review_repo = InMemoryReviewRepository()
_mem_subscription_repo = InMemorySubscriptionRepository()
_mem_user_repo = InMemoryUserRepository()
# Phase 4A — order repo joins users for admin search-by-email/name. The
# lambda defers user-list resolution so test seeding remains visible to
# the same singleton (analytics uses the same trick).
_mem_order_repo = InMemoryOrderRepository(
    users_source=lambda: _mem_user_repo._users,
)
_mem_project_repo = InMemoryProjectRepository()
_mem_visualization_repo = InMemoryVisualizationProjectRepository()
# Phase 3 — analytics is a READ-ONLY projection over orders + users; it
# shares the underlying lists so test writes become immediately visible.
# Phase 11 — extra sources for the 8 dashboard widgets (subscriptions,
# constructor projects, visualizations, plans). Lambdas defer attribute
# resolution so seeding writes from later test fixtures are observed.
_mem_analytics_repo = InMemoryAnalyticsRepository(
    orders=lambda: _mem_order_repo._orders,
    users=lambda: _mem_user_repo._users,
    subscriptions=lambda: _mem_subscription_repo._subs,
    constructor_projects=lambda: list(_mem_project_repo._projects.values()),
    visualizations=lambda: list(_mem_visualization_repo._projects.values()),
    plans=lambda: _mem_subscription_plan_repo._plans,
)
# Phase 6 — admin file uploads. Singleton so test seeding/cleanup is
# visible to the API across requests, mirroring `_mem_user_repo`.
_mem_media_repo = InMemoryMediaAssetRepository()
# Phase 7B — panel SKU catalog. Same singleton rationale as media: tests
# seed via `_mem_panel_repo._panels.append(...)` and the API sees it.
_mem_panel_repo = InMemoryPanelRepository()
# Phase 12 — texture/color/variant configurator entities.
_mem_texture_repo = InMemoryTextureRepository()
_mem_texture_color_repo = InMemoryTextureColorRepository()
_mem_variant_image_repo = InMemoryVariantImageRepository()
# Phase 8A — singleton shop settings. The aggregate itself is one row;
# the repo wraps it so tests can poke `_mem_shop_settings_repo._settings
# = ShopSettings(...)` between cases without rebuilding the container.
_mem_shop_settings_repo = InMemoryShopSettingsRepository()
# Phase 8B — admin-curated homepage promo rotation. Singleton so admin
# CRUD writes are visible to the public listing across requests in the
# in-memory test rig (mirrors `_mem_panel_repo`).
_mem_banner_repo = InMemoryBannerRepository()
# Phase 8C — admin-editable subscription tariffs. Seeded with the same
# 3 baseline plans the legacy hardcoded `SUBSCRIPTION_PLANS` constant
# carried, so existing `Subscription.plan_id` rows continue to resolve.
def _seed_plans() -> list:
    """Build the 3 baseline plans for the in-memory repo.

    Lazy because importing `SUBSCRIPTION_PLANS` from the entities module
    at container-import time created a circular dep when the entities
    module also imported from `value_objects`. Calling at construction
    time sidesteps the import order issue.
    """
    from app.domain.subscription.entities import (
        SUBSCRIPTION_PLANS as _LEGACY,
        SubscriptionPlan,
    )
    return [
        SubscriptionPlan(
            id=p.id, name=p.name, price=p.price, period=p.period,
            area_limit_m2=p.area_limit_m2, popular=p.popular,
            is_active=True, sort_order=i,
            features=list(p.features),
        )
        for i, p in enumerate(_LEGACY)
    ]


_mem_subscription_plan_repo = InMemorySubscriptionPlanRepository(_seed_plans())
# Phase 9 — append-only admin audit log. Singleton so retrofitted
# admin use cases (BlockUserAdmin etc.) writing through the
# `RecordAuditEntry` collaborator land in the same list the
# `/api/admin/audit` route reads from in tests.
_mem_audit_repo = InMemoryAuditEntryRepository()
# Phase 10 — admin-curated «с этим покупают». Singleton so editor PUT
# requests and the public catalog read see the same list across requests
# in the in-memory test rig (mirrors `_mem_panel_repo`).
_mem_recommendation_repo = InMemoryRecommendationRepository()


# ─── Backward-compatible aliases (used by existing tests) ────────────

design_repo = _mem_design_repo
category_repo = _mem_category_repo
review_repo = _mem_review_repo
order_repo = _mem_order_repo
subscription_repo = _mem_subscription_repo
user_repo = _mem_user_repo
project_repo = _mem_project_repo
visualization_repo = _mem_visualization_repo
analytics_repo = _mem_analytics_repo
media_repo = _mem_media_repo


# ─── FastAPI Dependencies ────────────────────────────────────────────

_sql_repo_classes: dict | None = None


def _get_sql_repo_classes() -> dict:
    """Lazy import to avoid circular deps and DB connection at import time."""
    global _sql_repo_classes
    if _sql_repo_classes is None:
        from app.infrastructure.persistence.repositories.sql import (
            SqlDesignRepository,
            SqlCategoryRepository,
            SqlReviewRepository,
            SqlOrderRepository,
            SqlSubscriptionRepository,
            SqlUserRepository,
            SqlMediaAssetRepository,
            SqlPanelRepository,
            SqlShopSettingsRepository,
            SqlBannerRepository,
            SqlSubscriptionPlanRepository,
            SqlAuditEntryRepository,
            SqlRecommendationRepository,
            SqlTextureRepository,
            SqlTextureColorRepository,
            SqlVariantImageRepository,
        )
        from app.infrastructure.persistence.repositories.project_repo import SqlProjectRepository
        from app.infrastructure.persistence.repositories.visualization_repo import SqlVisualizationProjectRepository
        from app.infrastructure.persistence.repositories.analytics_repo import SqlAnalyticsRepository
        _sql_repo_classes = {
            "design": SqlDesignRepository,
            "category": SqlCategoryRepository,
            "review": SqlReviewRepository,
            "order": SqlOrderRepository,
            "subscription": SqlSubscriptionRepository,
            "user": SqlUserRepository,
            "project": SqlProjectRepository,
            "visualization": SqlVisualizationProjectRepository,
            "analytics": SqlAnalyticsRepository,
            "media": SqlMediaAssetRepository,
            "panel": SqlPanelRepository,
            "shop_settings": SqlShopSettingsRepository,
            "banner": SqlBannerRepository,
            "subscription_plan": SqlSubscriptionPlanRepository,
            "audit": SqlAuditEntryRepository,
            "recommendation": SqlRecommendationRepository,
            "texture": SqlTextureRepository,
            "texture_color": SqlTextureColorRepository,
            "variant_image": SqlVariantImageRepository,
        }
    return _sql_repo_classes


async def get_db_session():
    """Yield a single async DB session per request.

    FastAPI caches Depends() results per request, so all repos
    in the same request share this session — single transaction.
    Returns None when in-memory repos are active (no DB needed).
    """
    from app.infrastructure.persistence.database import async_session
    async with async_session() as session:
        if session is None:
            # In-memory repos mode — no real DB session needed
            yield None
            return
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_design_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_design_repo
    return _get_sql_repo_classes()["design"](session)


def get_category_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_category_repo
    return _get_sql_repo_classes()["category"](session)


def get_review_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_review_repo
    return _get_sql_repo_classes()["review"](session)


def get_order_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_order_repo
    return _get_sql_repo_classes()["order"](session)


def get_subscription_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_subscription_repo
    return _get_sql_repo_classes()["subscription"](session)


def get_user_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_user_repo
    return _get_sql_repo_classes()["user"](session)


def get_project_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_project_repo
    return _get_sql_repo_classes()["project"](session)


def get_visualization_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_visualization_repo
    return _get_sql_repo_classes()["visualization"](session)


def get_analytics_repo(session=Depends(get_db_session)):
    if settings.USE_MEMORY_REPOS:
        return _mem_analytics_repo
    return _get_sql_repo_classes()["analytics"](session)


def get_media_repo(session=Depends(get_db_session)):
    """Phase 6 — admin media uploads.

    Mirrors the other repo dependencies; the in-memory variant is a
    process-singleton so multi-step tests (upload then re-fetch by id)
    see each other's writes.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_media_repo
    return _get_sql_repo_classes()["media"](session)


def get_panel_repo(session=Depends(get_db_session)):
    """Phase 7B — panel SKU catalog.

    Same shape as `get_media_repo`: singleton in-memory repo for tests,
    per-request SQL repo in production. The admin and public catalog
    routes both depend on this — splitting the use cases (Admin vs
    Public) at the application layer keeps the wiring uniform here.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_panel_repo
    return _get_sql_repo_classes()["panel"](session)


def get_texture_repo(session=Depends(get_db_session)):
    """Phase 12 — texture materials for the configurator.

    SQL implementation pending (Phase 12 delivers in-memory first);
    fallback keeps the app functional until SqlTextureRepository lands.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_texture_repo
    classes = _get_sql_repo_classes()
    if "texture" not in classes:
        return _mem_texture_repo
    return classes["texture"](session)


def get_texture_color_repo(session=Depends(get_db_session)):
    """Phase 12 — colour options per texture."""
    if settings.USE_MEMORY_REPOS:
        return _mem_texture_color_repo
    classes = _get_sql_repo_classes()
    if "texture_color" not in classes:
        return _mem_texture_color_repo
    return classes["texture_color"](session)


def get_variant_image_repo(session=Depends(get_db_session)):
    """Phase 12 — product photos for form+texture+color combinations."""
    if settings.USE_MEMORY_REPOS:
        return _mem_variant_image_repo
    classes = _get_sql_repo_classes()
    if "variant_image" not in classes:
        return _mem_variant_image_repo
    return classes["variant_image"](session)


def get_shop_settings_repo(session=Depends(get_db_session)):
    """Phase 8A — singleton shop settings.

    Both `/api/shop/settings` (public) and `/api/admin/shop/settings`
    (admin) depend on this. The split is at the API layer (auth gate);
    the use cases share the same repo dependency.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_shop_settings_repo
    return _get_sql_repo_classes()["shop_settings"](session)


def get_banner_repo(session=Depends(get_db_session)):
    """Phase 8B — homepage promo banners.

    Same shape as `get_panel_repo`: process-singleton in-memory repo so
    admin CRUD and the public listing share state in tests, per-request
    SQL repo in production.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_banner_repo
    return _get_sql_repo_classes()["banner"](session)


def get_subscription_plan_repo(session=Depends(get_db_session)):
    """Phase 8C — admin-editable tariff catalog.

    The in-memory variant is seeded with the legacy 3 plans at container
    import (`_seed_plans()`) so existing `Subscription.plan_id` rows
    resolve without a separate seed step in tests.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_subscription_plan_repo
    return _get_sql_repo_classes()["subscription_plan"](session)


def get_audit_repo(session=Depends(get_db_session)):
    """Phase 9 — append-only admin audit log.

    Used by `/api/admin/audit` for reads, and injected as a
    `RecordAuditEntry` collaborator into every retrofitted admin use
    case (BlockUserAdmin etc.) for writes. In production both share
    the same SQL session — keeping audit writes inside the same
    transaction as the action they describe means a rolled-back
    action also rolls back its audit row (no orphan entries).
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_audit_repo
    return _get_sql_repo_classes()["audit"](session)


def get_recommendation_repo(session=Depends(get_db_session)):
    """Phase 10 — admin-curated «с этим покупают» rail.

    Same shape as `get_panel_repo`: process-singleton in-memory repo
    so the admin editor and public catalog read from the same store
    in tests, per-request SQL repo in production. The cascade-cleanup
    use case (`CleanupRecommendationsOnDelete`, wired into
    `DeletePanelAdmin`) injects this dependency too — the in-memory
    singleton means a delete that prunes recommendation rows is
    visible to the next admin list call without any cross-fixture
    plumbing.
    """
    if settings.USE_MEMORY_REPOS:
        return _mem_recommendation_repo
    return _get_sql_repo_classes()["recommendation"](session)


# ─── Phase 6 (admin panel) — file storage singleton ──────────────────

_file_storage = None  # type: ignore[var-annotated]
_file_storage_lock = threading.Lock()


def get_file_storage():
    """Return the process-wide `FileStorage` instance.

    Singleton because:
      * Both `LocalFileStorage` and `S3FileStorage` hold no per-request state.
      * Tests can monkeypatch this function via FastAPI's
        `app.dependency_overrides[get_file_storage] = ...` to swap in a
        tempdir-backed adapter without touching the production singleton.

    Same lazy-init + double-checked-lock pattern as `get_depth_estimator`
    above — keeps boot fast and avoids importing storage adapters if
    no admin endpoint is ever hit (tests for unrelated areas).
    """
    global _file_storage
    if _file_storage is not None:
        return _file_storage
    with _file_storage_lock:
        if _file_storage is not None:
            return _file_storage
        if settings.USE_S3:
            from app.infrastructure.storage.s3 import S3FileStorage
            _file_storage = S3FileStorage(
                bucket_name=settings.S3_BUCKET,
                endpoint_url=settings.S3_ENDPOINT,
                access_key=settings.S3_ACCESS_KEY,
                secret_key=settings.S3_SECRET_KEY,
                url_prefix=settings.MEDIA_URL_PREFIX,
                signed_url_expire_seconds=settings.S3_SIGNED_URL_TTL,
                region_name=settings.S3_REGION,
            )
        else:
            from app.infrastructure.storage.local import LocalFileStorage
            _file_storage = LocalFileStorage(
                root=settings.MEDIA_STORAGE_ROOT,
                url_prefix=settings.MEDIA_URL_PREFIX,
            )
    return _file_storage


def reset_file_storage_singleton() -> None:
    """Test helper — drops the cached storage so the next `get_file_storage`
    call re-reads the (possibly monkeypatched) settings.

    Lives next to the singleton it operates on so future readers don't
    have to grep across files to find the reset hook.
    """
    global _file_storage
    with _file_storage_lock:
        _file_storage = None


# ─── Phase 6 — Depth Estimator (singleton across the process) ──────────

_depth_estimator = None  # type: ignore[var-annotated]
# Guards the singleton against concurrent first-call initialisation. Uvicorn
# runs one event loop per worker so in practice requests are serialised at
# this point, but gunicorn with `--preload` or multi-threaded test runners
# can race; a threading.Lock is the cheapest way to close that window and
# works equally well from sync and async call sites.
_depth_estimator_lock = threading.Lock()


def get_depth_estimator():
    """Return a singleton `DepthEstimator` per process.

    Selection by `settings.DEPTH_PROVIDER`:
      * `stub`  → `StubDepthEstimator` (default; no ML deps, no checkpoint).
      * `local` → `LocalMiDaSDepthEstimator` (CPU ONNX). Requires onnxruntime,
                  numpy, pillow at runtime; loads the model lazily.

    Singleton because:
      * The stub holds no resources.
      * The local adapter caches a 150–200 MB ONNX session that we want to
        amortise across requests.

    Future providers (`replicate`, `modal`) plug in here without touching
    the use case or API layer.
    """
    global _depth_estimator
    if _depth_estimator is not None:
        return _depth_estimator
    with _depth_estimator_lock:
        # Re-check under the lock — another thread may have built it while
        # we were waiting.
        if _depth_estimator is not None:
            return _depth_estimator
        provider = settings.DEPTH_PROVIDER.lower()
        if provider == "stub":
            from app.infrastructure.ml.depth_estimators import StubDepthEstimator
            _depth_estimator = StubDepthEstimator()
        elif provider == "local":
            from app.infrastructure.ml.depth_estimators import LocalMiDaSDepthEstimator
            _depth_estimator = LocalMiDaSDepthEstimator(
                model_path=settings.DEPTH_MODEL_PATH,
                input_size=settings.DEPTH_INPUT_SIZE,
            )
        else:
            raise RuntimeError(
                f"Unknown DEPTH_PROVIDER={settings.DEPTH_PROVIDER!r}; "
                f"expected one of: stub, local"
            )
    return _depth_estimator
