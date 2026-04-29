"""Enrich SQLite with demo data for all admin dashboard widgets.

Run ONCE after setup_sqlite.py has created the initial DB.
"""
import sqlite3
import json
import uuid
import os
from datetime import datetime, timedelta

DB_PATH = "/home/user/wonder-wow-wall/backend/wow_wall.db"


def get_password_hash(password: str) -> str:
    import hashlib
    salt = "wow-wall-salt"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def iso(days_back: int) -> str:
    """Return ISO timestamp `days_back` days from today."""
    dt = datetime.now() - timedelta(days=days_back)
    return dt.isoformat()


def enrich(conn):
    cursor = conn.cursor()
    now = datetime.now()
    print("=== Enriching demo data ===")

    # ── More customers ───────────────────────────────────────────────────────
    customers = [
        ("u-ivan",    "ivan@example.com",      "Иван",     "+79001001001"),
        ("u-petr",    "petr@example.com",       "Пётр",     "+79001001002"),
        ("u-anna",    "anna@example.com",       "Анна",     "+79001001003"),
        ("u-olga",    "olga@example.com",       "Ольга",    "+79001001004"),
        ("u-dmitry",  "dmitry@example.com",     "Дмитрий",  "+79001001005"),
        ("u-kate",    "kate@example.com",       "Екатерина","+79001001006"),
        ("u-sergey",  "sergey@example.com",     "Сергей",   "+79001001007"),
        ("u-natalia", "natalia@example.com",    "Наталья",  "+79001001008"),
        ("u-alex",    "alex@example.com",       "Александр","+79001001009"),
        ("u-irina",   "irina@example.com",      "Ирина",    "+79001001010"),
        ("u-maxim",   "maxim@example.com",      "Максим",   "+79001001011"),
        ("u-vladimir","vladimir@example.com",   "Владимир", "+79001001012"),
        ("u-tanya",   "tanya@example.com",      "Татьяна",  "+79001001013"),
        ("u-andrey",  "andrey@example.com",     "Андрей",   "+79001001014"),
        ("u-yulia",   "yulia@example.com",      "Юлия",    "+79001001015"),
        ("u-nikolay", "nikolay@example.com",    "Николай", "+79001001016"),
    ]

    # Add missing customers (skip admin-root and c1-c3 which already exist)
    existing_emails = set(r[0] for r in cursor.execute("SELECT email FROM users").fetchall())
    for uid, email, name, phone in customers:
        if email in existing_emails:
            continue
        created = iso(90)
        cursor.execute("""
            INSERT INTO users (id, email, password_hash, name, phone, role, created_at, is_blocked)
            VALUES (?, ?, ?, ?, ?, 'CUSTOMER', ?, 0)
        """, (uid, email, get_password_hash("password123"), name, phone, created))

    print(f"Users: {len(customers)} seeded")

    # ── Get design IDs ────────────────────────────────────────────────────────
    design_ids = [r[0] for r in cursor.execute("SELECT id FROM designs").fetchall()]
    if not design_ids:
        print("WARNING: No designs found!")
        design_ids = ["d-1", "d-2", "d-3"]

    # ── Get plan IDs ─────────────────────────────────────────────────────────
    plan_ids = [r[0] for r in cursor.execute("SELECT id FROM subscription_plans").fetchall()]
    if not plan_ids:
        plan_ids = ["plan-basic", "plan-comfort", "plan-premium"]

    # ── Orders (40 orders over 90 days) ───────────────────────────────────────
    statuses = ["placed", "confirmed", "in_progress", "delivered", "installed", "cancelled", "refunded"]
    status_weights = [15, 10, 8, 12, 5, 3, 2]  # weighted distribution

    cities = [
        ("Москва", "ул. Пушкина", "д. 10", "кв. 5", "101000"),
        ("Санкт-Петербург", "Невский пр.", "д. 100", "кв. 42", "190000"),
        ("Новосибирск", "Красный пр.", "д. 77", "кв. 18", "630000"),
        ("Екатеринбург", "Ленина", "д. 25", "кв. 303", "620000"),
        ("Казань", "Московская", "д. 3", "кв. 12", "420000"),
        ("Краснодар", "Красная", "д. 55", "кв. 88", "350000"),
        ("Москва", "Тверская", "д. 1", "кв. 77", "125009"),
        ("Сочи", "Курортная", "д. 8", "кв. 22", "354002"),
        ("Владивосток", "Светланская", "д. 100", "кв. 5", "690000"),
    ]

    size_keys = ["30x30", "30x60", "60x60", "30x30", "30x60", "60x60", "30x30"]
    unit_prices = [1200, 1800, 2400, 1200, 1800, 2400, 1200]

    existing_orders = set(r[0] for r in cursor.execute("SELECT id FROM orders").fetchall())

    import random
    random.seed(42)
    order_num = 1000

    orders_to_insert = []
    for day in range(90, -1, -1):
        n_orders = random.choices([0, 1, 1, 2, 2, 3], weights=[40, 25, 20, 10, 4, 1])[0]
        for _ in range(n_orders):
            order_num += 1
            oid = f"ord-{uuid.uuid4().hex[:8]}"
            if oid in existing_orders:
                continue
            user = random.choice(customers)
            status = random.choices(statuses, weights=status_weights)[0]

            city_data = random.choice(cities)
            address = json.dumps({
                "city": city_data[0],
                "street": city_data[1],
                "building": city_data[2],
                "apartment": city_data[3],
                "postal_code": city_data[4],
            })

            created_days_ago = day + random.randint(0, 2)
            created = iso(created_days_ago)
            updated = iso(max(0, created_days_ago - random.randint(0, 3)))

            total = random.choice([2400, 3600, 4800, 7200, 9600, 12000, 14400, 19200, 24000])
            orders_to_insert.append((oid, f"WOW-{order_num}", user[0], status, address, total, created, updated))

    for o in orders_to_insert:
        cursor.execute("""
            INSERT INTO orders (id, number, user_id, status, address, total, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, o)

    print(f"Orders: {len(orders_to_insert)} seeded")

    # ── Order items ──────────────────────────────────────────────────────────
    existing_items = set(r[0] for r in cursor.execute("SELECT id FROM order_items").fetchall())
    items_to_insert = []

    for oid_row in cursor.execute("SELECT id, user_id, total FROM orders").fetchall():
        oid = oid_row[0]
        # Each order has 1-4 items
        n_items = random.randint(1, 4)
        for _ in range(n_items):
            item_id = f"item-{uuid.uuid4().hex[:8]}"
            if item_id in existing_items:
                continue
            design = random.choice(design_ids)
            size_key = random.choice(size_keys)
            price = random.choice(unit_prices)
            qty = random.randint(1, 3)
            color = random.choice(["Белый", "Чёрный", "Серый", "Бежевый", "Коричневый"])

            # Get design name
            design_name = cursor.execute("SELECT name FROM designs WHERE id = ?", (design,)).fetchone()
            design_name = design_name[0] if design_name else "Дизайн"
            design_image = cursor.execute("SELECT image FROM designs WHERE id = ?", (design,)).fetchone()
            design_image = design_image[0] if design_image else ""

            items_to_insert.append((
                item_id, oid, design, design_name, design_image,
                size_key, color, qty, price
            ))

    for item in items_to_insert:
        cursor.execute("""
            INSERT INTO order_items (id, order_id, design_id, design_name, design_image, size_key, color, quantity, unit_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, item)

    print(f"Order items: {len(items_to_insert)} seeded")

    # ── Subscriptions ─────────────────────────────────────────────────────────
    existing_subs = set(r[0] for r in cursor.execute("SELECT id FROM subscriptions").fetchall())
    sub_statuses = ["active", "active", "active", "cancelled", "expired"]

    for i, user in enumerate(customers[:12]):
        sid = f"sub-{i+1}"
        if sid in existing_subs:
            continue
        plan_id = random.choice(plan_ids)
        status = random.choice(sub_statuses)
        started = iso(random.randint(10, 80))
        expires = iso(-random.randint(10, 30)) if status in ("cancelled", "expired") else iso(random.randint(10, 60))
        area = round(random.uniform(0.5, 4.5), 1)

        cursor.execute("""
            INSERT INTO subscriptions (id, user_id, plan_id, status, area_used_this_month_m2, started_at, expires_at, installation_date, area_limit_m2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sid, user[0], plan_id, status, area, started, expires, None, 5.0))

    print(f"Subscriptions seeded")

    # ── Constructor projects (for abandoned_carts) ───────────────────────────
    existing_projects = set(r[0] for r in cursor.execute("SELECT id FROM projects").fetchall())

    for i, user in enumerate(customers[:8]):
        pid = f"proj-{i+1}"
        if pid in existing_projects:
            continue
        created = iso(random.randint(5, 85))
        updated = iso(random.randint(0, 4))
        panels = json.dumps([{"design_id": random.choice(design_ids), "x": j % 5, "y": j // 5}
                            for j in range(random.randint(3, 15))])
        total_price = random.randint(3600, 24000)

        cursor.execute("""
            INSERT INTO projects (id, user_id, name, wall_cols, wall_rows, wall_color, panels, total_price, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (pid, user[0], f"Проект {i+1}", 5, 3, "#ffffff", panels, total_price, created, updated))

    print(f"Constructor projects seeded")

    # ── Visualization projects (for tool_usage) ─────────────────────────────
    existing_viz = set(r[0] for r in cursor.execute("SELECT id FROM visualization_projects").fetchall())

    for i, user in enumerate(customers[:6]):
        vid = f"viz-{i+1}"
        if vid in existing_viz:
            continue
        created = iso(random.randint(5, 85))
        updated = iso(random.randint(0, 3))
        status = random.choice(["draft", "active", "completed"])

        cursor.execute("""
            INSERT INTO visualization_projects (id, user_id, name, wall_photo_path, wall_mask_path, scene_data, status, created_at, updated_at, perspective_calibration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (vid, user[0], f"Визуализация {i+1}", "", "", "{}", status, created, updated, "{}"))

    print(f"Visualization projects seeded")

    # ── Reviews ────────────────────────────────────────────────────────────────
    existing_reviews = set(r[0] for r in cursor.execute("SELECT id FROM design_reviews").fetchall())
    review_texts = [
        "Отличное качество! Легко крепится, выглядит премиально.",
        "Хороший продукт, быстрая доставка.",
        "Поменял интерьер за выходные. Рекомендую!",
        "Доволен покупкой. Цена соответствует качеству.",
        "Устанавливал сам, справился за час.",
        "Красивый дизайн, но были небольшие сколы при доставке.",
        "Превосходно смотрится в интерьере. Гости спрашивают где брал.",
        "Держится уже полгода — как новое!",
        "Не ожидал такого качества за эти деньги.",
        "Спасибо за консультацию по выбору размера!",
    ]

    for design_id in design_ids[:8]:
        n_reviews = random.randint(1, 4)
        for j in range(n_reviews):
            rid = f"rev-{design_id}-{j}"
            if rid in existing_reviews:
                continue
            user = random.choice(customers)
            rating = random.randint(4, 5)
            text = random.choice(review_texts)
            created = iso(random.randint(10, 85))
            cursor.execute("""
                INSERT INTO design_reviews (id, design_id, user_id, user_name, rating, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rid, design_id, user[0], user[2], rating, text, created))

    print(f"Reviews seeded")

    # ── Banners ───────────────────────────────────────────────────────────────
    existing_banners = set(r[0] for r in cursor.execute("SELECT id FROM banners").fetchall())
    banners = [
        ("banner-1", "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=400&fit=crop", "", "Новая коллекция весна-лето 2026", 1, 1),
        ("banner-2", "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=400&fit=crop", "", "Скидка 20% на Premium панели", 1, 2),
        ("banner-3", "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=1200&h=400&fit=crop", "", "Бесплатный замер + монтаж", 1, 3),
    ]
    for b in banners:
        if b[0] not in existing_banners:
            cursor.execute("""
                INSERT INTO banners (id, image_url, link, title, is_active, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (*b, iso(60)))

    print(f"Banners seeded")

    conn.commit()
    print("=== Enrichment complete ===")

    # Verify counts
    for table, col in [
        ("users", "id"), ("orders", "id"), ("order_items", "id"),
        ("subscriptions", "id"), ("projects", "id"),
        ("visualization_projects", "id"), ("design_reviews", "id"),
    ]:
        cnt = cursor.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table}: {cnt}")


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print(f"ERROR: {DB_PATH} not found. Run setup_sqlite.py first.")
        exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    enrich(conn)
    conn.close()