"""Admin-panel API surface (`/api/admin/*`).

All routes here are gated by `get_current_admin_id`. Sub-routers are
mounted onto this package-level APIRouter and aggregated into a single
include in `app/main.py`, so adding a new admin area (dashboard, orders,
users, ...) in future phases is a one-line edit here — `main.py` is not
touched again.
"""

from fastapi import APIRouter

from . import auth as _auth

router = APIRouter()
router.include_router(_auth.router, prefix="", tags=["admin"])
