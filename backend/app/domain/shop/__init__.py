"""Shop bounded context — admin-managed runtime settings & banners.

Phase 8A introduces `ShopSettings` (singleton row of business knobs:
overlay price, installation fee, min-order). Phase 8B will add the
`Banner` aggregate (homepage hero rotation). Phase 8C will move
`SubscriptionPlan` from a hardcoded module constant into a CRUD entity
so the admin can tweak tariff prices without a deploy.

The three live in the same domain because they share the same admin
audience ("Shop" tab in the admin panel) and similar update cadence
(settings change rarely; the constructor + catalog read them through
TanStack Query with a 5-min cache).
"""
