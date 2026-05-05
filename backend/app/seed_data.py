"""Single source of truth for seed/demo data.

Used by:
- app.container (in-memory repos for dev/test)
- scripts.seed_db (PostgreSQL seeding)
"""

from app.domain.catalog.entities import Design, Category
from app.domain.catalog.value_objects import Color


# ─── Categories (размеры панелей) ───────────────────────────────────────────

SEED_CATEGORIES = [
    Category(id="cat-30x30", name="30×30 см", slug="30x30", image="/uploads/forms/30x30/flat-s-01-front.png", count=14),
    Category(id="cat-30x60", name="30×60 см", slug="30x60", image="/uploads/forms/30x60/flat-m-01-front.png", count=12),
    Category(id="cat-60x60", name="60×60 см", slug="60x60", image="/uploads/forms/60x60/flat-l-01-front.png", count=11),
]


# ─── Designs (формы панелей) ────────────────────────────────────────────────

_F30 = "/uploads/forms/30x30"
_F60R = "/uploads/forms/30x60"
_F60S = "/uploads/forms/60x60"

SEED_DESIGNS = [
    # ── 30×30 см (14 форм) ────────────────────────────────────────────
    Design(
        id="flat-s-01", name="Плоская", slug="flat-s",
        category_id="cat-30x30",
        image=f"{_F30}/flat-s-01-front.png",
        preview_image=f"{_F30}/flat-s-01-front.png",
        description="Гладкая плоская панель — чистый холст для любой текстуры. Универсальная база для минималистичных интерьеров.",
        price=1200, rating=4.8, reviews_count=64, is_popular=True,
    ),
    Design(
        id="tslat-s-02", name="Рейки", slug="tslat-s",
        category_id="cat-30x30",
        image=f"{_F30}/tslat-s-02-front.png",
        preview_image=f"{_F30}/tslat-s-02-front.png",
        description="Узкие вертикальные рейки с равномерным ритмом. Визуально вытягивают стену и добавляют глубину.",
        price=1200, rating=4.7, reviews_count=42, is_new=True,
    ),
    Design(
        id="wslat-s-03", name="Трио", slug="wslat-s",
        category_id="cat-30x30",
        image=f"{_F30}/wslat-s-03-front.png",
        preview_image=f"{_F30}/wslat-s-03-front.png",
        description="Три широкие вертикальные секции с мягкими гранями. Сдержанный и уверенный рельеф.",
        price=1200, rating=4.6, reviews_count=31,
    ),
    Design(
        id="dslat-s-04", name="Диагональ", slug="dslat-s",
        category_id="cat-30x30",
        image=f"{_F30}/dslat-s-04-front.png",
        preview_image=f"{_F30}/dslat-s-04-front.png",
        description="Диагональная штриховка на плоскости — динамичный рельеф, который оживляет геометрию стены.",
        price=1200, rating=4.9, reviews_count=58, is_popular=True,
    ),
    Design(
        id="key-s-05", name="Грань", slug="key-s",
        category_id="cat-30x30",
        image=f"{_F30}/key-s-05-front.png",
        preview_image=f"{_F30}/key-s-05-front.png",
        description="Одиночная вертикальная грань делит панель надвое. Лаконичный акцент с игрой света и тени.",
        price=1200, rating=4.5, reviews_count=28,
    ),
    Design(
        id="col-s-06", name="Колонны", slug="col-s",
        category_id="cat-30x30",
        image=f"{_F30}/col-s-06-front.png",
        preview_image=f"{_F30}/col-s-06-front.png",
        description="Два вогнутых пилона напоминают классические колонны. Благородство архитектурных форм на стене.",
        price=1200, rating=4.7, reviews_count=35, is_new=True,
    ),
    Design(
        id="arc-s-07", name="Арка", slug="arc-s",
        category_id="cat-30x30",
        image=f"{_F30}/arc-s-07-front.png",
        preview_image=f"{_F30}/arc-s-07-front.png",
        description="Скруглённый верхний срез создаёт силуэт арки. Мягкая, почти романская форма.",
        price=1200, rating=4.8, reviews_count=47,
    ),
    Design(
        id="trap-s-08", name="Трапеция", slug="trap-s",
        category_id="cat-30x30",
        image=f"{_F30}/trap-s-08-front.png",
        preview_image=f"{_F30}/trap-s-08-front.png",
        description="Трапециевидный рельеф с фаской по периметру. Чёткая геометрия и объём при боковом свете.",
        price=1200, rating=4.6, reviews_count=39, is_popular=True,
    ),
    Design(
        id="zig-s-09", name="Зигзаг", slug="zig-s",
        category_id="cat-30x30",
        image=f"{_F30}/zig-s-09-front.png",
        preview_image=f"{_F30}/zig-s-09-front.png",
        description="Плавные вертикальные волны с выраженным зигзагообразным рельефом. Динамика и ритм в каждой панели.",
        price=1200, rating=4.7, reviews_count=52,
    ),
    Design(
        id="wav-s-10", name="Волна", slug="wav-s",
        category_id="cat-30x30",
        image=f"{_F30}/wav-s-10-front.png",
        preview_image=f"{_F30}/wav-s-10-front.png",
        description="Классическая волна — мягкие переливы поверхности, которые оживают в лучах бокового света.",
        price=1200, rating=4.9, reviews_count=87, is_popular=True, is_new=True,
    ),
    Design(
        id="sqr-s-11", name="Квадраты", slug="sqr-s",
        category_id="cat-30x30",
        image=f"{_F30}/sqr-s-11-front.png",
        preview_image=f"{_F30}/sqr-s-11-front.png",
        description="Четыре смещённых квадрата создают объёмную мозаику. Современный и динамичный паттерн.",
        price=1200, rating=4.6, reviews_count=33,
    ),
    Design(
        id="pyr-s-12", name="Кессон", slug="pyr-s",
        category_id="cat-30x30",
        image=f"{_F30}/pyr-s-12-front.png",
        preview_image=f"{_F30}/pyr-s-12-front.png",
        description="Классический кессон со ступенчатой рамкой. Придаёт стене торжественность дворцового потолка.",
        price=1200, rating=4.8, reviews_count=61, is_popular=True,
    ),
    Design(
        id="rdiv-s-13", name="Ригель", slug="rdiv-s",
        category_id="cat-30x30",
        image=f"{_F30}/rdiv-s-13-front.png",
        preview_image=f"{_F30}/rdiv-s-13-front.png",
        description="Горизонтальная прямоугольная перемычка — строгий минимализм для акцентных зон.",
        price=1200, rating=4.5, reviews_count=22,
    ),
    Design(
        id="cdiv-s-14", name="Цилиндр", slug="cdiv-s",
        category_id="cat-30x30",
        image=f"{_F30}/cdiv-s-14-front.png",
        preview_image=f"{_F30}/cdiv-s-14-front.png",
        description="Горизонтальный цилиндрический элемент — мягкая скульптурная форма, ловящая свет по дуге.",
        price=1200, rating=4.6, reviews_count=26,
    ),

    # ── 30×60 см (12 форм) ────────────────────────────────────────────
    Design(
        id="flat-m-01", name="Плоская", slug="flat-m",
        category_id="cat-30x60",
        image=f"{_F60R}/flat-m-01-front.png",
        preview_image=f"{_F60R}/flat-m-01-front.png",
        description="Гладкая прямоугольная панель — вертикальный формат для высоких стен и узких простенков.",
        price=1200, rating=4.7, reviews_count=38,
    ),
    Design(
        id="rslat-m-02", name="Рейки", slug="rslat-m",
        category_id="cat-30x60",
        image=f"{_F60R}/rslat-m-02-front.png",
        preview_image=f"{_F60R}/rslat-m-02-front.png",
        description="Вертикальные рейки в удлинённом формате. Вытягивают пространство и задают ритм интерьеру.",
        price=1200, rating=4.8, reviews_count=45, is_popular=True,
    ),
    Design(
        id="cslat-m-03", name="Каскад", slug="cslat-m",
        category_id="cat-30x60",
        image=f"{_F60R}/cslat-m-03-front.png",
        preview_image=f"{_F60R}/cslat-m-03-front.png",
        description="Каскадные ступенчатые планки — рельеф нарастает волной, создавая глубину.",
        price=1200, rating=4.6, reviews_count=29,
    ),
    Design(
        id="ddia-m-04", name="Двойная диагональ", slug="ddia-m",
        category_id="cat-30x60",
        image=f"{_F60R}/ddia-m-04-front.png",
        preview_image=f"{_F60R}/ddia-m-04-front.png",
        description="Встречные диагональные штрихи создают сложный геометрический узор, напоминающий плетение.",
        price=1200, rating=4.9, reviews_count=54, is_new=True,
    ),
    Design(
        id="her-m-05", name="Ёлочка", slug="her-m",
        category_id="cat-30x60",
        image=f"{_F60R}/her-m-05-front.png",
        preview_image=f"{_F60R}/her-m-05-front.png",
        description="Диагональные линии в классическом паттерне «ёлочка». Вечная геометрия паркетного рисунка.",
        price=1200, rating=4.7, reviews_count=41,
    ),
    Design(
        id="clo-m-06", name="Кристалл", slug="clo-m",
        category_id="cat-30x60",
        image=f"{_F60R}/clo-m-06-front.png",
        preview_image=f"{_F60R}/clo-m-06-front.png",
        description="Объёмные грани, как срез драгоценного камня. Игра света на каждой плоскости.",
        price=1200, rating=4.8, reviews_count=63, is_popular=True,
    ),
    Design(
        id="seg-m-07", name="Сегмент", slug="seg-m",
        category_id="cat-30x60",
        image=f"{_F60R}/seg-m-07-front.png",
        preview_image=f"{_F60R}/seg-m-07-front.png",
        description="Вытянутые шестиугольные сегменты — архитектурная элегантность в каждом повторе.",
        price=1200, rating=4.6, reviews_count=34, is_new=True,
    ),
    Design(
        id="ncm-m-08", name="Узкий гребень", slug="ncm-m",
        category_id="cat-30x60",
        image=f"{_F60R}/ncm-m-08-front.png",
        preview_image=f"{_F60R}/ncm-m-08-front.png",
        description="Тонкие частые рёбра создают текстуру вельвета на стене. Тактильный и визуально тёплый рельеф.",
        price=1200, rating=4.5, reviews_count=27,
    ),
    Design(
        id="nmol-m-09", name="Узкий молдинг", slug="nmol-m",
        category_id="cat-30x60",
        image=f"{_F60R}/nmol-m-09-front.png",
        preview_image=f"{_F60R}/nmol-m-09-front.png",
        description="Деликатный молдинг по центру панели — классический приём с филёнкой в современном прочтении.",
        price=1200, rating=4.7, reviews_count=36,
    ),
    Design(
        id="wcm-m-10", name="Широкий гребень", slug="wcm-m",
        category_id="cat-30x60",
        image=f"{_F60R}/wcm-m-10-front.png",
        preview_image=f"{_F60R}/wcm-m-10-front.png",
        description="Широкие рёбра с плавным профилем — как застывшие волны на спокойной воде.",
        price=1200, rating=4.6, reviews_count=31,
    ),
    Design(
        id="wmol-m-11", name="Широкий молдинг", slug="wmol-m",
        category_id="cat-30x60",
        image=f"{_F60R}/wmol-m-11-front.png",
        preview_image=f"{_F60R}/wmol-m-11-front.png",
        description="Крупный молдинг с выраженной рамкой — для интерьеров, которые не боятся классики.",
        price=1200, rating=4.7, reviews_count=43, is_popular=True,
    ),
    Design(
        id="tet-m-12", name="Тетра", slug="tet-m",
        category_id="cat-30x60",
        image=f"{_F60R}/tet-m-12-front.png",
        preview_image=f"{_F60R}/tet-m-12-front.png",
        description="Четыре грани сходятся к центру — объёмная фигура, меняющая восприятие в зависимости от угла.",
        price=1200, rating=4.8, reviews_count=49,
    ),

    # ── 60×60 см (11 форм) ────────────────────────────────────────────
    Design(
        id="flat-l-01", name="Плоская", slug="flat-l",
        category_id="cat-60x60",
        image=f"{_F60S}/flat-l-01-front.png",
        preview_image=f"{_F60S}/flat-l-01-front.png",
        description="Крупная плоская панель — максимальная площадь покрытия за один элемент. Идеальна для больших стен.",
        price=1200, rating=4.7, reviews_count=41,
    ),
    Design(
        id="frel-l-02", name="Плавный рельеф", slug="frel-l",
        category_id="cat-60x60",
        image=f"{_F60S}/frel-l-02-front.png",
        preview_image=f"{_F60S}/frel-l-02-front.png",
        description="Мягкие волнообразные переходы по всей поверхности. Панель играет светом как шёлковая ткань.",
        price=1200, rating=4.8, reviews_count=53, is_new=True,
    ),
    Design(
        id="crel-l-03", name="Классический рельеф", slug="crel-l",
        category_id="cat-60x60",
        image=f"{_F60S}/crel-l-03-front.png",
        preview_image=f"{_F60S}/crel-l-03-front.png",
        description="Традиционный филёнчатый рельеф большого формата — основа классического интерьера.",
        price=1200, rating=4.9, reviews_count=72, is_popular=True,
    ),
    Design(
        id="brk-l-04", name="Кирпич", slug="brk-l",
        category_id="cat-60x60",
        image=f"{_F60S}/brk-l-04-front.png",
        preview_image=f"{_F60S}/brk-l-04-front.png",
        description="Имитация кирпичной кладки с объёмными швами. Лофт-эстетика без пыли и штукатурки.",
        price=1200, rating=4.7, reviews_count=48, is_popular=True,
    ),
    Design(
        id="lwav-l-05", name="Длинная волна", slug="lwav-l",
        category_id="cat-60x60",
        image=f"{_F60S}/lwav-l-05-front.png",
        preview_image=f"{_F60S}/lwav-l-05-front.png",
        description="Протяжённая волна крупного формата — амплитуда рельефа раскрывается на большой площади.",
        price=1200, rating=4.8, reviews_count=56,
    ),
    Design(
        id="cir-l-06", name="Круг", slug="cir-l",
        category_id="cat-60x60",
        image=f"{_F60S}/cir-l-06-front.png",
        preview_image=f"{_F60S}/cir-l-06-front.png",
        description="Вписанный круг с горизонтальной линией — спокойная, медитативная форма в духе дзен.",
        price=1200, rating=4.9, reviews_count=67, is_new=True,
    ),
    Design(
        id="rho-l-07", name="Ромб", slug="rho-l",
        category_id="cat-60x60",
        image=f"{_F60S}/rho-l-07-front.png",
        preview_image=f"{_F60S}/rho-l-07-front.png",
        description="Крупный ромб с фаской — строгая геометрия с отсылкой к art deco.",
        price=1200, rating=4.6, reviews_count=34,
    ),
    Design(
        id="mos-l-08", name="Мозаика", slug="mos-l",
        category_id="cat-60x60",
        image=f"{_F60S}/mos-l-08-front.png",
        preview_image=f"{_F60S}/mos-l-08-front.png",
        description="Мозаичный паттерн из прямоугольных элементов — каждая грань ловит свет под своим углом.",
        price=1200, rating=4.7, reviews_count=39,
    ),
    Design(
        id="ffrm-l-09", name="Плоская рамка", slug="ffrm-l",
        category_id="cat-60x60",
        image=f"{_F60S}/ffrm-l-09-front.png",
        preview_image=f"{_F60S}/ffrm-l-09-front.png",
        description="Минималистичная рамка с плоским профилем — границы формы без лишних деталей.",
        price=1200, rating=4.5, reviews_count=25,
    ),
    Design(
        id="pfrm-l-10", name="Профильная рамка", slug="pfrm-l",
        category_id="cat-60x60",
        image=f"{_F60S}/pfrm-l-10-front.png",
        preview_image=f"{_F60S}/pfrm-l-10-front.png",
        description="Рамка со скошенным профилем — объём и глубина за счёт фаски по внутреннему контуру.",
        price=1200, rating=4.6, reviews_count=30,
    ),
    Design(
        id="cfrm-l-11", name="Классическая рамка", slug="cfrm-l",
        category_id="cat-60x60",
        image=f"{_F60S}/cfrm-l-11-front.png",
        preview_image=f"{_F60S}/cfrm-l-11-front.png",
        description="Рамка с многоступенчатым профилем — классический буазери в современном формате.",
        price=1200, rating=4.8, reviews_count=51, is_popular=True,
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


# ─── Textures & Colors ───────────────────────────────────────────────────────
SEED_TEXTURES = [
    {
        "id": "tex-leather", "name": "Кожа", "slug": "leather",
        "swatch_image": "", "sort_order": 0,
        "colors": [
            {"id": "clr-leather-1", "name": "Шоколад",         "hex": "#5C3317"},
            {"id": "clr-leather-2", "name": "Карамель",         "hex": "#C68E5B"},
            {"id": "clr-leather-3", "name": "Слоновая кость",   "hex": "#FFFFF0"},
            {"id": "clr-leather-4", "name": "Чёрная кожа",      "hex": "#1A1A1A"},
            {"id": "clr-leather-5", "name": "Бордо",            "hex": "#800020"},
        ],
    },
    {
        "id": "tex-textile", "name": "Текстиль", "slug": "textile",
        "swatch_image": "", "sort_order": 1,
        "colors": [
            {"id": "clr-textile-1", "name": "Лён",              "hex": "#E8DCC8"},
            {"id": "clr-textile-2", "name": "Графит",           "hex": "#4A4A4A"},
            {"id": "clr-textile-3", "name": "Лаванда",          "hex": "#B8A9C9"},
            {"id": "clr-textile-4", "name": "Изумруд",          "hex": "#2D7D46"},
            {"id": "clr-textile-5", "name": "Терракот",         "hex": "#CC5C3C"},
        ],
    },
    {
        "id": "tex-wood", "name": "Дерево", "slug": "wood",
        "swatch_image": "", "sort_order": 2,
        "colors": [
            {"id": "clr-wood-1", "name": "Натуральный дуб",    "hex": "#C4A882"},
            {"id": "clr-wood-2", "name": "Тёмный орех",        "hex": "#5C4033"},
            {"id": "clr-wood-3", "name": "Берёза",             "hex": "#F5E6CC"},
            {"id": "clr-wood-4", "name": "Венге",              "hex": "#3C2415"},
            {"id": "clr-wood-5", "name": "Ясень",              "hex": "#D4C5A9"},
        ],
    },
    {
        "id": "tex-metal", "name": "Металл", "slug": "metal",
        "swatch_image": "", "sort_order": 3,
        "colors": [
            {"id": "clr-metal-1", "name": "Сталь",             "hex": "#71797E"},
            {"id": "clr-metal-2", "name": "Бронза",            "hex": "#CD7F32"},
            {"id": "clr-metal-3", "name": "Золото",            "hex": "#D4AF37"},
            {"id": "clr-metal-4", "name": "Медь",              "hex": "#B87333"},
            {"id": "clr-metal-5", "name": "Чернёный",          "hex": "#2C2C2C"},
        ],
    },
    {
        "id": "tex-stone", "name": "Природный камень", "slug": "natural-stone",
        "swatch_image": "", "sort_order": 4,
        "colors": [
            {"id": "clr-stone-1", "name": "Каррарский мрамор", "hex": "#F0EDE5"},
            {"id": "clr-stone-2", "name": "Серый гранит",      "hex": "#808080"},
            {"id": "clr-stone-3", "name": "Оникс",             "hex": "#353839"},
            {"id": "clr-stone-4", "name": "Травертин",         "hex": "#D2C6B2"},
            {"id": "clr-stone-5", "name": "Сланец",            "hex": "#54585A"},
        ],
    },
    {
        "id": "tex-decorative", "name": "Декоративные фактуры", "slug": "decorative",
        "swatch_image": "", "sort_order": 5,
        "colors": [
            {"id": "clr-deco-1", "name": "Белая штукатурка",   "hex": "#F5F2ED"},
            {"id": "clr-deco-2", "name": "Серый бетон",        "hex": "#A0A0A0"},
            {"id": "clr-deco-3", "name": "Терракотовая штукатурка", "hex": "#CC7755"},
            {"id": "clr-deco-4", "name": "Песчаник",           "hex": "#D2B48C"},
            {"id": "clr-deco-5", "name": "Антрацит",           "hex": "#293133"},
        ],
    },
    {
        "id": "tex-paint", "name": "Краска", "slug": "paint",
        "swatch_image": "", "sort_order": 6,
        "colors": [
            {"id": "clr-paint-1", "name": "Белый",             "hex": "#FFFFFF"},
            {"id": "clr-paint-2", "name": "Слоновая кость",    "hex": "#FAEBD7"},
            {"id": "clr-paint-3", "name": "Пыльная роза",      "hex": "#DCAE96"},
            {"id": "clr-paint-4", "name": "Серо-голубой",      "hex": "#6D8EA0"},
            {"id": "clr-paint-5", "name": "Оливковый",         "hex": "#808000"},
        ],
    },
    {
        "id": "tex-graphics", "name": "Графика", "slug": "graphics",
        "swatch_image": "", "sort_order": 7,
        "colors": [
            {"id": "clr-graph-1", "name": "Монохром",          "hex": "#2D2D2D"},
            {"id": "clr-graph-2", "name": "Индиго",            "hex": "#3F51B5"},
            {"id": "clr-graph-3", "name": "Терракот",          "hex": "#E07C5A"},
            {"id": "clr-graph-4", "name": "Золотой орнамент",  "hex": "#C9A84C"},
            {"id": "clr-graph-5", "name": "Изумрудный",        "hex": "#00695C"},
        ],
    },
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
            "preview_image": d.preview_image,
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
