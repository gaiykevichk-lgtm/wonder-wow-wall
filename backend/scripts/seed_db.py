"""Seed the PostgreSQL database with rich demo data for admin demonstrations.

Seeds:
  - categories + designs (with real Unsplash image URLs)
  - subscription plans
  - panels (base SKU)
  - admin + demo users (bcrypt hashed passwords)
  - orders spanning 90 days (various statuses)
  - subscriptions
  - project saves
  - design reviews

Usage:
    cd backend && python -m scripts.seed_db

Requires DATABASE_URL in .env or environment.
"""

import asyncio
from datetime import datetime, timedelta
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.seed_data import (
    categories_as_dicts,
    designs_as_dicts,
    SEED_SUBSCRIPTION_PLANS,
    SEED_PANELS,
)


def _bcrypt_hash(password: str) -> str:
    """Derive a bcrypt hash for demo passwords."""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _make_password_hash():
    # pre-computed hash for "password123" — same for all demo accounts so
    # the admin can log in with any of them using that single password.
    # Python bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
    return "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYXqKOO.fUy"


# ─── Seeded entities ────────────────────────────────────────────────────────────

def _users() -> list[dict]:
    pw_hash = _make_password_hash()
    now = datetime.utcnow()
    return [
        {
            "id": "user-admin",
            "email": "admin@wonderwow.ru",
            "password_hash": pw_hash,
            "name": "Администратор",
            "phone": "+7 495 123-45-67",
            "role": "ADMIN",
            "is_blocked": False,
            "created_at": now - timedelta(days=95),
        },
        {
            "id": "user-anna",
            "email": "anna@example.com",
            "password_hash": pw_hash,
            "name": "Анна Ковалёва",
            "phone": "+7 916 234-56-78",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=87),
        },
        {
            "id": "user-mikhail",
            "email": "mikhail@example.com",
            "password_hash": pw_hash,
            "name": "Михаил Соколов",
            "phone": "+7 925 345-67-89",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=78),
        },
        {
            "id": "user-elena",
            "email": "elena@example.com",
            "password_hash": pw_hash,
            "name": "Елена Волкова",
            "phone": "+7 903 456-78-90",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=65),
        },
        {
            "id": "user-dmitry",
            "email": "dmitry@example.com",
            "password_hash": pw_hash,
            "name": "Дмитрий Петров",
            "phone": "+7 926 567-89-01",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=54),
        },
        {
            "id": "user-oleg",
            "email": "oleg@example.com",
            "password_hash": pw_hash,
            "name": "Олег Новиков",
            "phone": "+7 915 678-90-12",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=43),
        },
        {
            "id": "user-irina",
            "email": "irina@example.com",
            "password_hash": pw_hash,
            "name": "Ирина Павлова",
            "phone": "+7 977 789-01-23",
            "role": "CUSTOMER",
            "is_blocked": False,
            "created_at": now - timedelta(days=30),
        },
        {
            "id": "user-blocked",
            "email": "blocked@example.com",
            "password_hash": pw_hash,
            "name": "Заблокированный пользователь",
            "phone": "+7 999 999-99-99",
            "role": "CUSTOMER",
            "is_blocked": True,
            "created_at": now - timedelta(days=20),
        },
    ]


def _addresses() -> list[dict]:
    return [
        # Anna
        {"id": "addr-1", "user_id": "user-anna", "label": "Квартира",
         "city": "Москва", "street": "ул. Лесная", "building": "д. 12",
         "apartment": "кв. 45", "postal_code": "125080", "is_default": True},
        # Mikhail
        {"id": "addr-2", "user_id": "user-mikhail", "label": "Офис",
         "city": "Москва", "street": "ул. Пушкина", "building": "д. 5",
         "apartment": "оф. 301", "postal_code": "123456", "is_default": True},
        {"id": "addr-3", "user_id": "user-mikhail", "label": "Склад",
         "city": "Москва", "street": "ш. Энтузиастов", "building": "д. 88",
         "apartment": "", "postal_code": "123321", "is_default": False},
        # Elena
        {"id": "addr-4", "user_id": "user-elena", "label": "Дом",
         "city": "Санкт-Петербург", "street": "Невский пр.", "building": "д. 100",
         "apartment": "кв. 22", "postal_code": "191025", "is_default": True},
        # Dmitry
        {"id": "addr-5", "user_id": "user-dmitry", "label": "Квартира",
         "city": "Москва", "street": "ул. Вавилова", "building": "д. 7",
         "apartment": "кв. 88", "postal_code": "117312", "is_default": True},
        # Oleg
        {"id": "addr-6", "user_id": "user-oleg", "label": "Таунхаус",
         "city": "Москва", "street": "б-р Осенний", "building": "д. 18",
         "apartment": "", "postal_code": "121609", "is_default": True},
        # Irina
        {"id": "addr-7", "user_id": "user-irina", "label": "Квартира",
         "city": "Казань", "street": "ул. Баумана", "building": "д. 42",
         "apartment": "кв. 15", "postal_code": "420111", "is_default": True},
    ]


def _orders(now: datetime) -> list[dict]:
    """Generate orders spread across 90 days with varied statuses."""
    seq = 1000

    def seq_num():
        nonlocal seq
        seq += 1
        return f"WOW-{seq}"

    orders = [
        # Fully installed — happy path (oldest)
        {
            "id": "order-1", "number": seq_num(), "user_id": "user-anna",
            "status": "installed",
            "address": "Москва, ул. Лесная, д. 12, кв. 45, 125080",
            "total": 8900,
            "installation_date": now - timedelta(days=75),
            "created_at": now - timedelta(days=85),
        },
        # Installed — no installation date
        {
            "id": "order-2", "number": seq_num(), "user_id": "user-anna",
            "status": "installed",
            "address": "Москва, ул. Лесная, д. 12, кв. 45, 125080",
            "total": 4970,
            "created_at": now - timedelta(days=70),
        },
        # Delivered
        {
            "id": "order-3", "number": seq_num(), "user_id": "user-mikhail",
            "status": "delivered",
            "address": "Москва, ул. Пушкина, д. 5, оф. 301, 123456",
            "total": 13900,
            "installation_date": now + timedelta(days=3),
            "created_at": now - timedelta(days=14),
        },
        # In progress
        {
            "id": "order-4", "number": seq_num(), "user_id": "user-mikhail",
            "status": "in_progress",
            "address": "Москва, ш. Энтузиастов, д. 88, 123321",
            "total": 6960,
            "created_at": now - timedelta(days=7),
        },
        # Confirmed — recent
        {
            "id": "order-5", "number": seq_num(), "user_id": "user-elena",
            "status": "confirmed",
            "address": "Санкт-Петербург, Невский пр., д. 100, кв. 22, 191025",
            "total": 3380,
            "created_at": now - timedelta(days=4),
        },
        # Placed — very recent, in cart
        {
            "id": "order-6", "number": seq_num(), "user_id": "user-dmitry",
            "status": "placed",
            "address": "Москва, ул. Вавилова, д. 7, кв. 88, 117312",
            "total": 2480,
            "created_at": now - timedelta(days=1),
        },
        # Cancelled
        {
            "id": "order-7", "number": seq_num(), "user_id": "user-oleg",
            "status": "cancelled",
            "address": "Москва, б-р Осенний, д. 18, 121609",
            "total": 3380,
            "cancel_reason": "Передумали, решили делать ремонт позже",
            "created_at": now - timedelta(days=21),
        },
        # Refunded
        {
            "id": "order-8", "number": seq_num(), "user_id": "user-irina",
            "status": "refunded",
            "address": "Казань, ул. Баумана, д. 42, кв. 15, 420111",
            "total": 4970,
            "cancel_reason": "Товар не подошёл по размеру",
            "created_at": now - timedelta(days=35),
        },
        # Placed — new today
        {
            "id": "order-9", "number": seq_num(), "user_id": "user-irina",
            "status": "placed",
            "address": "Казань, ул. Баумана, д. 42, кв. 15, 420111",
            "total": 1490,
            "created_at": now,
        },
    ]
    return orders


def _order_items() -> list[dict]:
    return [
        # order-1 — Annas first large order
        {"id": "oi-1",  "order_id": "order-1", "design_id": "design-oak-classic",
         "design_name": "Дубовая классика", "design_image": "https://images.unsplash.com/photo-1644925757334-d0397c01518c?w=600&h=600&fit=crop",
         "size_key": "300x300", "color": "Натуральный дуб", "quantity": 3, "unit_price": 890},
        {"id": "oi-2",  "order_id": "order-1", "design_id": "design-marble",
         "design_name": "Белый мрамор", "design_image": "https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=600&h=600&fit=crop",
         "size_key": "600x600", "color": "Каррара", "quantity": 2, "unit_price": 2490},
        # order-2
        {"id": "oi-3",  "order_id": "order-2", "design_id": "design-concrete",
         "design_name": "Бетон лофт", "design_image": "https://images.unsplash.com/photo-1711606329941-63c1af645a53?w=600&h=600&fit=crop",
         "size_key": "300x600", "color": "Светлый бетон", "quantity": 2, "unit_price": 1490},
        {"id": "oi-4",  "order_id": "order-2", "design_id": "design-waves",
         "design_name": "Волны", "design_image": "https://images.unsplash.com/photo-1740686004244-e9bc7c75d8e5?w=600&h=600&fit=crop",
         "size_key": "300x300", "color": "Индиго", "quantity": 1, "unit_price": 890},
        # order-3
        {"id": "oi-5",  "order_id": "order-3", "design_id": "design-gradient",
         "design_name": "Градиент", "design_image": "https://images.unsplash.com/photo-1690382285917-73dfd2a22d07?w=600&h=600&fit=crop",
         "size_key": "60x60", "color": "Закат", "quantity": 5, "unit_price": 2490},
        {"id": "oi-6",  "order_id": "order-3", "design_id": "design-hexagon",
         "design_name": "Гексагон", "design_image": "https://images.unsplash.com/photo-1582135739786-3bceafcaea85?w=600&h=600&fit=crop",
         "size_key": "30x30", "color": "Графит", "quantity": 2, "unit_price": 890},
        # order-4
        {"id": "oi-7",  "order_id": "order-4", "design_id": "design-botanical",
         "design_name": "Ботаника", "design_image": "https://images.unsplash.com/photo-1682698992719-966a930ccc90?w=600&h=600&fit=crop",
         "size_key": "30x60", "color": "Крем", "quantity": 3, "unit_price": 1490},
        {"id": "oi-8",  "order_id": "order-4", "design_id": "design-tropical",
         "design_name": "Тропики", "design_image": "https://images.unsplash.com/photo-1722109997425-40f920848aed?w=600&h=600&fit=crop",
         "size_key": "30x30", "color": "Зелёный", "quantity": 2, "unit_price": 890},
        # order-5
        {"id": "oi-9",  "order_id": "order-5", "design_id": "design-lines",
         "design_name": "Линии", "design_image": "https://images.unsplash.com/photo-1711606404173-0a45c4735639?w=600&h=600&fit=crop",
         "size_key": "30x60", "color": "Белый", "quantity": 2, "unit_price": 1490},
        # order-6
        {"id": "oi-10", "order_id": "order-6", "design_id": "design-pure-white",
         "design_name": "Чистый белый", "design_image": "https://images.unsplash.com/photo-1584530313715-bfe628686135?w=600&h=600&fit=crop",
         "size_key": "60x60", "color": "Белый", "quantity": 1, "unit_price": 2480},
        # order-7
        {"id": "oi-11", "order_id": "order-7", "design_id": "design-concrete",
         "design_name": "Бетон лофт", "design_image": "https://images.unsplash.com/photo-1711606329941-63c1af645a53?w=600&h=600&fit=crop",
         "size_key": "30x60", "color": "Тёмный бетон", "quantity": 2, "unit_price": 1490},
        # order-8
        {"id": "oi-12", "order_id": "order-8", "design_id": "design-walnut",
         "design_name": "Американский орех", "design_image": "https://images.unsplash.com/photo-1611072337226-1140ab367200?w=600&h=600&fit=crop",
         "size_key": "60x60", "color": "Тёмный орех", "quantity": 2, "unit_price": 2490},
        # order-9
        {"id": "oi-13", "order_id": "order-9", "design_id": "design-ash",
         "design_name": "Ясень скандинавский", "design_image": "https://images.unsplash.com/photo-1763392199096-6efd9d28d8cc?w=600&h=600&fit=crop",
         "size_key": "30x30", "color": "Натуральный", "quantity": 1, "unit_price": 1490},
    ]


def _subscriptions(now: datetime) -> list[dict]:
    return [
        {
            "id": "sub-1", "user_id": "user-anna",
            "plan_id": "popular", "status": "active",
            "area_used_this_month_m2": 4.2,
            "started_at": now - timedelta(days=80),
            "expires_at": now + timedelta(days=10),
        },
        {
            "id": "sub-2", "user_id": "user-mikhail",
            "plan_id": "starter", "status": "active",
            "area_used_this_month_m2": 12.8,
            "started_at": now - timedelta(days=45),
            "expires_at": now + timedelta(days=15),
        },
        {
            "id": "sub-3", "user_id": "user-elena",
            "plan_id": "business", "status": "cancelled",
            "area_used_this_month_m2": 0.0,
            "started_at": now - timedelta(days=90),
            "expires_at": now - timedelta(days=60),
        },
        {
            "id": "sub-4", "user_id": "user-dmitry",
            "plan_id": "starter", "status": "active",
            "area_used_this_month_m2": 3.5,
            "started_at": now - timedelta(days=15),
            "expires_at": now + timedelta(days=15),
        },
    ]


def _projects(now: datetime) -> list[dict]:
    return [
        {
            "id": "proj-1", "user_id": "user-anna",
            "name": "Гостиная в дубовых тонах",
            "wall_cols": 5, "wall_rows": 3, "wall_color": "#F5F5F0",
            "panels": [
                {"design_id": "design-oak-classic", "col": 0, "row": 0, "size_key": "300x300"},
                {"design_id": "design-oak-classic", "col": 1, "row": 0, "size_key": "300x300"},
                {"design_id": "design-marble", "col": 2, "row": 0, "size_key": "600x600"},
                {"design_id": "design-marble", "col": 0, "row": 1, "size_key": "600x600"},
                {"design_id": "design-concrete", "col": 3, "row": 1, "size_key": "300x600"},
            ],
            "total_price": 7650,
            "created_at": now - timedelta(days=60),
        },
        {
            "id": "proj-2", "user_id": "user-mikhail",
            "name": "Кабинет — бетон и градиент",
            "wall_cols": 4, "wall_rows": 2, "wall_color": "#2C2C2C",
            "panels": [
                {"design_id": "design-concrete", "col": 0, "row": 0, "size_key": "300x600"},
                {"design_id": "design-gradient", "col": 1, "row": 0, "size_key": "300x600"},
                {"design_id": "design-lines", "col": 2, "row": 0, "size_key": "30x30"},
                {"design_id": "design-lines", "col": 3, "row": 0, "size_key": "30x30"},
            ],
            "total_price": 4970,
            "created_at": now - timedelta(days=20),
        },
        {
            "id": "proj-3", "user_id": "user-dmitry",
            "name": "Спальня — минимализм",
            "wall_cols": 6, "wall_rows": 2, "wall_color": "#FAFAFA",
            "panels": [
                {"design_id": "design-pure-white", "col": 0, "row": 0, "size_key": "600x600"},
                {"design_id": "design-pure-white", "col": 1, "row": 0, "size_key": "600x600"},
                {"design_id": "design-tropical", "col": 2, "row": 0, "size_key": "30x60"},
                {"design_id": "design-botanical", "col": 3, "row": 0, "size_key": "30x60"},
            ],
            "total_price": 3380,
            "created_at": now - timedelta(days=5),
        },
    ]


def _reviews(now: datetime) -> list[dict]:
    return [
        {
            "id": "review-1", "design_id": "design-oak-classic",
            "user_id": "user-anna", "user_name": "Анна К.",
            "rating": 5,
            "text": "Установили панели с дубовой накладкой в гостиной. Монтаж на магниты — 2 часа, результат потрясающий! Все гости спрашивают, откуда такая красота.",
            "created_at": now - timedelta(days=75),
        },
        {
            "id": "review-2", "design_id": "design-marble",
            "user_id": "user-elena", "user_name": "Елена В.",
            "rating": 4,
            "text": "Отличное качество мраморных накладок. Стена стала настоящим арт-объектом. Рекомендую!",
            "created_at": now - timedelta(days=60),
        },
        {
            "id": "review-3", "design_id": "design-concrete",
            "user_id": "user-dmitry", "user_name": "Дмитрий П.",
            "rating": 5,
            "text": "Самое крутое — это то, что все накладки стоят одинаково. Никаких сюрпризов с ценой. Бетон лофт выглядит роскошно.",
            "created_at": now - timedelta(days=45),
        },
        {
            "id": "review-4", "design_id": "design-waves",
            "user_id": "user-mikhail", "user_name": "Михаил С.",
            "rating": 5,
            "text": "Конструктор на сайте помог подобрать идеальную комбинацию. Взял подписку — теперь меняю дизайн накладок каждый сезон.",
            "created_at": now - timedelta(days=30),
        },
        {
            "id": "review-5", "design_id": "design-gradient",
            "user_id": "user-irina", "user_name": "Ирина П.",
            "rating": 4,
            "text": "Градиент в спальне — настоящее произведение искусства. Качество печати отличное, цвета сочные.",
            "created_at": now - timedelta(days=15),
        },
        {
            "id": "review-6", "design_id": "design-hexagon",
            "user_id": "user-oleg", "user_name": "Олег Н.",
            "rating": 5,
            "text": "Гексагон на кухонном фартуке — это что-то невероятное. Все спрашивают, где я такое нашёл.",
            "created_at": now - timedelta(days=8),
        },
    ]


def _visualization_projects(now: datetime) -> list[dict]:
    return [
        {
            "id": "vis-1", "user_id": "user-anna",
            "name": "Стена гостиной — фото",
            "photo_url": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=800&fit=crop",
            "photo_width": 1200, "photo_height": 800,
            "wall_mask_base64": "", "panels_json": [
                {"design_id": "design-oak-classic", "x": 100, "y": 100, "w": 300, "h": 300, "size_key": "300x300"},
                {"design_id": "design-marble", "x": 400, "y": 100, "w": 600, "h": 600, "size_key": "600x600"},
            ],
            "placement_mode": "manual",
            "created_at": now - timedelta(days=50),
        },
        {
            "id": "vis-2", "user_id": "user-mikhail",
            "name": "Кабинет — загруженное фото",
            "photo_url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop",
            "photo_width": 1200, "photo_height": 800,
            "wall_mask_base64": "", "panels_json": [
                {"design_id": "design-concrete", "x": 50, "y": 50, "w": 300, "h": 600, "size_key": "300x600"},
            ],
            "placement_mode": "manual",
            "created_at": now - timedelta(days=18),
        },
    ]


# ─── Main seeder ──────────────────────────────────────────────────────────────

async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # ── Check if already seeded ─────────────────────────────────────────
        result = await session.execute(text("SELECT count(*) FROM categories"))
        count = result.scalar() or 0
        if count > 0:
            print(f"Database already has {count} categories — skipping seed.")
            await engine.dispose()
            return

        now = datetime.utcnow()

        # ── Categories + Designs ───────────────────────────────────────────
        for cat in categories_as_dicts():
            await session.execute(
                text("INSERT INTO categories (id, name, slug, image, count) VALUES (:id, :name, :slug, :image, :count)"),
                cat,
            )

        for d in designs_as_dicts():
            await session.execute(
                text("""INSERT INTO designs (id, name, slug, category_id, style, image, description, price, colors, rating, reviews_count, is_new, is_popular, is_published)
                         VALUES (:id, :name, :slug, :category_id, :style, :image, :description, :price, :colors, :rating, :reviews_count, :is_new, :is_popular, :is_published)"""),
                d,
            )

        # ── Subscription plans ────────────────────────────────────────────────
        for plan in SEED_SUBSCRIPTION_PLANS:
            await session.execute(
                text("""INSERT INTO subscription_plans (id, name, price, period, area_limit_m2, popular, is_active, sort_order, features)
                         VALUES (:id, :name, :price, :period, :area_limit_m2, :popular, :is_active, :sort_order, :features)"""),
                {**plan, "features": plan["features"]},
            )

        # ── Panels ───────────────────────────────────────────────────────────
        for panel in SEED_PANELS:
            await session.execute(
                text("""INSERT INTO panels (id, name, slug, width_mm, height_mm, size_label, base_price, description, photo_path, is_active)
                       VALUES (:id, :name, :slug, :width_mm, :height_mm, :size_label, :base_price, :description, :photo_path, :is_active)"""),
                panel,
            )

        # ── Users ────────────────────────────────────────────────────────────
        for u in _users():
            await session.execute(
                text("""INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, created_at)
                       VALUES (:id, :email, :password_hash, :name, :phone, :role, :is_blocked, :created_at)"""),
                u,
            )

        # ── Addresses ───────────────────────────────────────────────────────
        for a in _addresses():
            await session.execute(
                text("""INSERT INTO user_addresses (id, user_id, label, city, street, building, apartment, postal_code, is_default)
                       VALUES (:id, :user_id, :label, :city, :street, :building, :apartment, :postal_code, :is_default)"""),
                a,
            )

        # ── Orders ───────────────────────────────────────────────────────────
        for o in _orders(now):
            await session.execute(
                text("""INSERT INTO orders (id, number, user_id, status, address, total, installation_date, cancel_reason, created_at)
                       VALUES (:id, :number, :user_id, :status, :address, :total, :installation_date, :cancel_reason, :created_at)"""),
                o,
            )

        # ── Order items ─────────────────────────────────────────────────────
        for oi in _order_items():
            await session.execute(
                text("""INSERT INTO order_items (id, order_id, design_id, design_name, design_image, size_key, color, quantity, unit_price)
                       VALUES (:id, :order_id, :design_id, :design_name, :design_image, :size_key, :color, :quantity, :unit_price)"""),
                oi,
            )

        # ── Subscriptions ────────────────────────────────────────────────────
        for s in _subscriptions(now):
            await session.execute(
                text("""INSERT INTO subscriptions (id, user_id, plan_id, status, area_used_this_month_m2, started_at, expires_at)
                       VALUES (:id, :user_id, :plan_id, :status, :area_used_this_month_m2, :started_at, :expires_at)"""),
                s,
            )

        # ── Projects ────────────────────────────────────────────────────────
        for p in _projects(now):
            await session.execute(
                text("""INSERT INTO projects (id, user_id, name, wall_cols, wall_rows, wall_color, panels, total_price, created_at)
                       VALUES (:id, :user_id, :name, :wall_cols, :wall_rows, :wall_color, :panels, :total_price, :created_at)"""),
                p,
            )

        # ── Design reviews ──────────────────────────────────────────────────
        for r in _reviews(now):
            await session.execute(
                text("""INSERT INTO design_reviews (id, design_id, user_id, user_name, rating, text, created_at)
                       VALUES (:id, :design_id, :user_id, :user_name, :rating, :text, :created_at)"""),
                r,
            )

        # ── Visualization projects ──────────────────────────────────────────
        for v in _visualization_projects(now):
            await session.execute(
                text("""INSERT INTO visualization_projects (id, user_id, name, photo_url, photo_width, photo_height, wall_mask_base64, panels_json, placement_mode, created_at)
                       VALUES (:id, :user_id, :name, :photo_url, :photo_width, :photo_height, :wall_mask_base64, :panels_json, :placement_mode, :created_at)"""),
                v,
            )

        # ── Shop settings ────────────────────────────────────────────────────
        await session.execute(
            text("""INSERT INTO shop_settings (id, design_overlay_price, installation_price, min_order_amount, recommendations_limit_per_source, updated_at)
                   VALUES ('singleton', 1200, 0, 0, 12, :now)"""),
            {"now": now},
        )

        await session.commit()
        print("✅ Seed complete: categories, designs, plans, panels, users, addresses, orders, order_items, subscriptions, projects, reviews, visualizations, shop_settings")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
