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
from typing import Literal, get_args

from .exceptions import CollinearCornersError

# Mirrors frontend `ScaleCalibration.method`. Kept as a Literal alias to make
# invalid methods a static-typecheck error, and a runtime guard in __post_init__
# to catch dynamic input (API payloads, repo loads).
CalibrationMethod = Literal["reference", "manual", "auto"]
# Single source of truth for the allowed methods — runtime check derives from
# the Literal so adding a new variant doesn't require updating two places (B31).
_VALID_CALIBRATION_METHODS = get_args(CalibrationMethod)

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
        if self.method not in _VALID_CALIBRATION_METHODS:
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
        # Surface a clear ValueError for missing required keys instead of a raw
        # KeyError — corrupt persistence rows give a useful traceback (B32).
        for key in ("method", "pixels_per_cm"):
            if key not in raw:
                raise ValueError(
                    f"ScaleCalibration.from_dict missing required key {key!r}; got {sorted(raw.keys())!r}"
                )
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


@dataclass(frozen=True)
class DepthMap:
    """Phase 6 — monocular depth map produced by `DepthEstimator`.

    Stored as a flat row-major `tuple[float, ...]` (not numpy) so the value
    object stays serialisable and framework-free — `numpy` lives in the
    infrastructure adapter only. For typical model output sizes (256×256 =
    65 536 floats) the overhead is acceptable for a single inference.

    Values are *normalised relative depth* in [0, 1] (0 = nearest, 1 = farthest)
    to make the contract independent of the underlying model's scale (MiDaS
    outputs inverse depth in arbitrary units; the adapter is responsible for
    normalising). Plane fitting is unit-agnostic so this is fine.
    """

    width: int
    height: int
    # Row-major, length must equal width * height. Stored as tuple for hash
    # stability (frozen dataclass) — list would defeat that.
    values: tuple[float, ...]

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(
                f"DepthMap dimensions must be positive, got {self.width}×{self.height}"
            )
        if len(self.values) != self.width * self.height:
            raise ValueError(
                f"DepthMap.values length {len(self.values)} does not match "
                f"width*height = {self.width * self.height}"
            )

    def at(self, x: int, y: int) -> float:
        """Sample depth at integer pixel `(x, y)`. Bounds-checked — callers
        that iterate are expected to use `values` directly for speed."""
        if not (0 <= x < self.width and 0 <= y < self.height):
            raise IndexError(
                f"DepthMap.at: ({x}, {y}) out of bounds {self.width}×{self.height}"
            )
        return self.values[y * self.width + x]
