"""Phase 6 — media value objects.

`MediaPurpose` is an enum, not a free-form string, because:

* Storage is sharded by purpose at the path level (`/var/uploads/<purpose>/`),
  so a typo would silently bury a file in the wrong bucket.
* Each purpose carries its OWN `MediaConstraints` (size + mime + dimensions);
  treating them as anonymous strings would mean the validation lookup is
  guarded by a `dict.get(...)` with a None-fallback, and one wrong call
  site would let an oversized banner through.

`MediaConstraints` is intentionally per-purpose (not a single global). Banners
need to be larger than panel-photos; design previews are small thumbnails.
Keeping the table here (in the domain) means the same numbers are visible to
the use case and the admin UI without crossing a layer boundary.
"""
from dataclasses import dataclass, field
from enum import Enum


class MediaPurpose(str, Enum):
    """What the file is for. Drives both storage path and validation rules.

    Subclasses `str` so FastAPI's `Query(...)` / pydantic models accept the
    enum value directly without manual coercion (mirrors `UserRole`).
    """

    DESIGN_PREVIEW = "DESIGN_PREVIEW"
    PANEL_PHOTO = "PANEL_PHOTO"
    BANNER = "BANNER"
    MISC = "MISC"


# MIME allowlist. JPEG/PNG/WebP cover every realistic admin upload —
# adding SVG would require an XSS sanitiser (SVGs can carry inline JS); GIF
# is intentionally out (a panel photo as a flashing GIF is never the right
# answer). Adjust here when the product asks for a new format.
_IMAGE_MIMES = frozenset({"image/jpeg", "image/png", "image/webp"})


@dataclass(frozen=True)
class MediaConstraints:
    """Per-purpose validation envelope.

    `max_size_bytes` is checked twice — once before the upload finishes
    (Content-Length header in the API layer, so we drop oversized files
    BEFORE buffering them), and once after Pillow has re-read the image
    (defense against a header that lies). `min_*` / `max_*` dimensions are
    in pixels.

    `min_width` / `min_height` are 0 by default — we don't reject tiny
    images at the domain layer for `MISC` (admins occasionally upload
    small icons). Actual purposes override the floor in the table below.
    """

    max_size_bytes: int
    allowed_mimes: frozenset[str]
    min_width: int = 0
    min_height: int = 0
    max_width: int = 8192
    max_height: int = 8192


# Per-purpose constraints. Numbers chosen to match the Phase 7A/7B UX:
#   * design previews — 1080×1080 enough for retina catalog cards
#   * panel photos    — 4096×4096 covers a real product shot
#   * banners         — wide hero (3840×1600 4K wide cap)
#   * misc            — anything within the global 20MB cap
#
# Single source of truth; the admin UI also reads this dict (via the
# `GET /api/admin/media/constraints` endpoint, see infra layer).
PURPOSE_CONSTRAINTS: dict[MediaPurpose, MediaConstraints] = {
    MediaPurpose.DESIGN_PREVIEW: MediaConstraints(
        max_size_bytes=5 * 1024 * 1024,
        allowed_mimes=_IMAGE_MIMES,
        min_width=400, min_height=400,
        max_width=3000, max_height=3000,
    ),
    MediaPurpose.PANEL_PHOTO: MediaConstraints(
        max_size_bytes=10 * 1024 * 1024,
        allowed_mimes=_IMAGE_MIMES,
        min_width=600, min_height=600,
        max_width=4096, max_height=4096,
    ),
    MediaPurpose.BANNER: MediaConstraints(
        max_size_bytes=15 * 1024 * 1024,
        allowed_mimes=_IMAGE_MIMES,
        min_width=1200, min_height=400,
        max_width=3840, max_height=2160,
    ),
    MediaPurpose.MISC: MediaConstraints(
        max_size_bytes=20 * 1024 * 1024,
        allowed_mimes=_IMAGE_MIMES,
        # No dimension floor — see class docstring.
        max_width=8192, max_height=8192,
    ),
}


# Global hard ceiling — the API layer's first-line check before any
# per-purpose lookup. Even `MISC` cannot exceed this; if a future purpose
# legitimately needs >20MB, adjust here AND in nginx's `client_max_body_size`.
GLOBAL_MAX_SIZE_BYTES = 20 * 1024 * 1024


def constraints_for(purpose: MediaPurpose) -> MediaConstraints:
    """Lookup helper. Raises `KeyError` if the table is out of sync with
    the enum — surfaces a missing-mapping bug as a startup failure rather
    than a silent permissive default.
    """
    return PURPOSE_CONSTRAINTS[purpose]
