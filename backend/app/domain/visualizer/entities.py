from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


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
    name: str = ""
    photo_url: str = ""
    photo_width: int = 0
    photo_height: int = 0
    wall_mask_base64: str = ""
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelData] = field(default_factory=list)
    perspective_corners: list[dict] | None = None
    placement_mode: str = "manual"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        if len(self.name) > 100:
            raise ValueError("Project name must be 100 characters or less")
        if len(self.panels) > 500:
            raise ValueError("Maximum 500 panels per project")
