"""Phase 7B — Panel aggregate root invariants.

Pure domain tests; no DB, no FastAPI. Mirror the shape of `test_user_block.py`
— one class per invariant, narrow assertions.
"""
import pytest

from app.domain.catalog.panel import Panel
from app.domain.catalog.value_objects import PanelSize


def _ok_size() -> PanelSize:
    return PanelSize(width_mm=300, height_mm=300, label="30×30 см")


class TestPanelInvariants:
    def test_defaults_yield_valid_panel(self):
        # The dataclass defaults must not violate __post_init__ — guards
        # against a future tweak that makes a fresh `Panel()` unconstructable.
        p = Panel()
        assert p.is_active is True
        assert p.base_price == 0
        assert p.size.width_mm == 300

    def test_negative_price_rejected(self):
        with pytest.raises(ValueError, match="base_price"):
            Panel(name="x", slug="x", size=_ok_size(), base_price=-1)

    def test_zero_price_allowed(self):
        # Zero is a valid promo price; only negative is rejected. Mirrors
        # the `Price` VO docstring rationale.
        p = Panel(name="x", slug="x", size=_ok_size(), base_price=0)
        assert p.base_price == 0

    def test_zero_dimension_rejected(self):
        with pytest.raises(ValueError, match="dimensions"):
            Panel(
                name="x", slug="x",
                size=PanelSize(width_mm=0, height_mm=300, label=""),
                base_price=100,
            )
