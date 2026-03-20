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
    overlays_per_month: int = 0  # 0 = unlimited
    popular: bool = False
    features: list[str] = field(default_factory=list)


SUBSCRIPTION_PLANS: list[SubscriptionPlan] = [
    SubscriptionPlan(
        id="starter", name="Стартовый", price=4900, overlays_per_month=10,
        features=[
            "До 10 накладок в месяц (любой размер)",
            "Все дизайны из каталога",
            "Бесплатная доставка по Москве",
            "Замена повреждённых накладок",
            "Поддержка 9:00–18:00",
        ],
    ),
    SubscriptionPlan(
        id="popular", name="Популярный", price=9900, overlays_per_month=25, popular=True,
        features=[
            "До 25 накладок в месяц (любой размер)",
            "Все дизайны + эксклюзивные коллекции",
            "Бесплатная доставка по РФ",
            "Приоритетная замена повреждённых",
            "Поддержка 8:00–22:00",
            "Персональный дизайнер",
            "Сохранение до 5 проектов",
        ],
    ),
    SubscriptionPlan(
        id="business", name="Бизнес", price=19900, overlays_per_month=0,
        features=[
            "Безлимитные накладки (любой размер)",
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
    overlays_used_this_month: int = 0
    started_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(days=30))

    def cancel(self) -> None:
        if self.status != SubscriptionStatus.ACTIVE:
            raise ValueError("Can only cancel active subscriptions")
        self.status = SubscriptionStatus.CANCELLED

    def use_overlay(self, count: int) -> bool:
        plan = self._get_plan()
        if not plan:
            return False
        if plan.overlays_per_month > 0 and self.overlays_used_this_month + count > plan.overlays_per_month:
            return False
        self.overlays_used_this_month += count
        return True

    @property
    def remaining_overlays(self) -> int | float:
        plan = self._get_plan()
        if not plan:
            return 0
        if plan.overlays_per_month == 0:
            return float("inf")
        return max(0, plan.overlays_per_month - self.overlays_used_this_month)

    def _get_plan(self) -> SubscriptionPlan | None:
        return next((p for p in SUBSCRIPTION_PLANS if p.id == self.plan_id), None)
