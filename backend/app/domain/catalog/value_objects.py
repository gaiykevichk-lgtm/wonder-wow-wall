from dataclasses import dataclass
from enum import Enum


class PanelSizeKey(str, Enum):
    S_30x30 = "300x300"
    S_30x60 = "300x600"
    S_60x60 = "600x600"


@dataclass(frozen=True)
class PanelSize:
    width_mm: int
    height_mm: int
    label: str

    @property
    def key(self) -> str:
        return f"{self.width_mm}x{self.height_mm}"


PANEL_SIZES = {
    PanelSizeKey.S_30x30: PanelSize(300, 300, "30×30 см"),
    PanelSizeKey.S_30x60: PanelSize(300, 600, "30×60 см"),
    PanelSizeKey.S_60x60: PanelSize(600, 600, "60×60 см"),
}

BASE_PANEL_PRICES: dict[str, int] = {
    "300x300": 890,
    "300x600": 1490,
    "600x600": 2490,
}

DESIGN_OVERLAY_PRICE = 1200


@dataclass(frozen=True)
class Color:
    hex: str
    name: str


@dataclass(frozen=True)
class Price:
    amount: int
    currency: str = "RUB"

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Price cannot be negative")
