"""Bootstrap script: load data from SQLite into in-memory repos and start backend."""

import asyncio
import os
import sys
import sqlite3

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.seed_data import SEED_CATEGORIES, SEED_DESIGNS
from app.infrastructure.security.jwt import hash_password
from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole, Email
from app.domain.catalog.entities import Design, Category
from app.domain.catalog.value_objects import Color


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
    from app.container import _mem_user_repo, _mem_category_repo, _mem_design_repo

    _mem_user_repo._users = []
    _mem_category_repo._categories = []
    _mem_design_repo._designs = []

    # Load data
    load_users(conn)
    load_categories(conn)
    load_designs(conn)
    load_subscription_plans(conn)
    load_shop_settings(conn)

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