"""Admin-panel API surface (`/api/admin/*`).

All routes here are gated by `get_current_admin_id`. Sub-routers are
mounted onto this package-level APIRouter and aggregated into a single
include in `app/main.py`, so adding a new admin area (dashboard, orders,
users, ...) in future phases is a one-line edit here — `main.py` is not
touched again.
"""

from fastapi import APIRouter

from . import auth as _auth
from . import dashboard as _dashboard
from . import media as _media
from . import orders as _orders
from . import panels as _panels
from . import users as _users

router = APIRouter()
router.include_router(_auth.router, prefix="", tags=["admin"])
router.include_router(_dashboard.router, prefix="", tags=["admin-analytics"])
router.include_router(_orders.router, prefix="", tags=["admin-orders"])
router.include_router(_users.router, prefix="", tags=["admin-users"])
router.include_router(_media.router, prefix="", tags=["admin-media"])
router.include_router(_panels.router, prefix="", tags=["admin-panels"])
