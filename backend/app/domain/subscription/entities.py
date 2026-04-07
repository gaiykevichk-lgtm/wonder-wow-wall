from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import uuid4

from .value_objects import SubscriptionTier, SubscriptionStatus


@dataclass
class SubscriptionPlan:
    id: str = ""
    name: str = ""
    price: int = 0
    period: str = "мес"
    area_limit_m2: float = 0  # 0 = unlimited
    popular: bool = False
    features: list[str] = field(default_factory=list)


SUBSCRIPTION_PLANS: list[SubscriptionPlan] = [
    SubscriptionPlan(
        id="starter", name="Стартовый", price=7000, area_limit_m2=15,
        features=[
            "До 15 м² накладок в месяц",
            "Все дизайны из каталога",
            "Бесплатная доставка по Москве",
            "Замена повреждённых накладок",
            "Поддержка 9:00–18:00",
        ],
    ),
    SubscriptionPlan(
        id="popular", name="Популярный", price=12000, area_limit_m2=30, popular=True,
        features=[
            "До 30 м² накладок в месяц",
            "Все дизайны + эксклюзивные коллекции",
            "Бесплатная доставка по РФ",
            "Приоритетная замена повреждённых",
            "Поддержка 8:00–22:00",
            "Персональный дизайнер",
            "Сохранение до 5 проектов",
        ],
    ),
    SubscriptionPlan(
        id="business", name="Бизнес", price=18000, area_limit_m2=0,
        features=[
            "Безлимитная площадь накладок",
            "Эксклюзивные и кастомные дизайны",
            "VIP-доставка по всей РФ",
            "Замена в течение 24 часов",
            "Поддержка 24/7",
            "Персональный менеджер",
            "Безлимитные проекты",
            "Скидка 20% на базовые панели",
        ],
    ),
]


@dataclass
class Subscription:
    """Aggregate Root for Subscription bounded context."""

    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: str = ""
    plan_id: str = ""
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    area_used_this_month_m2: float = 0.0
    started_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(days=30))

    def cancel(self) -> None:
        if self.status != SubscriptionStatus.ACTIVE:
            raise ValueError("Can only cancel active subscriptions")
        self.status = SubscriptionStatus.CANCELLED

    def use_area(self, area_m2: float) -> bool:
        plan = self._get_plan()
        if not plan:
            return False
        if plan.area_limit_m2 > 0 and self.area_used_this_month_m2 + area_m2 > plan.area_limit_m2:
            return False
        self.area_used_this_month_m2 += area_m2
        return True

    @property
    def remaining_area_m2(self) -> float:
        plan = self._get_plan()
        if not plan:
            return 0.0
        if plan.area_limit_m2 == 0:
            return float("inf")
        return max(0.0, plan.area_limit_m2 - self.area_used_this_month_m2)

    def _get_plan(self) -> SubscriptionPlan | None:
        return next((p for p in SUBSCRIPTION_PLANS if p.id == self.plan_id), None)
