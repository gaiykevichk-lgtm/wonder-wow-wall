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

    # ── abstract ─────────────────────────────────────────────────────
    Design(
        id="design-waves",
        name="Волны",
        slug="waves",
        category_id="cat-2",
        style="Модерн",
        image="https://images.unsplash.com/photo-1740686004244-e9bc7c75d8e5?w=600&h=600&fit=crop",
        description="Динамичный абстрактный паттерн с волнообразным рисунком. Создаёт движение и глубину.",
        price=1200,
        colors=[
            Color("#1A237E", "Индиго"),
            Color("#006064", "Океан"),
            Color("#4A148C", "Аметист"),
        ],
        rating=4.7, reviews_count=98,
    ),
    Design(
        id="design-gradient",
        name="Градиент",
        slug="gradient",
        category_id="cat-2",
        style="Арт",
        image="https://images.unsplash.com/photo-1690382285917-73dfd2a22d07?w=600&h=600&fit=crop",
        description="Плавные цветовые переходы. Арт-объект на вашей стене. Каждая панель уникальна.",
        price=1200,
        colors=[
            Color("#FF6B6B", "Закат"),
            Color("#4ECDC4", "Мята"),
            Color("#2C3E50", "Ночь"),
        ],
        rating=4.6, reviews_count=78,
    ),

    # ── geometric ─────────────────────────────────────────────────────
    Design(
        id="design-hexagon",
        name="Гексагон",
        slug="hexagon",
        category_id="cat-3",
        style="Модерн",
        image="https://images.unsplash.com/photo-1582135739786-3bceafcaea85?w=600&h=600&fit=crop",
        description="Шестиугольный геометрический паттерн. Современный и стильный дизайн для любого пространства.",
        price=1200,
        colors=[
            Color("#2D2D2D", "Графит"),
            Color("#FFFFFF", "Белый"),
            Color("#B87333", "Медь"),
            Color("#1ABC9C", "Бирюза"),
        ],
        rating=4.5, reviews_count=143,
    ),
    Design(
        id="design-lines",
        name="Линии",
        slug="lines",
        category_id="cat-3",
        style="Минимализм",
        image="https://images.unsplash.com/photo-1711606404173-0a45c4735639?w=600&h=600&fit=crop",
        description="Строгие вертикальные линии. Ритмичный минималистичный рисунок для элегантных интерьеров.",
        price=1200,
        colors=[
            Color("#FFFFFF", "Белый"),
            Color("#1A1A1A", "Чёрный"),
            Color("#9CA3AF", "Серебро"),
        ],
        rating=4.4, reviews_count=89,
    ),

    # ── nature ────────────────────────────────────────────────────────
    Design(
        id="design-tropical",
        name="Тропики",
        slug="tropical",
        category_id="cat-1",
        style="Модерн",
        image="https://images.unsplash.com/photo-1722109997425-40f920848aed?w=600&h=600&fit=crop",
        description="Тропические листья и растения. Оживите интерьер природными мотивами.",
        price=1200,
        colors=[
            Color("#2E7D32", "Зелёный"),
            Color("#1B5E20", "Тёмно-зелёный"),
            Color("#4CAF50", "Свежая зелень"),
        ],
        rating=4.6, reviews_count=67, is_new=True,
    ),
    Design(
        id="design-botanical",
        name="Ботаника",
        slug="botanical",
        category_id="cat-1",
        style="Арт",
        image="https://images.unsplash.com/photo-1682698992719-966a930ccc90?w=600&h=600&fit=crop",
        description="Нежные ботанические иллюстрации. Утончённый дизайн для уютных пространств.",
        price=1200,
        colors=[
            Color("#F5F5DC", "Крем"),
            Color("#FFF8E1", "Ваниль"),
            Color("#E8F5E9", "Мятный"),
        ],
        rating=4.8, reviews_count=42,
    ),

    # ── minimalism ───────────────────────────────────────────────────
    Design(
        id="design-pure-white",
        name="Чистый белый",
        slug="pure-white",
        category_id="cat-4",
        style="Минимализм",
        image="https://images.unsplash.com/photo-1584530313715-bfe628686135?w=600&h=600&fit=crop",
        description="Идеально белая поверхность. Минималистичное решение для чистых и светлых пространств.",
        price=1200,
        colors=[
            Color("#FFFFFF", "Белый"),
            Color("#FAFAFA", "Снежный"),
            Color("#F5F5F5", "Молочный"),
        ],
        rating=4.3, reviews_count=167,
    ),

    # ── textures (migrated from old backend seed) ────────────────────
    Design(
        id="d-11",
        name="Бетонная текстура",
        slug="concrete-texture",
        category_id="cat-5",
        style="Текстуры",
        image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
        description="Имитация бетонной поверхности",
        price=1200,
        colors=[
            Color("#9E9E9E", "Бетон"),
            Color("#757575", "Тёмный бетон"),
            Color("#E0E0E0", "Светлый бетон"),
        ],
        rating=4.5, reviews_count=16,
    ),

    # ── art (migrated from old backend seed) ──────────────────────────
    Design(
        id="d-12",
        name="Поп-арт",
        slug="pop-art",
        category_id="cat-6",
        style="Арт",
        image="https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&h=600&fit=crop",
        description="Яркие поп-арт иллюстрации",
        price=1200,
        colors=[
            Color("#F44336", "Красный"),
            Color("#FFEB3B", "Жёлтый"),
            Color("#2196F3", "Синий"),
        ],
        rating=4.8, reviews_count=20, is_new=True,
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
