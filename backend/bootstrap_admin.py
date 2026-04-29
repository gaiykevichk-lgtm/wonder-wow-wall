"""Bootstrap script: load data from SQLite into in-memory repos and start backend."""

import asyncio
import os
import sys
import sqlite3
from dotenv import load_dotenv

load_dotenv()  # Load MEDIA_STORAGE_ROOT and other env vars from .env

from app.seed_data import SEED_CATEGORIES, SEED_DESIGNS
from app.infrastructure.security.jwt import hash_password
from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole, Email
from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.value_objects import Color, PanelSize
from app.domain.catalog.panel import Panel
from app.domain.order.entities import Order, OrderItem, OrderNote
from app.domain.order.value_objects import OrderStatus, Address
from app.domain.subscription.entities import Subscription
from app.domain.visualizer.entities import VisualizationProject


def load_users(conn):
    """Load users from SQLite into in-memory repo."""
    from app.container import _mem_user_repo

    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, name, phone, role, is_blocked FROM users")
    rows = cursor.fetchall()

    for row in rows:
        user = User(
            id=row['id'],
            email=row['email'],
            password_hash=row['password_hash'],
            name=row['name'],
            phone=row['phone'] or '',
            role=UserRole(row['role']) if row['role'] else UserRole.CUSTOMER,
        )
        user.is_blocked = bool(row['is_blocked']) if row['is_blocked'] else False
        _mem_user_repo._users.append(user)

    print(f"Loaded {len(rows)} users into in-memory repo")


def load_categories(conn):
    """Load categories from SQLite into in-memory repo."""
    from app.container import _mem_category_repo

    cursor = conn.cursor()
    cursor.execute("SELECT id, name, slug, image, count FROM categories")
    rows = cursor.fetchall()

    for row in rows:
        cat = Category(
            id=row['id'],
            name=row['name'],
            slug=row['slug'],
            image=row['image'] or '',
            count=row['count'] or 0,
        )
        _mem_category_repo._categories.append(cat)

    print(f"Loaded {len(rows)} categories into in-memory repo")


def load_designs(conn):
    """Load designs from SQLite into in-memory repo."""
    from app.container import _mem_design_repo

    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, slug, category_id, style, image, description,
               price, colors, rating, reviews_count, is_new, is_popular, is_published
        FROM designs
    """)
    rows = cursor.fetchall()

    for row in rows:
        colors_data = row['colors']
        if isinstance(colors_data, str):
            import json
            colors_data = json.loads(colors_data)
        colors = [Color(c['hex'], c['name']) for c in colors_data]

        design = Design(
            id=row['id'],
            name=row['name'],
            slug=row['slug'],
            category_id=row['category_id'],
            style=row['style'] or '',
            image=row['image'] or '',
            description=row['description'] or '',
            price=row['price'] or 1200,
            colors=colors,
            rating=row['rating'] or 0.0,
            reviews_count=row['reviews_count'] or 0,
            is_new=bool(row['is_new']) if row['is_new'] else False,
            is_popular=bool(row['is_popular']) if row['is_popular'] else False,
        )
        design.is_published = bool(row['is_published']) if row['is_published'] else True
        _mem_design_repo._designs.append(design)

    print(f"Loaded {len(rows)} designs into in-memory repo")


def load_subscription_plans(conn):
    """Load subscription plans from SQLite into in-memory repo."""
    from app.container import _mem_subscription_plan_repo

    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, price, period, area_limit_m2, popular, is_active, sort_order, features
        FROM subscription_plans
    """)
    rows = cursor.fetchall()

    from app.domain.subscription.entities import SubscriptionPlan
    plans = []
    for row in rows:
        import json
        features = row['features']
        if isinstance(features, str):
            features = json.loads(features)

        plan = SubscriptionPlan(
            id=row['id'],
            name=row['name'],
            price=row['price'],
            period=row['period'],
            area_limit_m2=row['area_limit_m2'] or 0.0,
            popular=bool(row['popular']) if row['popular'] else False,
            is_active=bool(row['is_active']) if row['is_active'] else True,
            sort_order=row['sort_order'] or 0,
            features=list(features) if features else [],
        )
        plans.append(plan)

    if plans:
        _mem_subscription_plan_repo._plans = plans
        print(f"Loaded {len(plans)} subscription plans into in-memory repo")


def load_shop_settings(conn):
    """Load shop settings from SQLite into in-memory repo."""
    from app.container import _mem_shop_settings_repo

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shop_settings WHERE id = 1")
    row = cursor.fetchone()

    if row:
        from app.domain.shop.settings import ShopSettings
        settings = ShopSettings(
            design_overlay_price=row['flat_delivery_price'] or 1200,
            installation_price=row['installation_price_per_m2'] or 0,
            min_order_amount=row['free_delivery_threshold'] or 0,
        )
        _mem_shop_settings_repo._settings = settings
        print(f"Loaded shop settings into in-memory repo")


def load_panels(conn):
    """Load panels from SQLite into in-memory repo."""
    from app.container import _mem_panel_repo

    cursor = conn.cursor()
    cursor.execute("SELECT id, name, size_key, price, stock, is_active FROM panels WHERE is_active = 1")
    rows = cursor.fetchall()

    for row in rows:
        size_map = {
            'small-square': PanelSize(300, 300, "30×30 см"),
            'small-rect': PanelSize(300, 600, "30×60 см"),
            'large-square': PanelSize(600, 600, "60×60 см"),
        }
        size = size_map.get(row['size_key'], PanelSize(300, 300, "30×30 см"))
        panel = Panel(
            id=row['id'],
            name=row['name'],
            slug=row['size_key'],
            size=size,
            base_price=row['price'] or 0,
            description='',
            photo_path='',
            is_active=bool(row['is_active']) if row['is_active'] else True,
        )
        _mem_panel_repo._panels.append(panel)

    print(f"Loaded {len(rows)} panels into in-memory repo")


def load_reviews(conn):
    """Load reviews from SQLite into in-memory repo."""
    from app.container import _mem_review_repo
    from datetime import datetime

    cursor = conn.cursor()
    cursor.execute("SELECT id, design_id, user_id, user_name, rating, text, created_at FROM design_reviews")
    rows = cursor.fetchall()

    for row in rows:
        created_at = row['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace(' ', 'T'))
        review = DesignReview(
            id=row['id'],
            design_id=row['design_id'],
            user_id=row['user_id'],
            user_name=row['user_name'] or '',
            rating=row['rating'] or 5,
            text=row['text'] or '',
            created_at=created_at,
        )
        _mem_review_repo._reviews.append(review)

    print(f"Loaded {len(rows)} reviews into in-memory repo")


def load_orders(conn):
    """Load orders from SQLite into in-memory repo."""
    from app.container import _mem_order_repo
    from datetime import datetime

    cursor = conn.cursor()
    cursor.execute("SELECT id, number, user_id, status, address, total, notes, cancel_reason, created_at, updated_at FROM orders")
    rows = cursor.fetchall()

    for row in rows:
        created_at = row['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace(' ', 'T'))
        updated_at = row['updated_at']
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace(' ', 'T'))

        # Load order items
        cursor.execute("SELECT id, design_id, design_name, design_image, size_key, color, quantity, unit_price FROM order_items WHERE order_id = ?", (row['id'],))
        item_rows = cursor.fetchall()
        items = []
        for item_row in item_rows:
            items.append(OrderItem(
                id=item_row['id'],
                design_id=item_row['design_id'] or '',
                design_name=item_row['design_name'] or '',
                design_image=item_row['design_image'] or '',
                size_key=item_row['size_key'] or '',
                color=item_row['color'] or '',
                quantity=item_row['quantity'] or 1,
                unit_price=item_row['unit_price'] or 0,
            ))

        # Parse address (stored as "city,street,building,apartment,postal")
        address_str = row['address'] or ''
        addr_parts = address_str.split(',') if address_str else ['', '', '']
        address = Address(
            city=addr_parts[0] if len(addr_parts) > 0 else '',
            street=addr_parts[1] if len(addr_parts) > 1 else '',
            building=addr_parts[2] if len(addr_parts) > 2 else '',
            apartment=addr_parts[3] if len(addr_parts) > 3 else '',
            postal_code=addr_parts[4] if len(addr_parts) > 4 else '',
        )

        order = Order(
            id=row['id'],
            number=row['number'] or '',
            user_id=row['user_id'] or '',
            status=OrderStatus(row['status']) if row['status'] else OrderStatus.PLACED,
            items=items,
            address=address,
            cancel_reason=row['cancel_reason'] or None,
            notes=[],
            created_at=created_at,
            updated_at=updated_at,
        )
        _mem_order_repo._orders.append(order)

    print(f"Loaded {len(rows)} orders into in-memory repo")


def load_subscriptions(conn):
    """Load subscriptions from SQLite into in-memory repo."""
    from app.container import _mem_subscription_repo
    from datetime import datetime

    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, plan_id, status, area_used_this_month_m2, started_at, expires_at, installation_date, area_limit_m2 FROM subscriptions")
    rows = cursor.fetchall()

    for row in rows:
        started_at = row['started_at']
        if isinstance(started_at, str):
            started_at = datetime.fromisoformat(started_at.replace(' ', 'T'))
        expires_at = row['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace(' ', 'T'))

        from app.domain.subscription.value_objects import SubscriptionStatus
        sub = Subscription(
            id=row['id'],
            user_id=row['user_id'] or '',
            plan_id=row['plan_id'] or '',
            status=SubscriptionStatus(row['status']) if row['status'] else SubscriptionStatus.ACTIVE,
            area_used_this_month_m2=row['area_used_this_month_m2'] or 0.0,
            started_at=started_at,
            expires_at=expires_at,
        )
        _mem_subscription_repo._subs.append(sub)

    print(f"Loaded {len(rows)} subscriptions into in-memory repo")


def load_projects(conn):
    """Load visualization projects from SQLite into in-memory repo."""
    from app.container import _mem_visualization_repo
    import json
    from datetime import datetime

    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, name, wall_cols, wall_rows, wall_color, panels, total_price, created_at, updated_at FROM projects")
    rows = cursor.fetchall()

    for row in rows:
        created_at = row['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace(' ', 'T'))
        updated_at = row['updated_at']
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace(' ', 'T'))

        panels_json = row['panels'] or '[]'
        if isinstance(panels_json, str):
            panels_data = json.loads(panels_json)
        else:
            panels_data = panels_json

        proj = VisualizationProject(
            id=row['id'],
            user_id=row['user_id'] or '',
            name=row['name'] or '',
            wall_cols=row['wall_cols'] or 5,
            wall_rows=row['wall_rows'] or 3,
            wall_color=row['wall_color'] or '#ffffff',
            panels=panels_data,
            total_price=row['total_price'] or 0,
            created_at=created_at,
            updated_at=updated_at,
        )
        _mem_visualization_repo._projects.append(proj)

    print(f"Loaded {len(rows)} projects into in-memory repo")


def bootstrap():
    """Load all data from SQLite into in-memory repos."""
    db_path = os.environ.get('SQLITE_DB_PATH', '/home/user/wonder-wow-wall/backend/wow_wall.db')

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    print(f"Loading data from {db_path}")

    # Clear existing in-memory data
    from app.container import _mem_user_repo, _mem_category_repo, _mem_design_repo, _mem_panel_repo, _mem_review_repo, _mem_order_repo, _mem_subscription_repo, _mem_visualization_repo

    _mem_user_repo._users = []
    _mem_category_repo._categories = []
    _mem_design_repo._designs = []
    _mem_panel_repo._panels = []
    _mem_review_repo._reviews = []
    _mem_order_repo._orders = []
    _mem_subscription_repo._subs = []
    _mem_visualization_repo._projects = []

    # Load data
    load_users(conn)
    load_categories(conn)
    load_designs(conn)
    load_subscription_plans(conn)
    load_shop_settings(conn)
    load_panels(conn)
    load_reviews(conn)
    load_orders(conn)
    load_subscriptions(conn)
    # load_projects removed - 'projects' table is for constructor, not visualizer

    conn.close()

    conn.close()
    print("Bootstrap complete!")
    return True


def start_server():
    """Start uvicorn server."""
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )


def main():
    print("=" * 50)
    print("Wonder Wow Wall - Backend Bootstrap")
    print("=" * 50)

    if not bootstrap():
        sys.exit(1)

    print("\nStarting backend server on port 8001...")
    start_server()


if __name__ == "__main__":
    main()