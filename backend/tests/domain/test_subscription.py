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
        assert prices == [4900, 9900, 19900]

    def test_popular_flag(self):
        popular = [p for p in SUBSCRIPTION_PLANS if p.popular]
        assert len(popular) == 1
        assert popular[0].id == "popular"

    def test_business_unlimited(self):
        biz = next(p for p in SUBSCRIPTION_PLANS if p.id == "business")
        assert biz.overlays_per_month == 0


class TestSubscription:
    def test_create(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        assert sub.status == SubscriptionStatus.ACTIVE
        assert sub.overlays_used_this_month == 0

    def test_cancel(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        sub.cancel()
        assert sub.status == SubscriptionStatus.CANCELLED

    def test_cancel_already_cancelled_raises(self):
        sub = Subscription(user_id="u1", plan_id="starter", status=SubscriptionStatus.CANCELLED)
        with pytest.raises(ValueError):
            sub.cancel()

    def test_use_overlay_starter(self):
        sub = Subscription(user_id="u1", plan_id="starter")  # 10/month
        assert sub.use_overlay(5) is True
        assert sub.overlays_used_this_month == 5

    def test_use_overlay_exceeds_limit(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        sub.use_overlay(8)
        assert sub.use_overlay(5) is False  # 8+5 > 10
        assert sub.overlays_used_this_month == 8

    def test_use_overlay_business_unlimited(self):
        sub = Subscription(user_id="u1", plan_id="business")
        assert sub.use_overlay(100) is True

    def test_remaining_overlays_starter(self):
        sub = Subscription(user_id="u1", plan_id="starter")
        sub.use_overlay(3)
        assert sub.remaining_overlays == 7

    def test_remaining_overlays_business_infinite(self):
        sub = Subscription(user_id="u1", plan_id="business")
        assert sub.remaining_overlays == float("inf")

    def test_remaining_overlays_no_plan(self):
        sub = Subscription(user_id="u1", plan_id="nonexistent")
        assert sub.remaining_overlays == 0


class TestSubscriptionTier:
    def test_values(self):
        assert SubscriptionTier.STARTER.value == "starter"
        assert SubscriptionTier.POPULAR.value == "popular"
        assert SubscriptionTier.BUSINESS.value == "business"
