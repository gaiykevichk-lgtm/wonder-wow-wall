import pytest
from app.domain.subscription.entities import Subscription, SUBSCRIPTION_PLANS, SubscriptionPlan
from app.domain.subscription.value_objects import SubscriptionTier, SubscriptionStatus


class TestSubscriptionPlans:
    def test_three_plans(self):
        assert len(SUBSCRIPTION_PLANS) == 3

    def test_plan_ids(self):
        ids = [p.id for p in SUBSCRIPTION_PLANS]
        assert ids == ["starter", "popular", "business"]

    def test_plan_prices(self):
        prices = [p.price for p in SUBSCRIPTION_PLANS]
        assert prices == [7000, 12000, 18000]

    def test_popular_flag(self):
        popular = [p for p in SUBSCRIPTION_PLANS if p.popular]
        assert len(popular) == 1
        assert popular[0].id == "popular"

    def test_business_unlimited(self):
        biz = next(p for p in SUBSCRIPTION_PLANS if p.id == "business")
        assert biz.area_limit_m2 == 0

    def test_area_limits(self):
        limits = [p.area_limit_m2 for p in SUBSCRIPTION_PLANS]
        assert limits == [15, 30, 0]


class TestSubscription:
    def test_create(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        assert sub.status == SubscriptionStatus.ACTIVE
        assert sub.area_used_this_month_m2 == 0.0

    def test_cancel(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        sub.cancel()
        assert sub.status == SubscriptionStatus.CANCELLED

    def test_cancel_already_cancelled_raises(self):
        sub = Subscription(user_id="u1", plan_id="starter", status=SubscriptionStatus.CANCELLED)
        with pytest.raises(ValueError):
            sub.cancel()

    def test_use_area_starter(self):
        sub = Subscription(user_id="u1", plan_id="starter")  # 15 m²/month
        assert sub.use_area(5.0) is True
        assert sub.area_used_this_month_m2 == 5.0

    def test_use_area_exceeds_limit(self):
        sub = Subscription(user_id="u1", plan_id="starter")  # 15 m²
        sub.use_area(12.0)
        assert sub.use_area(5.0) is False  # 12+5 > 15
        assert sub.area_used_this_month_m2 == 12.0

    def test_use_area_business_unlimited(self):
        sub = Subscription(user_id="u1", plan_id="business")
        assert sub.use_area(100.0) is True

    def test_remaining_area_starter(self):
        sub = Subscription(user_id="u1", plan_id="starter")  # 15 m²
        sub.use_area(3.0)
        assert sub.remaining_area_m2 == 12.0

    def test_remaining_area_business_infinite(self):
        sub = Subscription(user_id="u1", plan_id="business")
        assert sub.remaining_area_m2 == float("inf")

    def test_remaining_area_no_plan(self):
        sub = Subscription(user_id="u1", plan_id="nonexistent")
        assert sub.remaining_area_m2 == 0.0


class TestSubscriptionTier:
    def test_values(self):
        assert SubscriptionTier.STARTER.value == "starter"
        assert SubscriptionTier.POPULAR.value == "popular"
        assert SubscriptionTier.BUSINESS.value == "business"
