from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import ScaleCalibration


@dataclass
class PlacedPanelData:
    design_id: str = ""
    design_name: str = ""
    design_image: str = ""
    size_key: str = "30x30"
    color: str = "#CCCCCC"
    color_name: str = ""
    x: float = 0.0
    y: float = 0.0
    render_width: float = 150.0
    render_height: float = 150.0


@dataclass
class VisualizationProject:
    """Aggregate root for Visualizer bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: str = ""
    name: str = "Без названия"
    photo_url: str = ""
    photo_width: int = 0
    photo_height: int = 0
    wall_mask_base64: str = ""
    # Legacy float kept until Phase 5C migrates the API to the typed VO below.
    # When `calibration` is present, it is the source of truth and this field
    # mirrors `calibration.pixels_per_cm` for backwards compatibility.
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelData] = field(default_factory=list)
    # Legacy raw `list[{"x","y"}]` form for the wire/storage; Phase 5C will
    # promote this to a typed `PerspectiveCorners` VO at the API boundary.
    perspective_corners: list[dict] | None = None
    placement_mode: str = "manual"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    # ─── Phase 5B additions ──────────────────────────────────────────
    # Typed calibration VO. Optional during the 5B/5C transition: rows
    # written before 5C only carry `calibration_pixels_per_cm`.
    calibration: ScaleCalibration | None = None
    # `True` when Phase-3 vanishing-point detection produced the current
    # `perspective_corners`; cleared the moment the user manually nudges
    # a corner. Drives the green "auto-detected" banner on the frontend.
    perspective_auto_detected: bool = False
    # `True` when Phase-4 reference-object detection produced the current
    # `calibration` (one-click apply); cleared on manual override.
    calibration_auto_detected: bool = False
    # Optimistic-lock counter. Repository.update() compares this against
    # the row, raises `StaleSceneVersionError` on mismatch, then writes
    # `version + 1`. Multi-tab race protection (E8 in plan).
    version: int = 1

    def __post_init__(self):
        if not self.name.strip():
            raise ValueError("Project name must not be empty")
        if len(self.name) > 100:
            raise ValueError("Project name must be 100 characters or less")
        if len(self.panels) > 500:
            raise ValueError("Maximum 500 panels per project")
        if self.version < 1:
            raise ValueError("version must be ≥ 1")
