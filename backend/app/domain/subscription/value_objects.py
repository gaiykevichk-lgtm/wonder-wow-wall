from enum import Enum


class SubscriptionTier(str, Enum):
    STARTER = "starter"
    POPULAR = "popular"
    BUSINESS = "business"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
