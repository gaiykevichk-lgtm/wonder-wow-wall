from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

from app.config import settings
from app.domain.order.exceptions import InvalidOrderTransitionError
from app.domain.user.exceptions import (
    LastAdminRemovalError,
    NotAuthorizedError,
    UserBlockedError,
)
from app.domain.visualizer.exceptions import (
    CollinearCornersError,
    DepthEstimationError,
    PlaneFittingError,
    StaleSceneVersionError,
)
from app.domain.media.exceptions import (
    MediaCorruptError,
    MediaInvalidDimensionsError,
    MediaInvalidMimeError,
    MediaTooLargeError,
)
from app.domain.catalog.catalog_exceptions import (
    CategoryInUseError,
    CategoryNotFoundError,
    CategorySlugConflictError,
    DesignNotFoundError,
    DesignSlugConflictError,
)
from app.domain.catalog.panel_exceptions import (
    PanelNotFoundError,
    PanelSlugConflictError,
)
from app.domain.catalog.texture_exceptions import (
    TextureNotFoundError,
    TextureSlugConflictError,
    TextureColorNotFoundError,
    TextureHasVariantsError,
    VariantImageNotFoundError,
    VariantImageCombinationConflictError,
)
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.domain.subscription.plan_exceptions import (
    SubscriptionPlanIdConflictError,
    SubscriptionPlanInUseError,
    SubscriptionPlanNotFoundError,
)
from app.domain.catalog.recommendation import (
    DuplicateRecommendationTargetError,
    RecommendationLimitExceededError,
    RecommendationNotFoundError,
    RecommendationTargetNotFoundError,
    SelfRecommendationError,
)
from app.infrastructure.api import auth, catalog, orders, shop, subscriptions, projects, contacts, visualizer
from app.infrastructure.api import admin as admin_api
from app.infrastructure.api.error_handlers import (
    banner_not_found_handler,
    category_in_use_handler,
    category_not_found_handler,
    category_slug_conflict_handler,
    collinear_corners_handler,
    depth_estimation_handler,
    design_not_found_handler,
    design_slug_conflict_handler,
    duplicate_recommendation_target_handler,
    invalid_order_transition_handler,
    last_admin_removal_handler,
    media_corrupt_handler,
    media_invalid_dimensions_handler,
    media_invalid_mime_handler,
    media_too_large_handler,
    not_authorized_handler,
    panel_not_found_handler,
    panel_slug_conflict_handler,
    plane_fitting_handler,
    recommendation_limit_exceeded_handler,
    recommendation_not_found_handler,
    recommendation_target_not_found_handler,
    self_recommendation_handler,
    stale_scene_version_handler,
    subscription_plan_id_conflict_handler,
    subscription_plan_in_use_handler,
    subscription_plan_not_found_handler,
    texture_not_found_handler,
    texture_slug_conflict_handler,
    texture_color_not_found_handler,
    texture_has_variants_handler,
    variant_image_not_found_handler,
    variant_image_combination_conflict_handler,
    user_blocked_handler,
)
from app.infrastructure.security.middleware import SecurityHeadersMiddleware
from app.infrastructure.security.rate_limit import limiter

app = FastAPI(
    title="Wonder Wow Wall API",
    description="REST API для B2C магазина модульных стеновых панелей",
    version="0.1.0",
)

# ─── Rate Limiting ──────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Domain → HTTP exception handlers (Phase 5C) ────────────────────
# Visualizer bounded context — see infrastructure/api/error_handlers.py.
app.add_exception_handler(CollinearCornersError, collinear_corners_handler)
app.add_exception_handler(StaleSceneVersionError, stale_scene_version_handler)
# Phase 6 — depth-based auto-perspective failure modes. Both map to codes
# that the frontend's fallback chain branches on to decide between "silently
# retry/fallback" and "surface a banner".
app.add_exception_handler(DepthEstimationError, depth_estimation_handler)
app.add_exception_handler(PlaneFittingError, plane_fitting_handler)
# Phase 1 — admin-panel user/role errors. Register even though Phase 1
# itself has no endpoint raising them: Phase 5 user management WILL, and
# registering here keeps `main.py` stable across follow-up phases.
app.add_exception_handler(LastAdminRemovalError, last_admin_removal_handler)
app.add_exception_handler(NotAuthorizedError, not_authorized_handler)
# Phase 5 — blocked account login refusal. Plain `Login` ValueError stays
# 422 (wrong creds), only this maps to 403 + USER_BLOCKED.
app.add_exception_handler(UserBlockedError, user_blocked_handler)
# Phase 4B — admin order status transitions. Subclasses (e.g.
# OrderAlreadyCancelledError) match the same handler so they all map to 409.
app.add_exception_handler(InvalidOrderTransitionError, invalid_order_transition_handler)
# Phase 6 (admin) — file upload validation failures. Each maps to a
# distinct status code so the frontend can render precise messaging
# without parsing the localized `detail` (see error_handlers.py).
app.add_exception_handler(MediaTooLargeError, media_too_large_handler)
app.add_exception_handler(MediaInvalidMimeError, media_invalid_mime_handler)
app.add_exception_handler(MediaInvalidDimensionsError, media_invalid_dimensions_handler)
app.add_exception_handler(MediaCorruptError, media_corrupt_handler)
# Phase 7B — admin panel CRUD: 404 on unknown id, 409 on slug conflict.
app.add_exception_handler(PanelNotFoundError, panel_not_found_handler)
app.add_exception_handler(PanelSlugConflictError, panel_slug_conflict_handler)
# Phase 7A — admin catalog CRUD: 404 on unknown id, 409 on slug conflict
# or category-in-use guard refusal.
app.add_exception_handler(DesignNotFoundError, design_not_found_handler)
app.add_exception_handler(DesignSlugConflictError, design_slug_conflict_handler)
app.add_exception_handler(CategoryNotFoundError, category_not_found_handler)
app.add_exception_handler(CategorySlugConflictError, category_slug_conflict_handler)
app.add_exception_handler(CategoryInUseError, category_in_use_handler)
# Phase 8B — admin banner CRUD: 404 on unknown id.
app.add_exception_handler(BannerNotFoundError, banner_not_found_handler)
# Phase 8C — admin subscription plan CRUD: 404 on unknown id, 409 on
# id conflict / in-use guard.
app.add_exception_handler(
    SubscriptionPlanNotFoundError, subscription_plan_not_found_handler,
)
app.add_exception_handler(
    SubscriptionPlanIdConflictError, subscription_plan_id_conflict_handler,
)
app.add_exception_handler(
    SubscriptionPlanInUseError, subscription_plan_in_use_handler,
)
# Phase 10 — admin recommendations: split between 422 (semantic invariants
# the editor surfaces inline) and 404 (missing rows the admin can refresh).
app.add_exception_handler(SelfRecommendationError, self_recommendation_handler)
app.add_exception_handler(
    DuplicateRecommendationTargetError, duplicate_recommendation_target_handler,
)
app.add_exception_handler(
    RecommendationLimitExceededError, recommendation_limit_exceeded_handler,
)
app.add_exception_handler(
    RecommendationTargetNotFoundError, recommendation_target_not_found_handler,
)
app.add_exception_handler(
    RecommendationNotFoundError, recommendation_not_found_handler,
)
# Phase 2 — configurator texture/variant-image CRUD.
app.add_exception_handler(TextureNotFoundError, texture_not_found_handler)
app.add_exception_handler(TextureSlugConflictError, texture_slug_conflict_handler)
app.add_exception_handler(TextureColorNotFoundError, texture_color_not_found_handler)
app.add_exception_handler(TextureHasVariantsError, texture_has_variants_handler)
app.add_exception_handler(VariantImageNotFoundError, variant_image_not_found_handler)
app.add_exception_handler(
    VariantImageCombinationConflictError,
    variant_image_combination_conflict_handler,
)

# ─── Security Headers ──────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ─── CORS ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# ─── Routers ────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(catalog.router, prefix="/api", tags=["catalog"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(contacts.router, prefix="/api", tags=["contacts"])
app.include_router(visualizer.router, prefix="/api/visualizer/projects", tags=["visualizer"])
app.include_router(shop.router, prefix="/api", tags=["shop"])
app.include_router(admin_api.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/health")
async def health(request: Request):
    return {"status": "ok"}


# Serve uploaded files during development
# Check both the env-configured path and the local uploads fallback
_possible_roots = [
    os.environ.get("MEDIA_STORAGE_ROOT", ""),
    "/home/user/wonder-wow-wall/uploads",
]
for _root in _possible_roots:
    if _root and os.path.isdir(_root):
        app.mount("/uploads", StaticFiles(directory=_root), name="uploads")
        break
