"""Domain services for the Visualizer bounded context.

Phase 6 introduces `PlaneFittingService` — a stateless service that turns a
depth map + binary wall mask into perspective corners. It deliberately uses
nothing but the standard library so it can be unit-tested without numpy /
scipy / opencv. For the model output sizes we deal with (256×256), pure
Python is fast enough; if profiling shows otherwise the implementation can
be promoted to numpy without any interface change.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .exceptions import PlaneFittingError
from .value_objects import DepthMap, PerspectiveCorners, Point

# Early-exit threshold: once ≥90% of subsampled pixels agree with the
# current plane hypothesis, further RANSAC iterations are unlikely to
# improve the result. Named constant so the rationale lives next to the
# number instead of inside the loop body (N6 fix).
_EARLY_EXIT_INLIER_RATIO = 0.9


@dataclass(frozen=True)
class _Plane:
    """Plane in 3D: a*x + b*y + c*z + d = 0. (a, b, c) is the unit normal."""

    a: float
    b: float
    c: float
    d: float

    def signed_distance(self, x: float, y: float, z: float) -> float:
        return self.a * x + self.b * y + self.c * z + self.d


def _fit_plane_through_three_points(
    p1: tuple[float, float, float],
    p2: tuple[float, float, float],
    p3: tuple[float, float, float],
) -> _Plane | None:
    """Return the plane containing three 3D points, or None if collinear."""
    (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = p1, p2, p3
    # Two edge vectors
    ux, uy, uz = x2 - x1, y2 - y1, z2 - z1
    vx, vy, vz = x3 - x1, y3 - y1, z3 - z1
    # Normal = u × v
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    norm = math.sqrt(nx * nx + ny * ny + nz * nz)
    if norm < 1e-9:
        return None  # Collinear sample
    nx, ny, nz = nx / norm, ny / norm, nz / norm
    d = -(nx * x1 + ny * y1 + nz * z1)
    return _Plane(nx, ny, nz, d)


class PlaneFittingService:
    """Stateless service: depth map + wall mask → `PerspectiveCorners`.

    Algorithm:
      1. Collect all (x, y, depth) samples *inside* the wall mask.
      2. RANSAC: sample 3-point subsets, fit a plane, count inliers within
         `inlier_tolerance` of the plane (in depth units). Keep the best.
      3. Project the wall-mask bounding box to four corners using the
         best-fit plane (the plane is implicit — the corners come from the
         BBox of the inlier set in image space, not from re-projection
         arithmetic, which would require a calibrated camera matrix we don't
         have at this layer).

    The result is the BBox of the inliers, oriented TL→TR→BR→BL. That is a
    deliberately *simple* projection — for v1 the goal is "produce a sensible
    quad on empty walls where vanishing-point detection failed", not pixel-
    perfect 3D reconstruction. Future versions can fold camera intrinsics in.

    Design rationale: keeping this stateless + dependency-free means the
    domain test suite runs in <100ms with zero installs (CONVENTIONS.md
    § "Domain Services"). The lone stateful bit is the `random.Random`
    RNG held for RANSAC sampling — a deliberate departure from strict
    statelessness so that `rng_seed=42` (default) gives repeatable
    inlier counts in tests (N4). Production callers can pass `rng_seed=None`
    to opt into system entropy.
    """

    def __init__(
        self,
        *,
        max_iterations: int = 50,
        inlier_tolerance: float = 0.03,
        min_inlier_ratio: float = 0.4,
        min_mask_pixels: int = 50,
        sample_stride: int = 4,
        rng_seed: int | None = 42,
    ):
        if max_iterations < 1:
            raise ValueError("max_iterations must be ≥ 1")
        if inlier_tolerance <= 0:
            raise ValueError("inlier_tolerance must be > 0")
        if not 0 < min_inlier_ratio <= 1:
            raise ValueError("min_inlier_ratio must be in (0, 1]")
        if min_mask_pixels < 3:
            raise ValueError("min_mask_pixels must be ≥ 3 (RANSAC needs 3 samples)")
        if sample_stride < 1:
            raise ValueError("sample_stride must be ≥ 1")

        self._max_iter = max_iterations
        self._tol = inlier_tolerance
        self._min_inlier_ratio = min_inlier_ratio
        self._min_mask_pixels = min_mask_pixels
        self._stride = sample_stride
        # Deterministic by default — production callers can pass `rng_seed=None`
        # to get a system-entropy RNG. Tests rely on the default for repeatable
        # inlier counts.
        self._rng = random.Random(rng_seed)

    def fit(self, depth: DepthMap, wall_mask: list[bool]) -> PerspectiveCorners:
        """Fit a plane and project to four corners.

        Args:
            depth: depth map (any size).
            wall_mask: row-major boolean mask aligned to `depth`. Length must
                equal `depth.width * depth.height`. `True` = wall pixel.

        Raises:
            PlaneFittingError: mask too small, no plane consensus, or the
                resulting bounding box is degenerate.
        """
        if len(wall_mask) != depth.width * depth.height:
            raise PlaneFittingError(
                f"wall_mask length {len(wall_mask)} does not match depth dims "
                f"{depth.width}×{depth.height} = {depth.width * depth.height}"
            )

        # Raw-mask size gate BEFORE subsampling (N12 fix). Counts True pixels
        # in the full mask so a small-but-dense mask is not prematurely
        # rejected by stride thinning it below 3 samples.
        raw_count = sum(1 for px in wall_mask if px)
        if raw_count < self._min_mask_pixels:
            raise PlaneFittingError(
                f"Wall mask has only {raw_count} pixels "
                f"(min={self._min_mask_pixels}); cannot fit a reliable plane."
            )

        # 1. Subsample wall pixels to keep RANSAC iterations cheap. Stride is
        # configurable; default of 4 gives ~4 000 samples on a 256×256 map
        # which is plenty for plane fitting on uniform surfaces. Edge
        # indices (w-1, h-1) are always included so the BBox of inliers
        # reaches the mask edge (N11 fix — previously underreported BBox
        # by up to `stride-1` pixels).
        w, h, vals = depth.width, depth.height, depth.values
        stride = self._stride
        xs_grid = list(range(0, w, stride))
        if xs_grid[-1] != w - 1:
            xs_grid.append(w - 1)
        ys_grid = list(range(0, h, stride))
        if ys_grid[-1] != h - 1:
            ys_grid.append(h - 1)
        samples: list[tuple[float, float, float]] = []
        for y in ys_grid:
            row_off = y * w
            for x in xs_grid:
                if wall_mask[row_off + x]:
                    samples.append((float(x), float(y), vals[row_off + x]))

        if len(samples) < 3:
            # Extremely thin/sparse mask survived the raw gate but the stride
            # grid missed all but <3 cells. Lowering `sample_stride` would
            # recover these, but at the default of 4 we treat this as
            # unfittable rather than silently degrading accuracy.
            raise PlaneFittingError(
                f"After subsampling (stride={stride}) only {len(samples)} "
                f"wall pixels remain; RANSAC requires ≥3. Lower sample_stride."
            )

        # 2. RANSAC.
        best_plane: _Plane | None = None
        best_inliers: list[tuple[float, float, float]] = []
        n = len(samples)
        rng = self._rng

        for _ in range(self._max_iter):
            # Sample three distinct indices.
            i1, i2, i3 = rng.sample(range(n), 3)
            plane = _fit_plane_through_three_points(samples[i1], samples[i2], samples[i3])
            if plane is None:
                continue
            tol = self._tol
            inliers = [
                p for p in samples
                if abs(plane.signed_distance(p[0], p[1], p[2])) <= tol
            ]
            if len(inliers) > len(best_inliers):
                best_plane = plane
                best_inliers = inliers
                # Early exit when we have a strong consensus — saves iterations
                # on easy scenes (the common case for empty walls).
                if len(inliers) / n >= _EARLY_EXIT_INLIER_RATIO:
                    break

        # N13 fix: `n` is ≥3 by the subsample gate above, so the previous
        # `if n else 0.0` fallback was unreachable; drop it.
        if best_plane is None or len(best_inliers) / n < self._min_inlier_ratio:
            ratio = len(best_inliers) / n
            raise PlaneFittingError(
                f"RANSAC did not converge: best inlier ratio={ratio:.2f}, "
                f"required ≥{self._min_inlier_ratio}"
            )

        # 3. Project: bounding box of inliers in image space, oriented TL→TR→BR→BL.
        xs = [p[0] for p in best_inliers]
        ys = [p[1] for p in best_inliers]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)

        # Defensive: PerspectiveCorners __post_init__ enforces non-degenerate
        # area, but raise a domain-specific error here so callers see
        # PlaneFittingError instead of CollinearCornersError when the bbox
        # collapses (e.g. all inliers in a single row).
        if (x_max - x_min) < 1.0 or (y_max - y_min) < 1.0:
            raise PlaneFittingError(
                f"Inlier bounding box collapsed: "
                f"width={x_max - x_min:.2f}, height={y_max - y_min:.2f}"
            )

        return PerspectiveCorners(
            top_left=Point(x_min, y_min),
            top_right=Point(x_max, y_min),
            bottom_right=Point(x_max, y_max),
            bottom_left=Point(x_min, y_max),
        )
