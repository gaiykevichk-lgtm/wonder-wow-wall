"""Single source of truth for seed/demo data.

Used by:
- app.container (in-memory repos for dev/test)
- scripts.seed_db (PostgreSQL seeding)
"""

from app.domain.catalog.entities import Design, Category
from app.domain.catalog.value_objects import Color


# ─── Categories ──────────────────────────────────────────────────────────────
# Slugs MUST match what the frontend category filter sends as `?category=`
# (frontend model data.ts uses the same slugs).

SEED_CATEGORIES = [
    # existing backend slugs (keep for migrations compatibility)
    Category(id="cat-1", name="Природа",     slug="nature",      image="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop",   count=2),
    Category(id="cat-2", name="Абстракция", slug="abstract",    image="https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=300&fit=crop",   count=2),
    Category(id="cat-3", name="Геометрия",  slug="geometry",    image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",   count=2),
    Category(id="cat-4", name="Минимализм", slug="minimalism",   image="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop",   count=1),
    Category(id="cat-5", name="Текстуры",   slug="textures",    image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",   count=1),
    Category(id="cat-6", name="Арт",        slug="art",         image="https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop",   count=1),
    # new categories from frontend mock that need DB rows
    Category(id="cat-7", name="Дерево",     slug="wood",        image="https://images.unsplash.com/photo-1644925757334-d0397c01518c?w=400&h=300&fit=crop",   count=3),
    Category(id="cat-8", name="Камень",     slug="stone",       image="https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=400&h=300&fit=crop",   count=2),
    # Wave panels with real texture photos
    Category(id="cat-9", name="Волна",     slug="wave",        image="/uploads/wave_panels/10000.png",                              count=1),
]


# ─── Designs ────────────────────────────────────────────────────────────────────
# All designs from frontend/src/domains/catalog/model/data.ts with REAL Unsplash URLs
# and matching backend entity fields.

SEED_DESIGNS = [
    # ── wood ──────────────────────────────────────────────────────────
    Design(
        id="design-oak-classic",
        name="Дубовая классика",
        slug="oak-classic",
        category_id="cat-7",
        style="Классика",
        image="https://images.unsplash.com/photo-1644925757334-d0397c01518c?w=600&h=600&fit=crop",
        description="Накладка с текстурой натурального дуба. Реалистичная фактура, тёплый древесный оттенок. Подходит для гостиных, кабинетов и спален.",
        price=1200,
        colors=[
            Color("#8B6914", "Натуральный дуб"),
            Color("#A0522D", "Тёмный дуб"),
            Color("#D2B48C", "Светлый дуб"),
            Color("#6B4226", "Шоколад"),
        ],
        rating=4.8, reviews_count=124, is_popular=True,
    ),
    Design(
        id="design-walnut",
        name="Американский орех",
        slug="american-walnut",
        category_id="cat-7",
        style="Классика",
        image="https://images.unsplash.com/photo-1611072337226-1140ab367200?w=600&h=600&fit=crop",
        description="Роскошная накладка с текстурой американского ореха. Глубокий шоколадный оттенок для элегантных интерьеров.",
        price=1200,
        colors=[
            Color("#3E2723", "Тёмный орех"),
            Color("#5D4037", "Классический"),
            Color("#4E342E", "Мокко"),
        ],
        rating=4.9, reviews_count=87,
    ),
    Design(
        id="design-ash",
        name="Ясень скандинавский",
        slug="scandinavian-ash",
        category_id="cat-7",
        style="Минимализм",
        image="https://images.unsplash.com/photo-1763392199096-6efd9d28d8cc?w=600&h=600&fit=crop",
        description="Светлая накладка в скандинавском стиле с текстурой ясеня. Минималистичный и воздушный дизайн.",
        price=1200,
        colors=[
            Color("#F5DEB3", "Натуральный"),
            Color("#FAEBD7", "Отбелённый"),
            Color("#DEB887", "Медовый"),
        ],
        rating=4.7, reviews_count=56, is_new=True,
    ),

    # ── stone ─────────────────────────────────────────────────────────
    Design(
        id="design-marble",
        name="Белый мрамор",
        slug="white-marble",
        category_id="cat-8",
        style="Модерн",
        image="https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=600&h=600&fit=crop",
        description="Изысканная мраморная текстура с тонкими прожилками. Элегантное решение для любого интерьера.",
        price=1200,
        colors=[
            Color("#F5F5F5", "Каррара"),
            Color("#E8E0D8", "Калакатта"),
            Color("#D3D3D3", "Серый мрамор"),
        ],
        rating=4.8, reviews_count=156, is_new=True,
    ),
    Design(
        id="design-concrete",
        name="Бетон лофт",
        slug="concrete-loft",
        category_id="cat-8",
        style="Лофт",
        image="https://images.unsplash.com/photo-1711606329941-63c1af645a53?w=600&h=600&fit=crop",
        description="Имитация бетонной поверхности для стиля лофт. Современный индустриальный вид.",
        price=1200,
        colors=[
            Color("#9E9E9E", "Светлый бетон"),
            Color("#616161", "Тёмный бетон"),
            Color("#BDBDBD", "Серый"),
        ],
        rating=4.5, reviews_count=203, is_popular=True,
    ),

    # ── wave (Волна) — real texture photos ─────────────────────────────
    # The primary image (10000.png) + 51 gallery variants
    Design(
        id="design-wave",
        name="Волна",
        slug="wave",
        category_id="cat-9",
        style="Текстура",
        image="/uploads/wave_panels/10000.png",
        description="Натуральная текстура волны с 52 вариантами цветовых решений. Каждая панель уникальна благодаря УФ-печати. Идеально для гостиных, спален и офисов.",
        price=1200,
        colors=[
            Color("#1A5F7A", "Морская волна"),
            Color("#2E8B8B", "Бирюзовый"),
            Color("#5DADE2", "Небесный"),
            Color("#85C1E9", "Ледяной"),
            Color("#AED6F1", "Морской бриз"),
            Color("#1C2833", "Глубокий океан"),
            Color("#34495E", "Стальной"),
            Color("#7FB3D5", "Разлив"),
            Color("#5499C7", "Средиземный"),
            Color("#2E86AB", "Фиолетовая волна"),
            Color("#48C9B0", "Мятный прибой"),
            Color("#F39C12", "Закат на воде"),
            Color("#E74C3C", "Коралловый риф"),
            Color("#9B59B6", "Фиалковый прилив"),
            Color("#1ABC9C", "Изумрудный прибой"),
            Color("#F1C40F", "Золото волн"),
            Color("#E67E22", "Янтарный берег"),
            Color("#2ECC71", "Лесная река"),
        ],
        rating=4.9, reviews_count=312, is_popular=True, is_new=True,
    ),
]


# ─── Subscription Plans ──────────────────────────────────────────────────────
SEED_SUBSCRIPTION_PLANS = [
    {"id": "starter", "name": "Стартовый", "price": 7000, "period": "мес",
     "area_limit_m2": 15, "popular": False, "is_active": True, "sort_order": 0,
     "features": ["До 15 м² накладок в месяц", "Все дизайны из каталога",
                   "Бесплатная доставка по Москве", "Замена повреждённых накладок",
                   "Поддержка 9:00–18:00"]},
    {"id": "popular", "name": "Популярный", "price": 12000, "period": "мес",
     "area_limit_m2": 30, "popular": True, "is_active": True, "sort_order": 1,
     "features": ["До 30 м² накладок в месяц", "Все дизайны + эксклюзивные коллекции",
                   "Бесплатная доставка по РФ", "Приоритетная замена повреждённых",
                   "Поддержка 8:00–22:00", "Персональный дизайнер",
                   "Сохранение до 5 проектов"]},
    {"id": "business", "name": "Бизнес", "price": 18000, "period": "мес",
     "area_limit_m2": 0, "popular": False, "is_active": True, "sort_order": 2,
     "features": ["Безлимитная площадь накладок", "Эксклюзивные и кастомные дизайны",
                   "VIP-доставка по всей РФ", "Замена в течение 24 часов",
                   "Поддержка 24/7", "Персональный менеджер",
                   "Безлимитные проекты", "Скидка 20% на базовые панели"]},
]


# ─── Panels ──────────────────────────────────────────────────────────────────
SEED_PANELS = [
    {"id": "panel-30x30",  "name": "Панель 30×30 см", "slug": "small-square",
     "width_mm": 300, "height_mm": 300, "size_label": "30×30 см",
     "base_price": 890, "description": "Компактная панель для небольших зон",
     "photo_path": "", "is_active": True},
    {"id": "panel-30x60",  "name": "Панель 30×60 см", "slug": "small-rect",
     "width_mm": 300, "height_mm": 600, "size_label": "30×60 см",
     "base_price": 1490, "description": "Вертикальная панель для дверных проёмов",
     "photo_path": "", "is_active": True},
    {"id": "panel-60x60",  "name": "Панель 60×60 см", "slug": "large-square",
     "width_mm": 600, "height_mm": 600, "size_label": "60×60 см",
     "base_price": 2490, "description": "Крупная панель для акцентных зон",
     "photo_path": "", "is_active": True},
]


def designs_as_dicts() -> list[dict]:
    """Convert domain designs to dicts for DB seeding (ORM model kwargs)."""
    result = []
    for d in SEED_DESIGNS:
        data = {
            "id": d.id, "name": d.name, "slug": d.slug, "category_id": d.category_id,
            "style": d.style, "image": d.image, "description": d.description, "price": d.price,
            "colors": [{"hex": c.hex, "name": c.name} for c in d.colors],
            "rating": d.rating, "reviews_count": d.reviews_count,
            "is_published": True,
        }
        if d.is_new:
            data["is_new"] = True
        if d.is_popular:
            data["is_popular"] = True
        result.append(data)
    return result


def categories_as_dicts() -> list[dict]:
    """Convert domain categories to dicts for DB seeding."""
    return [
        {"id": c.id, "name": c.name, "slug": c.slug, "image": c.image, "count": c.count}
        for c in SEED_CATEGORIES
    ]
