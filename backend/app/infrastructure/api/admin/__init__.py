"""Admin-panel API surface (`/api/admin/*`).

All routes here are gated by `get_current_admin_id`. Sub-routers are
mounted onto this package-level APIRouter and aggregated into a single
include in `app/main.py`, so adding a new admin area (dashboard, orders,
users, ...) in future phases is a one-line edit here — `main.py` is not
touched again.
"""

from importlib import import_module

from fastapi import APIRouter

from . import audit as _audit
from . import auth as _auth
from . import banners as _banners
from . import catalog as _catalog
from . import dashboard as _dashboard
from . import media as _media
from . import orders as _orders
from . import panels as _panels
from . import recommendations as _recommendations
from . import shop_settings as _shop_settings
from . import subscription_plans as _subscription_plans
from . import textures as _textures
from . import textures_visualization as _textures_visualization
from . import panel_variants as _panel_variants

# Loaded explicitly because static export discovery for this package can lag
# behind newly added router modules during incremental checks.
_panel_texture_assignments = import_module(
    "app.infrastructure.api.admin.panel_texture_assignments"
)
from . import users as _users
from . import uploads as _uploads

router = APIRouter()
router.include_router(_auth.router, prefix="", tags=["admin"])
router.include_router(_dashboard.router, prefix="", tags=["admin-analytics"])
router.include_router(_orders.router, prefix="", tags=["admin-orders"])
router.include_router(_users.router, prefix="", tags=["admin-users"])
router.include_router(_media.router, prefix="", tags=["admin-media"])
router.include_router(_panels.router, prefix="", tags=["admin-panels"])
router.include_router(_catalog.router, prefix="", tags=["admin-catalog"])
router.include_router(_shop_settings.router, prefix="", tags=["admin-shop"])
router.include_router(_banners.router, prefix="", tags=["admin-shop-banners"])
router.include_router(
    _subscription_plans.router, prefix="", tags=["admin-subscription-plans"],
)
router.include_router(_audit.router, prefix="", tags=["admin-audit"])
router.include_router(
    _recommendations.router, prefix="", tags=["admin-recommendations"],
)
router.include_router(_textures.router, prefix="", tags=["admin-textures"])
router.include_router(_textures_visualization.router, prefix="", tags=["admin-texture-visualizations"])
# Backward-compatible alias for clients using the earlier double-/admin URL.
router.include_router(_textures_visualization.legacy_router, prefix="", tags=["admin-texture-visualizations"])
router.include_router(_panel_variants.router, prefix="", tags=["admin-panel-variants"])
router.include_router(
    _panel_texture_assignments.router,
    prefix="",
    tags=["admin-panel-texture-assignments"],
)
router.include_router(_uploads.router, prefix="", tags=["admin-uploads"])

from . import configurator_settings as _configurator_settings
router.include_router(_configurator_settings.router, tags=["admin-configurator"])
