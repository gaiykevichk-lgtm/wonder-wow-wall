from app.domain.catalog.value_objects import BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE


def calculate_panel_cost(size_key: str, quantity: int, has_subscription: bool = False) -> int:
    """Calculate total cost for panels of a given size."""
    base = BASE_PANEL_PRICES.get(size_key, 0)
    overlay = 0 if has_subscription else DESIGN_OVERLAY_PRICE
    return (base + overlay) * quantity


def calculate_wall_cost(
    panels: list[dict],
    has_subscription: bool = False,
) -> dict:
    """Calculate total wall cost from a list of panel specs.

    Each panel dict: {"size_key": "300x300", "quantity": 4}
    """
    total_base = 0
    total_overlay = 0
    total_panels = 0

    for p in panels:
        size_key = p["size_key"]
        qty = p["quantity"]
        base_price = BASE_PANEL_PRICES.get(size_key, 0)
        total_base += base_price * qty
        if not has_subscription:
            total_overlay += DESIGN_OVERLAY_PRICE * qty
        total_panels += qty

    return {
        "total_panels": total_panels,
        "total_base": total_base,
        "total_overlay": total_overlay,
        "total": total_base + total_overlay,
        "subscription_savings": DESIGN_OVERLAY_PRICE * total_panels if has_subscription else 0,
    }
