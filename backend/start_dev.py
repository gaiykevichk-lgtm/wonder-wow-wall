"""Combined seed + server script for development with in-memory repos."""

import asyncio
import sys


async def seed_everything():
    """Seed ALL bounded contexts (catalog, users, orders, shop, etc.)."""
    from app.infrastructure.security.jwt import hash_password
    from app.domain.user.entities import User, UserAddress
    from app.domain.user.value_objects import UserRole
    from app.domain.catalog.entities import Design, Category, DesignReview
    from app.domain.catalog.value_objects import Color, PanelSize
    from app.domain.order.entities import Order, OrderItem, OrderNote
    from app.domain.order.value_objects import OrderStatus, Address
    from app.domain.subscription.entities import Subscription
    from app.domain.subscription.value_objects import SubscriptionStatus
    from app.domain.catalog.panel import Panel
    from app.domain.shop.banner import Banner, BannerPosition
    from app.domain.shop.settings import ShopSettings
    from app.domain.catalog.recommendation import (
        Recommendation, RecommendationTarget, RecommendationSourceType,
        RecommendationTargetType,
    )
    from app.container import (
        _mem_user_repo, _mem_design_repo, _mem_category_repo, _mem_review_repo,
        _mem_order_repo, _mem_subscription_repo, _mem_panel_repo,
        _mem_shop_settings_repo, _mem_banner_repo, _mem_recommendation_repo,
    )

    def _pw(p: str) -> str:
        return hash_password(p)

    # ── Users ─────────────────────────────────────────────────────────
    users = [
        User(id="admin-root", email="admin@wow.ru", password_hash=_pw("admin123"),
             name="Администратор", phone="+79001234567", role=UserRole.ADMIN),
        User(id="user-1", email="ivan@example.com", password_hash=_pw("password123"),
             name="Иван Петров", phone="+79012345678", role=UserRole.CUSTOMER,
             addresses=[UserAddress(id="addr-1", label="Дом", city="Москва", street="ул. Пушкина",
                                   building="10", apartment="5", postal_code="123456", is_default=True)]),
        User(id="user-2", email="anna@example.com", password_hash=_pw("password123"),
             name="Анна Сидорова", phone="+79023456789", role=UserRole.CUSTOMER,
             addresses=[UserAddress(id="addr-2", label="Квартира", city="Москва", street="пр. Мира",
                                   building="25", apartment="12", postal_code="654321", is_default=True)]),
        User(id="user-3", email="oleg@example.com", password_hash=_pw("password123"),
             name="Олег Козлов", phone="+79034567890", role=UserRole.CUSTOMER),
        User(id="user-4", email="elena@example.com", password_hash=_pw("password123"),
             name="Елена Волкова", phone="+79045678901", role=UserRole.CUSTOMER,
             addresses=[UserAddress(id="addr-4", label="Офис", city="Санкт-Петербург", street="Невский пр.",
                                   building="100", apartment="301", postal_code="191186", is_default=True)]),
        User(id="user-5", email="dmitry@example.com", password_hash=_pw("password123"),
             name="Дмитрий Морозов", phone="+79056789012", role=UserRole.CUSTOMER),
    ]
    for u in users:
        if await _mem_user_repo.get_by_email(u.email) is None:
            await _mem_user_repo.create(u)
    print(f"Admin seeded: admin@wow.ru / admin123", file=sys.stderr)
    print(f"Users seeded: {len(users)}", file=sys.stderr)

    # ── Reviews (для всех 37 форм) ─────────────────────────────────────
    from uuid import uuid4
    reviews_data = [
        # 30×30
        {"design_id": "flat-s-01", "user_name": "Иван П.", "rating": 5, "text": "Идеальная база — нанесли текстуру дерева и комната преобразилась."},
        {"design_id": "flat-s-01", "user_name": "Анна С.", "rating": 5, "text": "Плоская панель — универсальный вариант на все случаи. Рекомендую!"},
        {"design_id": "flat-s-01", "user_name": "Елена В.", "rating": 4, "text": "Качество на высоте, монтаж занял 20 минут на 4 м²."},
        {"design_id": "tslat-s-02", "user_name": "Дмитрий М.", "rating": 5, "text": "Рейки потрясающе смотрятся в прихожей — визуально стена стала выше."},
        {"design_id": "tslat-s-02", "user_name": "Олег К.", "rating": 4, "text": "Хорошие рейки, но нужно точно выставлять уровень."},
        {"design_id": "tslat-s-02", "user_name": "Иван П.", "rating": 5, "text": "Заказал на всю стену в коридоре — гости думают, что это натуральное дерево."},
        {"design_id": "wslat-s-03", "user_name": "Анна С.", "rating": 5, "text": "Трио — это элегантность и простота. Идеально за ТВ."},
        {"design_id": "wslat-s-03", "user_name": "Елена В.", "rating": 4, "text": "Широкие секции дают приятный ритм, но хотелось бы ещё вариант цвета."},
        {"design_id": "dslat-s-04", "user_name": "Олег К.", "rating": 5, "text": "Диагональ — вау-эффект! Все спрашивают, где заказывали."},
        {"design_id": "dslat-s-04", "user_name": "Дмитрий М.", "rating": 5, "text": "Динамичный рисунок, который не надоедает. Очень доволен!"},
        {"design_id": "dslat-s-04", "user_name": "Иван П.", "rating": 5, "text": "Лучший выбор для акцентной стены. Свет играет потрясающе."},
        {"design_id": "key-s-05", "user_name": "Анна С.", "rating": 5, "text": "Лаконично и стильно. Одна грань — а эффект колоссальный."},
        {"design_id": "key-s-05", "user_name": "Елена В.", "rating": 4, "text": "Минимализм в чистом виде. Подошло к скандинавскому интерьеру."},
        {"design_id": "col-s-06", "user_name": "Олег К.", "rating": 5, "text": "Колонны придали комнате настоящий дворцовый вид!"},
        {"design_id": "col-s-06", "user_name": "Дмитрий М.", "rating": 5, "text": "Классика не стареет. Отличная форма для гостиной."},
        {"design_id": "col-s-06", "user_name": "Иван П.", "rating": 4, "text": "Благородно смотрится с текстурой камня. Советую!"},
        {"design_id": "arc-s-07", "user_name": "Анна С.", "rating": 5, "text": "Арка создаёт ощущение мягкости. Спальня стала уютнее."},
        {"design_id": "arc-s-07", "user_name": "Елена В.", "rating": 5, "text": "Заказала в детскую — дочь в восторге от формы."},
        {"design_id": "arc-s-07", "user_name": "Олег К.", "rating": 4, "text": "Романская арка — неожиданно хорошо для современного интерьера."},
        {"design_id": "trap-s-08", "user_name": "Дмитрий М.", "rating": 5, "text": "Трапеция с боковой подсветкой — это произведение искусства."},
        {"design_id": "trap-s-08", "user_name": "Иван П.", "rating": 4, "text": "Чёткие линии, хороший объём. Доволен покупкой."},
        {"design_id": "trap-s-08", "user_name": "Анна С.", "rating": 5, "text": "Геометрия на стене — именно то, что искала для кабинета."},
        {"design_id": "zig-s-09", "user_name": "Елена В.", "rating": 5, "text": "Зигзаг — это движение на стене! Невероятная энергетика."},
        {"design_id": "zig-s-09", "user_name": "Олег К.", "rating": 5, "text": "Динамичный рельеф, который оживляет любое пространство."},
        {"design_id": "zig-s-09", "user_name": "Дмитрий М.", "rating": 4, "text": "Интересный паттерн, хорошо сочетается с металлом."},
        {"design_id": "wav-s-10", "user_name": "Иван П.", "rating": 5, "text": "Волна — наш фаворит! Свет скользит по поверхности как по воде."},
        {"design_id": "wav-s-10", "user_name": "Анна С.", "rating": 5, "text": "Заказали на всю стену в гостиной — эффект просто космический."},
        {"design_id": "wav-s-10", "user_name": "Елена В.", "rating": 5, "text": "Самая красивая форма в коллекции. Не пожалели ни секунды."},
        {"design_id": "sqr-s-11", "user_name": "Олег К.", "rating": 5, "text": "Квадраты создают игру объёмов. Современно и свежо."},
        {"design_id": "sqr-s-11", "user_name": "Дмитрий М.", "rating": 4, "text": "Мозаичный эффект — то, что нужно для лофта."},
        {"design_id": "pyr-s-12", "user_name": "Иван П.", "rating": 5, "text": "Кессон — классика! Стена выглядит как в итальянском палаццо."},
        {"design_id": "pyr-s-12", "user_name": "Анна С.", "rating": 5, "text": "Ступенчатая рамка придаёт глубину и торжественность."},
        {"design_id": "pyr-s-12", "user_name": "Елена В.", "rating": 5, "text": "Для классического интерьера — идеальный выбор."},
        {"design_id": "rdiv-s-13", "user_name": "Олег К.", "rating": 4, "text": "Минималистичный ригель. Подошёл для акцента над диваном."},
        {"design_id": "rdiv-s-13", "user_name": "Дмитрий М.", "rating": 5, "text": "Строго и лаконично. Именно такой рельеф и искал."},
        {"design_id": "cdiv-s-14", "user_name": "Иван П.", "rating": 5, "text": "Цилиндр ловит свет по-особенному. Очень тактильная форма."},
        {"design_id": "cdiv-s-14", "user_name": "Анна С.", "rating": 4, "text": "Необычная скульптурная форма, хорошо в паре с подсветкой."},
        # 30×60
        {"design_id": "flat-m-01", "user_name": "Елена В.", "rating": 5, "text": "Вертикальный формат визуально поднимает потолки."},
        {"design_id": "flat-m-01", "user_name": "Олег К.", "rating": 4, "text": "Простая и функциональная. Хорошая основа для текстуры."},
        {"design_id": "rslat-m-02", "user_name": "Дмитрий М.", "rating": 5, "text": "Рейки в вертикальном формате — коридор стал вдвое просторнее визуально."},
        {"design_id": "rslat-m-02", "user_name": "Иван П.", "rating": 5, "text": "Поставил в прихожую — потолки кажутся на метр выше."},
        {"design_id": "rslat-m-02", "user_name": "Анна С.", "rating": 4, "text": "Ритмичные рейки, отличное качество материала."},
        {"design_id": "cslat-m-03", "user_name": "Елена В.", "rating": 5, "text": "Каскад — глубина рельефа впечатляет. Очень объёмно!"},
        {"design_id": "cslat-m-03", "user_name": "Олег К.", "rating": 4, "text": "Ступенчатые планки хорошо играют со светом."},
        {"design_id": "ddia-m-04", "user_name": "Дмитрий М.", "rating": 5, "text": "Двойная диагональ — это шедевр! Узор как на дизайнерских обоях."},
        {"design_id": "ddia-m-04", "user_name": "Иван П.", "rating": 5, "text": "Сложная геометрия, но монтаж прост. Результат превзошёл ожидания."},
        {"design_id": "ddia-m-04", "user_name": "Анна С.", "rating": 5, "text": "Эффект плетения — все гости в восторге!"},
        {"design_id": "her-m-05", "user_name": "Елена В.", "rating": 5, "text": "Ёлочка — вечная классика. Смотрится дорого и солидно."},
        {"design_id": "her-m-05", "user_name": "Олег К.", "rating": 4, "text": "Паркетный рисунок на стене — неожиданно и красиво."},
        {"design_id": "her-m-05", "user_name": "Дмитрий М.", "rating": 5, "text": "С текстурой дерева — невозможно отличить от настоящего паркета."},
        {"design_id": "clo-m-06", "user_name": "Иван П.", "rating": 5, "text": "Кристалл — игра граней при свете свечей завораживает!"},
        {"design_id": "clo-m-06", "user_name": "Анна С.", "rating": 5, "text": "Как драгоценный камень на стене. Люкс!"},
        {"design_id": "clo-m-06", "user_name": "Елена В.", "rating": 4, "text": "Объёмные грани создают неповторимый рельеф. Рекомендую."},
        {"design_id": "seg-m-07", "user_name": "Олег К.", "rating": 5, "text": "Сегменты — архитектурная элегантность. Кабинет преобразился."},
        {"design_id": "seg-m-07", "user_name": "Дмитрий М.", "rating": 4, "text": "Шестиугольники в удлинённом виде — современно и стильно."},
        {"design_id": "ncm-m-08", "user_name": "Иван П.", "rating": 4, "text": "Тонкие рёбра — как вельвет на стене. Приятная тактильность."},
        {"design_id": "ncm-m-08", "user_name": "Анна С.", "rating": 5, "text": "С текстурой текстиля — невероятно уютно."},
        {"design_id": "nmol-m-09", "user_name": "Елена В.", "rating": 5, "text": "Молдинг по центру — классика в современном прочтении. Элегантно."},
        {"design_id": "nmol-m-09", "user_name": "Олег К.", "rating": 4, "text": "Филёнка без лишних деталей. Хорошо подходит для спальни."},
        {"design_id": "wcm-m-10", "user_name": "Дмитрий М.", "rating": 5, "text": "Широкий гребень напоминает застывшие волны. Медитативно."},
        {"design_id": "wcm-m-10", "user_name": "Иван П.", "rating": 4, "text": "Плавный профиль хорошо рассеивает свет."},
        {"design_id": "wmol-m-11", "user_name": "Анна С.", "rating": 5, "text": "Широкий молдинг — для тех, кто не боится классики. Великолепно!"},
        {"design_id": "wmol-m-11", "user_name": "Елена В.", "rating": 5, "text": "С текстурой камня — комната стала похожа на галерею."},
        {"design_id": "wmol-m-11", "user_name": "Олег К.", "rating": 4, "text": "Выраженная рамка — солидно и основательно."},
        {"design_id": "tet-m-12", "user_name": "Дмитрий М.", "rating": 5, "text": "Тетра — геометрическая загадка. Форма меняется от угла обзора!"},
        {"design_id": "tet-m-12", "user_name": "Иван П.", "rating": 5, "text": "Четыре грани к центру — необычно и завораживающе."},
        # 60×60
        {"design_id": "flat-l-01", "user_name": "Анна С.", "rating": 5, "text": "Большая плоская панель — быстро закрыли всю стену. Идеально!"},
        {"design_id": "flat-l-01", "user_name": "Елена В.", "rating": 4, "text": "Максимум площади за один элемент — экономия времени на монтаже."},
        {"design_id": "frel-l-02", "user_name": "Олег К.", "rating": 5, "text": "Плавный рельеф — стена играет как шёлк при вечернем свете."},
        {"design_id": "frel-l-02", "user_name": "Дмитрий М.", "rating": 5, "text": "Волнообразные переходы — это магия! Гостиная стала галереей."},
        {"design_id": "frel-l-02", "user_name": "Иван П.", "rating": 4, "text": "Мягкие волны отлично подошли к минималистичному интерьеру."},
        {"design_id": "crel-l-03", "user_name": "Анна С.", "rating": 5, "text": "Классический рельеф — основа нашего интерьера. Безупречно!"},
        {"design_id": "crel-l-03", "user_name": "Елена В.", "rating": 5, "text": "Филёнка большого формата — как настоящие деревянные панели."},
        {"design_id": "crel-l-03", "user_name": "Олег К.", "rating": 5, "text": "Для классики — лучший выбор. Заказал на 3 комнаты!"},
        {"design_id": "brk-l-04", "user_name": "Дмитрий М.", "rating": 5, "text": "Кирпич — лофт без ремонта! Выглядит как настоящая кладка."},
        {"design_id": "brk-l-04", "user_name": "Иван П.", "rating": 5, "text": "Кирпичная стена за час. Соседи не верят, что это панели."},
        {"design_id": "brk-l-04", "user_name": "Анна С.", "rating": 4, "text": "Объёмные швы дают реалистичный эффект. Очень довольна."},
        {"design_id": "lwav-l-05", "user_name": "Елена В.", "rating": 5, "text": "Длинная волна на большой стене — это океан в комнате."},
        {"design_id": "lwav-l-05", "user_name": "Олег К.", "rating": 5, "text": "Амплитуда рельефа раскрывается на площади. Потрясающе!"},
        {"design_id": "lwav-l-05", "user_name": "Дмитрий М.", "rating": 4, "text": "Крупная волна хорошо сочетается с текстурой камня."},
        {"design_id": "cir-l-06", "user_name": "Иван П.", "rating": 5, "text": "Круг — дзен на стене. Медитирую каждый вечер глядя на неё."},
        {"design_id": "cir-l-06", "user_name": "Анна С.", "rating": 5, "text": "Спокойная форма — идеально для спальни или yoga-зоны."},
        {"design_id": "cir-l-06", "user_name": "Елена В.", "rating": 5, "text": "Минимализм и гармония в одной панели. Шедевр."},
        {"design_id": "rho-l-07", "user_name": "Олег К.", "rating": 5, "text": "Ромб с фаской — art deco прямо в квартире!"},
        {"design_id": "rho-l-07", "user_name": "Дмитрий М.", "rating": 4, "text": "Строгая геометрия, хорошо вписалась в кабинет."},
        {"design_id": "mos-l-08", "user_name": "Иван П.", "rating": 5, "text": "Мозаика ловит свет с каждой грани по-своему. Живая стена!"},
        {"design_id": "mos-l-08", "user_name": "Анна С.", "rating": 4, "text": "Каждый прямоугольник под своим углом — красивая игра теней."},
        {"design_id": "ffrm-l-09", "user_name": "Елена В.", "rating": 4, "text": "Плоская рамка — сдержанно и со вкусом. Для минималистов."},
        {"design_id": "ffrm-l-09", "user_name": "Олег К.", "rating": 5, "text": "Простая форма, но именно такая деталь завершает интерьер."},
        {"design_id": "pfrm-l-10", "user_name": "Дмитрий М.", "rating": 5, "text": "Профильная рамка — глубина за счёт фаски впечатляет."},
        {"design_id": "pfrm-l-10", "user_name": "Иван П.", "rating": 4, "text": "Скошенный профиль даёт красивую тень. Хорошая форма."},
        {"design_id": "cfrm-l-11", "user_name": "Анна С.", "rating": 5, "text": "Классическая рамка — буазери мечты! Комната стала дворцом."},
        {"design_id": "cfrm-l-11", "user_name": "Елена В.", "rating": 5, "text": "Многоступенчатый профиль — каждая ступень ловит свет."},
        {"design_id": "cfrm-l-11", "user_name": "Олег К.", "rating": 5, "text": "Для классического интерьера ничего лучше не найти."},
    ]
    for rd in reviews_data:
        r = DesignReview(id=str(uuid4()), design_id=rd["design_id"], user_id="",
                         user_name=rd["user_name"], rating=rd["rating"], text=rd["text"])
        await _mem_review_repo.add(r)
    print(f"Reviews seeded: {len(reviews_data)}", file=sys.stderr)

    # ── Orders ────────────────────────────────────────────────────────
    import datetime
    orders = [
        Order(id="order-1", number="WW-2024-0001", user_id="user-1", status=OrderStatus.INSTALLED,
              items=[OrderItem(id="oi-1", design_id="d-1", design_name="Тропический лес",
                               design_image="/images/design-1.jpg", size_key="600x600",
                               color="Зелёный", quantity=4, unit_price=2490+1200),
                     OrderItem(id="oi-2", design_id="d-5", design_name="Абстракция «Космос»",
                               design_image="/images/design-5.jpg", size_key="300x600",
                               color="Индиго", quantity=2, unit_price=1490+1200)],
              address=Address(city="Москва", street="ул. Пушкина", building="10", apartment="5"),
              created_at=datetime.datetime(2024,10,1,12,0), updated_at=datetime.datetime(2024,10,15,18,0)),
        Order(id="order-2", number="WW-2024-0002", user_id="user-2", status=OrderStatus.DELIVERED,
              items=[OrderItem(id="oi-3", design_id="d-9", design_name="Минимализм «Линии»",
                               design_image="/images/design-9.jpg", size_key="300x300",
                               color="Белый", quantity=6, unit_price=890+1200)],
              address=Address(city="Москва", street="пр. Мира", building="25", apartment="12"),
              created_at=datetime.datetime(2024,11,10,9,30), updated_at=datetime.datetime(2024,11,20,14,0)),
        Order(id="order-3", number="WW-2024-0003", user_id="user-3", status=OrderStatus.IN_PROGRESS,
              items=[OrderItem(id="oi-4", design_id="d-5", design_name="Абстракция «Космос»",
                               design_image="/images/design-5.jpg", size_key="600x600",
                               color="Индиго", quantity=3, unit_price=2490+1200),
                     OrderItem(id="oi-5", design_id="d-4", design_name="Абстракция «Поток»",
                               design_image="/images/design-4.jpg", size_key="600x600",
                               color="Розовый", quantity=1, unit_price=2490+1200)],
              address=Address(city="Москва", street="ул. Ленина", building="5"),
              created_at=datetime.datetime(2024,12,1,16,0), updated_at=datetime.datetime(2024,12,5,10,0)),
        Order(id="order-4", number="WW-2024-0004", user_id="user-4", status=OrderStatus.CONFIRMED,
              items=[OrderItem(id="oi-6", design_id="d-2", design_name="Горный пейзаж",
                               design_image="/images/design-2.jpg", size_key="300x600",
                               color="Серый", quantity=4, unit_price=1490+1200)],
              address=Address(city="Санкт-Петербург", street="Невский пр.", building="100", apartment="301"),
              created_at=datetime.datetime(2024,12,15,11,0), updated_at=datetime.datetime(2024,12,15,11,0)),
        Order(id="order-5", number="WW-2024-0005", user_id="user-5", status=OrderStatus.PLACED,
              items=[OrderItem(id="oi-7", design_id="d-7", design_name="Геометрия «Гексагон»",
                               design_image="/images/design-7.jpg", size_key="300x300",
                               color="Золотой", quantity=8, unit_price=890+1200)],
              address=Address(city="Москва", street="ул. Гагарина", building="3"),
              created_at=datetime.datetime(2024,12,20,14,30), updated_at=datetime.datetime(2024,12,20,14,30)),
        Order(id="order-6", number="WW-2024-0006", user_id="user-1", status=OrderStatus.CANCELLED,
              items=[OrderItem(id="oi-8", design_id="d-3", design_name="Океанская волна",
                               design_image="/images/design-3.jpg", size_key="600x600",
                               color="Синий", quantity=2, unit_price=2490+1200)],
              address=Address(city="Москва", street="ул. Пушкина", building="10", apartment="5"),
              cancel_reason="Покупатель отменил — передумал",
              created_at=datetime.datetime(2024,11,5,8,0), updated_at=datetime.datetime(2024,11,6,10,0)),
    ]
    for o in orders:
        await _mem_order_repo.create(o)
    print(f"Orders seeded: {len(orders)}", file=sys.stderr)

    # ── Subscriptions ──────────────────────────────────────────────────
    subs = [
        Subscription(id="sub-1", user_id="user-1", plan_id="popular",
                     status=SubscriptionStatus.ACTIVE, area_used_this_month_m2=12.5),
        Subscription(id="sub-2", user_id="user-2", plan_id="starter",
                     status=SubscriptionStatus.ACTIVE, area_used_this_month_m2=5.0),
        Subscription(id="sub-3", user_id="user-4", plan_id="business",
                     status=SubscriptionStatus.ACTIVE, area_used_this_month_m2=0.0),
    ]
    for s in subs:
        if await _mem_subscription_repo.get_active_by_user(s.user_id) is None:
            await _mem_subscription_repo.create(s)
    print(f"Subscriptions seeded: {len(subs)}", file=sys.stderr)

    # ── Panels ─────────────────────────────────────────────────────────
    panels = [
        Panel(id="panel-1", name="Квадрат 30×30", slug="square-30x30",
              size=PanelSize(300,300,"30×30 см"), base_price=890,
              description="Классический квадратный элемент",
              photo_path="/images/panels/square-30x30.jpg", is_active=True),
        Panel(id="panel-2", name="Прямоугольник 30×60", slug="rectangle-30x60",
              size=PanelSize(300,600,"30×60 см"), base_price=1490,
              description="Вертикальный прямоугольник",
              photo_path="/images/panels/rectangle-30x60.jpg", is_active=True),
        Panel(id="panel-3", name="Квадрат 60×60", slug="square-60x60",
              size=PanelSize(600,600,"60×60 см"), base_price=2490,
              description="Большой квадратный элемент",
              photo_path="/images/panels/square-60x60.jpg", is_active=True),
    ]
    for p in panels:
        if await _mem_panel_repo.get_by_slug(p.slug) is None:
            await _mem_panel_repo.create(p)
    print(f"Panels seeded: {len(panels)}", file=sys.stderr)

    # ── Shop settings ─────────────────────────────────────────────────
    _mem_shop_settings_repo._settings = ShopSettings(
        id="singleton", design_overlay_price=1200, installation_price=0,
        min_order_amount=0, recommendations_limit_per_source=12,
    )
    print("Shop settings seeded", file=sys.stderr)

    # ── Banners ────────────────────────────────────────────────────────
    banners = [
        Banner(id="banner-1", title="Новая коллекция «Космос»",
               subtitle="Абстрактные дизайны для современного интерьера",
               image_path="/images/banners/cosmos-hero.jpg",
               cta_label="Смотреть каталог", cta_url="/catalog?category=abstract",
               position=BannerPosition.HOMEPAGE_HERO, priority=0, is_active=True),
        Banner(id="banner-2", title="Монтаж за 1 день",
               subtitle="Профессиональная установка без грязи и пыли",
               image_path="/images/banners/install-banner.jpg",
               cta_label="Заказать замер", cta_url="/contacts",
               position=BannerPosition.CATALOG_TOP, priority=0, is_active=True),
        Banner(id="banner-3", title="Скидка 15% на первый заказ",
               subtitle="Только до конца месяца",
               image_path="/images/banners/discount-footer.jpg",
               cta_label="Получить скидку", cta_url="/register",
               position=BannerPosition.FOOTER, priority=0, is_active=True),
    ]
    for b in banners:
        if await _mem_banner_repo.get_by_id(b.id) is None:
            await _mem_banner_repo.create(b)
    print(f"Banners seeded: {len(banners)}", file=sys.stderr)

    # ── Textures & Colors ──────────────────────────────────────────────
    from app.domain.catalog.texture import Texture
    from app.domain.catalog.texture_color import TextureColor
    from app.container import _mem_texture_repo, _mem_texture_color_repo

    textures_data = [
        ("tex-leather",  "Кожа",                "leather",      1),
        ("tex-textile",  "Текстиль",            "textile",      2),
        ("tex-wood",     "Дерево",              "wood",         3),
        ("tex-metal",    "Металл",              "metal",        4),
        ("tex-stone",    "Природный камень",    "natural-stone", 5),
        ("tex-decorative","Декоративные фактуры","decorative",   6),
        ("tex-paint",    "Краска",              "paint",        7),
        ("tex-graphics", "Графика",             "graphics",     8),
    ]
    colors_data = {
        "tex-leather": [
            ("Шоколад",        "#5C3317"),
            ("Карамель",        "#C68E5B"),
            ("Слоновая кость",  "#FFFFF0"),
            ("Чёрный",          "#1A1A1A"),
            ("Бордо",           "#800020"),
        ],
        "tex-textile": [
            ("Лён",       "#E8DCC8"),
            ("Графит",    "#4A4A4A"),
            ("Лаванда",   "#B8A9C9"),
            ("Изумруд",   "#2D7D46"),
            ("Терракот",  "#CC5C3C"),
        ],
        "tex-wood": [
            ("Натуральный дуб", "#C4A882"),
            ("Тёмный орех",     "#5C4033"),
            ("Берёза",          "#F5E6CC"),
            ("Венге",           "#3C2415"),
            ("Ясень",           "#D4C5A9"),
        ],
        "tex-metal": [
            ("Сталь",     "#71797E"),
            ("Бронза",    "#CD7F32"),
            ("Золото",    "#D4AF37"),
            ("Медь",      "#B87333"),
            ("Чернёный",  "#2C2C2C"),
        ],
        "tex-stone": [
            ("Каррарский мрамор", "#F0EDE5"),
            ("Серый гранит",      "#808080"),
            ("Оникс",             "#353839"),
            ("Травертин",         "#D2C6B2"),
            ("Сланец",            "#54585A"),
        ],
        "tex-decorative": [
            ("Белая штукатурка",       "#F5F2ED"),
            ("Серый бетон",            "#A0A0A0"),
            ("Терракотовая штукатурка", "#CC7755"),
            ("Песчаник",               "#D2B48C"),
            ("Антрацит",               "#293133"),
        ],
        "tex-paint": [
            ("Белый",          "#FFFFFF"),
            ("Слоновая кость", "#FAEBD7"),
            ("Пыльная роза",   "#DCAE96"),
            ("Серо-голубой",   "#6D8EA0"),
            ("Оливковый",      "#808000"),
        ],
        "tex-graphics": [
            ("Монохром",          "#2D2D2D"),
            ("Индиго",            "#3F51B5"),
            ("Терракот",          "#E07C5A"),
            ("Золотой орнамент",  "#C9A84C"),
            ("Изумрудный",        "#00695C"),
        ],
    }

    tex_count = 0
    color_count = 0
    for tex_id, tex_name, tex_slug, sort_order in textures_data:
        existing = await _mem_texture_repo.get_by_slug(tex_slug)
        if existing is None:
            tex = Texture(id=tex_id, name=tex_name, slug=tex_slug,
                          swatch_image="", sort_order=sort_order, is_active=True)
            await _mem_texture_repo.create(tex)
            tex_count += 1

        for idx, (color_name, color_hex) in enumerate(colors_data.get(tex_id, [])):
            color_id = f"{tex_id}-c{idx+1}"
            existing_colors = await _mem_texture_color_repo.list_by_texture(tex_id, include_inactive=True)
            if not any(c.id == color_id for c in existing_colors):
                tc = TextureColor(id=color_id, texture_id=tex_id, name=color_name,
                                  hex=color_hex, swatch_image="", sort_order=idx,
                                  is_active=True)
                await _mem_texture_color_repo.create(tc)
                color_count += 1

    print(f"Textures seeded: {tex_count}, Colors seeded: {color_count}", file=sys.stderr)

    # ── Variant Images (link every design to every texture+color) ─────
    from app.domain.catalog.variant_image import VariantImage
    from app.container import _mem_variant_image_repo
    from app.seed_data import SEED_DESIGNS, SEED_TEXTURES

    vi_count = 0
    for design in SEED_DESIGNS:
        for tex_data in SEED_TEXTURES:
            for idx, color_data in enumerate(tex_data["colors"]):
                vi_id = f"vi-{design.id}-{tex_data['id']}-{idx}"
                vi = VariantImage(
                    id=vi_id,
                    design_id=design.id,
                    texture_id=tex_data["id"],
                    color_id=color_data["id"],
                    image_path="",
                )
                try:
                    await _mem_variant_image_repo.create(vi)
                    vi_count += 1
                except Exception:
                    pass
    print(f"Variant images seeded: {vi_count}", file=sys.stderr)

    # ── Recommendations (каждая форма → 3 похожие) ─────────────────────
    targets_data = [
        # 30×30: внутри категории + cross-size
        ("flat-s-01", ["tslat-s-02", "wslat-s-03", "flat-m-01"]),
        ("tslat-s-02", ["wslat-s-03", "dslat-s-04", "rslat-m-02"]),
        ("wslat-s-03", ["tslat-s-02", "key-s-05", "cslat-m-03"]),
        ("dslat-s-04", ["zig-s-09", "trap-s-08", "ddia-m-04"]),
        ("key-s-05", ["wslat-s-03", "rdiv-s-13", "flat-s-01"]),
        ("col-s-06", ["arc-s-07", "pyr-s-12", "crel-l-03"]),
        ("arc-s-07", ["col-s-06", "wav-s-10", "cir-l-06"]),
        ("trap-s-08", ["sqr-s-11", "dslat-s-04", "rho-l-07"]),
        ("zig-s-09", ["wav-s-10", "dslat-s-04", "her-m-05"]),
        ("wav-s-10", ["zig-s-09", "arc-s-07", "lwav-l-05"]),
        ("sqr-s-11", ["trap-s-08", "pyr-s-12", "mos-l-08"]),
        ("pyr-s-12", ["col-s-06", "cdiv-s-14", "cfrm-l-11"]),
        ("rdiv-s-13", ["key-s-05", "cdiv-s-14", "nmol-m-09"]),
        ("cdiv-s-14", ["rdiv-s-13", "arc-s-07", "wcm-m-10"]),
        # 30×60: внутри категории + cross-size
        ("flat-m-01", ["rslat-m-02", "nmol-m-09", "flat-s-01"]),
        ("rslat-m-02", ["cslat-m-03", "ncm-m-08", "tslat-s-02"]),
        ("cslat-m-03", ["rslat-m-02", "wcm-m-10", "wslat-s-03"]),
        ("ddia-m-04", ["her-m-05", "tet-m-12", "dslat-s-04"]),
        ("her-m-05", ["ddia-m-04", "seg-m-07", "zig-s-09"]),
        ("clo-m-06", ["tet-m-12", "seg-m-07", "rho-l-07"]),
        ("seg-m-07", ["clo-m-06", "her-m-05", "mos-l-08"]),
        ("ncm-m-08", ["wcm-m-10", "rslat-m-02", "tslat-s-02"]),
        ("nmol-m-09", ["wmol-m-11", "flat-m-01", "rdiv-s-13"]),
        ("wcm-m-10", ["ncm-m-08", "cslat-m-03", "lwav-l-05"]),
        ("wmol-m-11", ["nmol-m-09", "cslat-m-03", "cfrm-l-11"]),
        ("tet-m-12", ["clo-m-06", "ddia-m-04", "sqr-s-11"]),
        # 60×60: внутри категории + cross-size
        ("flat-l-01", ["frel-l-02", "ffrm-l-09", "flat-m-01"]),
        ("frel-l-02", ["lwav-l-05", "cir-l-06", "wav-s-10"]),
        ("crel-l-03", ["cfrm-l-11", "pfrm-l-10", "pyr-s-12"]),
        ("brk-l-04", ["mos-l-08", "crel-l-03", "sqr-s-11"]),
        ("lwav-l-05", ["frel-l-02", "cir-l-06", "wav-s-10"]),
        ("cir-l-06", ["frel-l-02", "rho-l-07", "arc-s-07"]),
        ("rho-l-07", ["cir-l-06", "pfrm-l-10", "trap-s-08"]),
        ("mos-l-08", ["brk-l-04", "crel-l-03", "sqr-s-11"]),
        ("ffrm-l-09", ["pfrm-l-10", "cfrm-l-11", "flat-l-01"]),
        ("pfrm-l-10", ["ffrm-l-09", "cfrm-l-11", "crel-l-03"]),
        ("cfrm-l-11", ["pfrm-l-10", "crel-l-03", "wmol-m-11"]),
    ]
    rec_count = 0
    for source_id, target_ids in targets_data:
        key = (RecommendationSourceType.DESIGN, source_id)
        rec = Recommendation(
            id=f"rec-{source_id}",
            source_type=RecommendationSourceType.DESIGN,
            source_id=source_id,
        )
        for tid in target_ids:
            rec.targets.append(RecommendationTarget(
                target_type=RecommendationTargetType.DESIGN,
                target_id=tid,
            ))
        existing = await _mem_recommendation_repo.find_by_source(rec.source_type, rec.source_id)
        if existing is None:
            await _mem_recommendation_repo.save(rec)
            rec_count += 1
    print(f"Recommendations seeded: {len(targets_data)} sources, {rec_count} new", file=sys.stderr)


def run():
    import uvicorn
    # Seed everything first
    asyncio.run(seed_everything())
    # Then run server
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=False)


if __name__ == "__main__":
    run()