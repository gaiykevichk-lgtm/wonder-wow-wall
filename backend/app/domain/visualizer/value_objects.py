"""Value Objects for the Visualizer bounded context.

These are immutable, equality-by-value primitives that travel through the
domain and persistence layers. Mirrors the frontend types in
`frontend/src/domains/visualizer/model/types.ts` (`Point`, `ScaleCalibration`,
`PerspectiveCorners`) so the round-trip stays loss-less.

Keeping them as `frozen=True` dataclasses (rather than namedtuples or pydantic)
respects the DDD layering: no framework dependency, easy to construct in tests,
hashable for deduplication.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .exceptions import CollinearCornersError

# Mirrors frontend `ScaleCalibration.method`. Kept as a Literal alias to make
# invalid methods a static-typecheck error, and a runtime guard in __post_init__
# to catch dynamic input (API payloads, repo loads).
CalibrationMethod = Literal["reference", "manual", "auto"]

# Below this quad-area-in-pixels² the corners are treated as collinear.
# Real wall photos produce quads with area > 10⁵ px² (e.g. a 1000×1000 image
# with corners spanning ~half the image gives ~2.5e5 px²), so 1.0 px² is a
# generous floor that only catches truly degenerate input.
_MIN_QUAD_AREA = 1.0


@dataclass(frozen=True)
class Point:
    """2D point in image pixel coordinates (origin = top-left, y grows down).

    Floats — sub-pixel precision matters when a perspective transform is
    composed with a render scale.
    """

    x: float
    y: float


@dataclass(frozen=True)
class ScaleCalibration:
    """How many image pixels equal 1 cm of real-world wall.

    `method` records the *provenance* of the calibration (see field doc on the
    frontend mirror). It influences the auto-suggest UX downstream — e.g.
    `reference`/`manual` are high-trust and skip the "please calibrate" banner;
    `auto` is the placeholder set on photo upload.
    """

    method: CalibrationMethod
    pixels_per_cm: float
    wall_width_cm: float | None = None
    wall_height_cm: float | None = None

    def __post_init__(self) -> None:
        if self.method not in ("reference", "manual", "auto"):
            raise ValueError(f"Unknown calibration method: {self.method!r}")
        if self.pixels_per_cm <= 0:
            raise ValueError(
                f"pixels_per_cm must be positive, got {self.pixels_per_cm}"
            )
        if self.wall_width_cm is not None and self.wall_width_cm <= 0:
            raise ValueError(
                f"wall_width_cm must be positive when set, got {self.wall_width_cm}"
            )
        if self.wall_height_cm is not None and self.wall_height_cm <= 0:
            raise ValueError(
                f"wall_height_cm must be positive when set, got {self.wall_height_cm}"
            )

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "pixels_per_cm": self.pixels_per_cm,
            "wall_width_cm": self.wall_width_cm,
            "wall_height_cm": self.wall_height_cm,
        }

    @classmethod
    def from_dict(cls, raw: dict) -> ScaleCalibration:
        return cls(
            method=raw["method"],
            pixels_per_cm=float(raw["pixels_per_cm"]),
            wall_width_cm=(
                float(raw["wall_width_cm"]) if raw.get("wall_width_cm") is not None else None
            ),
            wall_height_cm=(
                float(raw["wall_height_cm"]) if raw.get("wall_height_cm") is not None else None
            ),
        )


@dataclass(frozen=True)
class PerspectiveCorners:
    """Four corners of the wall quadrilateral in clockwise order from top-left.

    Order is fixed (TL → TR → BR → BL) so consumers can index without
    guessing. Validation in `__post_init__` rejects degenerate quads
    (collinear corners ⇒ vanishing-point detection failed or user pinched
    all four corners on top of each other).
    """

    top_left: Point
    top_right: Point
    bottom_right: Point
    bottom_left: Point

    def __post_init__(self) -> None:
        # Shoelace formula for a polygon's signed area; absolute value handles
        # both CW/CCW orderings (we expect CW but defensive code is cheap).
        pts = self.as_list()
        signed_area = 0.0
        for i in range(4):
            j = (i + 1) % 4
            signed_area += pts[i].x * pts[j].y - pts[j].x * pts[i].y
        area = abs(signed_area) / 2.0
        if area < _MIN_QUAD_AREA:
            raise CollinearCornersError(
                f"Perspective corners form a degenerate quadrilateral "
                f"(area={area:.4f}px², min={_MIN_QUAD_AREA}px²)"
            )

    def as_list(self) -> list[Point]:
        return [self.top_left, self.top_right, self.bottom_right, self.bottom_left]

    def as_dicts(self) -> list[dict]:
        """Serialize to the legacy `list[dict]` form used by API and storage
        (until Phase 5C migrates the wire format)."""
        return [{"x": p.x, "y": p.y} for p in self.as_list()]

    @classmethod
    def from_dicts(cls, raw: list[dict] | None) -> PerspectiveCorners | None:
        """Parse the legacy raw form. Returns `None` on `None` input — callers
        that require corners should check after parsing."""
        if raw is None:
            return None
        if len(raw) != 4:
            raise CollinearCornersError(
                f"Expected exactly 4 perspective corners, got {len(raw)}"
            )
        pts = [Point(x=float(r["x"]), y=float(r["y"])) for r in raw]
        return cls(
            top_left=pts[0],
            top_right=pts[1],
            bottom_right=pts[2],
            bottom_left=pts[3],
        )
