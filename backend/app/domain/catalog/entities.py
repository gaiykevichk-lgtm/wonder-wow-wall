from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import Color


@dataclass
class DesignReview:
    id: str = field(default_factory=lambda: str(uuid4()))
    design_id: str = ""
    user_id: str = ""
    user_name: str = ""
    rating: int = 5
    text: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        if not 1 <= self.rating <= 5:
            raise ValueError("Rating must be between 1 and 5")


@dataclass
class Category:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    image: str = ""
    count: int = 0


@dataclass
class Design:
    """Aggregate Root for Catalog bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    slug: str = ""
    category_id: str = ""
    style: str = ""
    image: str = ""
    description: str = ""
    price: int = 1200  # uniform overlay price
    colors: list[Color] = field(default_factory=list)
    rating: float = 0.0
    reviews_count: int = 0
    is_new: bool = False
    is_popular: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)

    def add_review(self, review: DesignReview) -> None:
        self.reviews_count += 1
        # Running average
        total = self.rating * (self.reviews_count - 1) + review.rating
        self.rating = round(total / self.reviews_count, 1)
