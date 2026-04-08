from dataclasses import dataclass


@dataclass(frozen=True)
class PanelPosition:
    x: float
    y: float


@dataclass(frozen=True)
class PanelDimensions:
    width_cm: float
    height_cm: float
