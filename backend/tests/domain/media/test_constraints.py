"""Phase 6 — domain-level pin tests for `MediaConstraints` / `MediaPurpose`.

These read like coupling tests on the constants table and that's the
point: changing any of these numbers should be a deliberate decision,
not a silent edit. The frontend reads the same values via the
`/constraints` endpoint and renders them as hint text — silently
shrinking `BANNER.max_size_bytes` would mislead admins.
"""
from app.domain.media.value_objects import (
    GLOBAL_MAX_SIZE_BYTES,
    MediaPurpose,
    PURPOSE_CONSTRAINTS,
    constraints_for,
)


class TestEnumCoverage:
    def test_every_enum_member_has_constraints(self):
        # Drift detector: adding a new MediaPurpose without a constraints
        # entry must be impossible (the lookup raises KeyError).
        for purpose in MediaPurpose:
            assert constraints_for(purpose) is not None, purpose

    def test_no_orphan_constraints_entry(self):
        # Inverse check — every key in PURPOSE_CONSTRAINTS is a real
        # enum member.
        for key in PURPOSE_CONSTRAINTS.keys():
            assert isinstance(key, MediaPurpose)


class TestGlobalCap:
    def test_global_cap_is_20mb(self):
        # Pinned because the same number appears in nginx.conf
        # (`client_max_body_size`) and would silently mismatch otherwise.
        assert GLOBAL_MAX_SIZE_BYTES == 20 * 1024 * 1024

    def test_no_purpose_exceeds_global_cap(self):
        # A per-purpose cap > global is incoherent — the global check
        # would reject before the per-purpose check ever runs.
        for purpose, c in PURPOSE_CONSTRAINTS.items():
            assert c.max_size_bytes <= GLOBAL_MAX_SIZE_BYTES, purpose


class TestPerPurposeWindow:
    def test_design_preview_floor(self):
        c = constraints_for(MediaPurpose.DESIGN_PREVIEW)
        # Catalog cards render at retina 2x of ~200px → 400px floor.
        assert c.min_width == 400
        assert c.min_height == 400

    def test_panel_photo_ceiling(self):
        c = constraints_for(MediaPurpose.PANEL_PHOTO)
        # 4096px is "full DSLR shot, downscaled if larger". Anything
        # beyond is operator error (RAW upload).
        assert c.max_width == 4096
        assert c.max_height == 4096

    def test_banner_is_widescreen(self):
        c = constraints_for(MediaPurpose.BANNER)
        assert c.max_width >= c.max_height, "banner must allow landscape"

    def test_misc_has_no_dimension_floor(self):
        # Drift detector — MISC is the catch-all and must not gain a
        # floor that would surprise admins uploading small icons.
        c = constraints_for(MediaPurpose.MISC)
        assert c.min_width == 0
        assert c.min_height == 0

    def test_all_purposes_allow_jpeg_png_webp(self):
        # Pin the MIME allowlist — adding SVG without an XSS sanitiser
        # would be a footgun (SVGs can carry inline JS).
        expected = {"image/jpeg", "image/png", "image/webp"}
        for purpose, c in PURPOSE_CONSTRAINTS.items():
            assert set(c.allowed_mimes) == expected, purpose


class TestImmutability:
    def test_constraints_is_frozen(self):
        # `MediaConstraints` is a frozen dataclass — accidental mutation
        # would defeat the "single source of truth" guarantee.
        import dataclasses
        c = constraints_for(MediaPurpose.MISC)
        try:
            c.max_size_bytes = 1  # type: ignore[misc]
        except dataclasses.FrozenInstanceError:
            return
        raise AssertionError("MediaConstraints should be frozen")
