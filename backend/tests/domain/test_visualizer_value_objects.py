"""Phase 5B — domain VO tests for the Visualizer bounded context.

Pure unit tests; no DB, no mocks. Validates immutability + invariants of
`Point`, `ScaleCalibration`, `PerspectiveCorners` and the
`CollinearCornersError` raised on degenerate input.
"""

from dataclasses import FrozenInstanceError

import pytest

from app.domain.visualizer.exceptions import CollinearCornersError
from app.domain.visualizer.value_objects import (
    PerspectiveCorners,
    Point,
    ScaleCalibration,
)


# ─── Point ───────────────────────────────────────────────────────────

class TestPoint:
    def test_immutable(self):
        p = Point(x=1.0, y=2.0)
        with pytest.raises(FrozenInstanceError):
            p.x = 10  # type: ignore[misc]

    def test_equality_by_value(self):
        assert Point(1.0, 2.0) == Point(1.0, 2.0)
        assert Point(1.0, 2.0) != Point(1.0, 2.1)


# ─── ScaleCalibration ────────────────────────────────────────────────

class TestScaleCalibration:
    def test_create_minimal(self):
        cal = ScaleCalibration(method="manual", pixels_per_cm=5.0)
        assert cal.pixels_per_cm == 5.0
        assert cal.method == "manual"
        assert cal.wall_width_cm is None

    def test_immutable(self):
        cal = ScaleCalibration(method="reference", pixels_per_cm=4.2)
        with pytest.raises(FrozenInstanceError):
            cal.pixels_per_cm = 99  # type: ignore[misc]

    @pytest.mark.parametrize("method", ["reference", "manual", "auto"])
    def test_accepts_known_methods(self, method):
        ScaleCalibration(method=method, pixels_per_cm=1.0)  # no raise

    def test_rejects_unknown_method(self):
        with pytest.raises(ValueError, match="Unknown calibration method"):
            ScaleCalibration(method="bogus", pixels_per_cm=1.0)  # type: ignore[arg-type]

    @pytest.mark.parametrize("bad", [0, -1, -0.001])
    def test_rejects_non_positive_ppc(self, bad):
        with pytest.raises(ValueError, match="pixels_per_cm must be positive"):
            ScaleCalibration(method="manual", pixels_per_cm=bad)

    def test_rejects_non_positive_wall_dims(self):
        with pytest.raises(ValueError, match="wall_width_cm"):
            ScaleCalibration(method="manual", pixels_per_cm=5.0, wall_width_cm=0)
        with pytest.raises(ValueError, match="wall_height_cm"):
            ScaleCalibration(method="manual", pixels_per_cm=5.0, wall_height_cm=-1)

    def test_round_trip_dict(self):
        cal = ScaleCalibration(
            method="reference", pixels_per_cm=6.7, wall_width_cm=300, wall_height_cm=240
        )
        assert ScaleCalibration.from_dict(cal.to_dict()) == cal

    def test_from_dict_accepts_missing_optional_fields(self):
        cal = ScaleCalibration.from_dict({"method": "manual", "pixels_per_cm": 5.0})
        assert cal.wall_width_cm is None
        assert cal.wall_height_cm is None


# ─── PerspectiveCorners ──────────────────────────────────────────────

def _square(side: float = 100.0) -> PerspectiveCorners:
    """Helper: a non-degenerate square quadrilateral for the happy path."""
    return PerspectiveCorners(
        top_left=Point(0, 0),
        top_right=Point(side, 0),
        bottom_right=Point(side, side),
        bottom_left=Point(0, side),
    )


class TestPerspectiveCorners:
    def test_create_valid(self):
        pc = _square()
        assert pc.top_left == Point(0, 0)
        assert pc.bottom_right == Point(100, 100)

    def test_immutable(self):
        pc = _square()
        with pytest.raises(FrozenInstanceError):
            pc.top_left = Point(99, 99)  # type: ignore[misc]

    def test_validates_collinearity_all_same_point(self):
        with pytest.raises(CollinearCornersError, match="degenerate"):
            PerspectiveCorners(
                top_left=Point(50, 50),
                top_right=Point(50, 50),
                bottom_right=Point(50, 50),
                bottom_left=Point(50, 50),
            )

    def test_validates_collinearity_horizontal_line(self):
        with pytest.raises(CollinearCornersError):
            PerspectiveCorners(
                top_left=Point(0, 50),
                top_right=Point(50, 50),
                bottom_right=Point(100, 50),
                bottom_left=Point(150, 50),
            )

    def test_as_dicts_round_trip(self):
        pc = _square()
        raw = pc.as_dicts()
        assert raw == [
            {"x": 0, "y": 0}, {"x": 100, "y": 0},
            {"x": 100, "y": 100}, {"x": 0, "y": 100},
        ]
        assert PerspectiveCorners.from_dicts(raw) == pc

    def test_from_dicts_none_returns_none(self):
        assert PerspectiveCorners.from_dicts(None) is None

    def test_from_dicts_wrong_length_raises(self):
        with pytest.raises(CollinearCornersError, match="Expected exactly 4"):
            PerspectiveCorners.from_dicts([{"x": 0, "y": 0}, {"x": 1, "y": 1}])

    def test_from_dicts_string_coordinates_coerced(self):
        # Defensive: API DTOs may serialize numerics as strings depending on
        # client; from_dicts coerces via float().
        pc = PerspectiveCorners.from_dicts(
            [{"x": "0", "y": "0"}, {"x": "100", "y": "0"},
             {"x": "100", "y": "100"}, {"x": "0", "y": "100"}]
        )
        assert pc == _square()
