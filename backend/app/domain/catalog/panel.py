from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import PanelSize


@dataclass
class Panel:
    """Aggregate Root for the Panel bounded sub-context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    size: PanelSize = field(default_factory=lambda: PanelSize(300, 300, "30×30 см"))
    base_price: int = 0
    stock_quantity: int = 0
    availability_status_id: str | None = None
    # Технические характеристики формы возвращаются админским API.
    thickness_mm: int = 3
    execution: str = "Архитектурное декоративное покрытие"
    mounting_system: str = "Запатентованная система быстрой замены"
    base_material: str = "Ультралёгкий композит высокой плотности"
    packaging: str = ""
    description: str = ""
    photo_path: str = ""
    photo_paths: list[str] = field(default_factory=list)
    form_preview_path: str = ""
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if self.base_price < 0:
            raise ValueError("Panel.base_price cannot be negative")
        if self.stock_quantity < 0:
            raise ValueError("Panel.stock_quantity cannot be negative")
        if self.size.width_mm <= 0 or self.size.height_mm <= 0:
            raise ValueError("Panel.size dimensions must be positive")
        self.sync_photos()

    def sync_photos(self) -> None:
        """Keep primary photo and ordered gallery consistent."""
        gallery = [p for p in self.photo_paths if p]
        seen: set[str] = set()
        gallery = [p for p in gallery if not (p in seen or seen.add(p))]
        if gallery:
            self.photo_paths = gallery
            self.photo_path = gallery[0]
        elif self.photo_path:
            self.photo_paths = [self.photo_path]
        else:
            self.photo_paths = []
