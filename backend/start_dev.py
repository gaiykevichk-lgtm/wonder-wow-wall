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

    # ── Reviews ───────────────────────────────────────────────────────
    reviews_data = [
        {"design_id": "d-1", "user_name": "Иван П.", "rating": 5, "text": "Потрясающее качество!"},
        {"design_id": "d-1", "user_name": "Анна С.", "rating": 4, "text": "Очень красиво, но монтаж сложнее."},
        {"design_id": "d-1", "user_name": "Елена В.", "rating": 5, "text": "Заказала на всю стену!"},
        {"design_id": "d-2", "user_name": "Олег К.", "rating": 5, "text": "Горы выглядят очень реалистично."},
        {"design_id": "d-2", "user_name": "Дмитрий М.", "rating": 4, "text": "Хороший дизайн."},
        {"design_id": "d-3", "user_name": "Иван П.", "rating": 5, "text": "Океан создаёт атмосферу спокойствия."},
        {"design_id": "d-4", "user_name": "Елена В.", "rating": 5, "text": "Современный дизайн."},
        {"design_id": "d-5", "user_name": "Олег К.", "rating": 5, "text": "Космос завораживает!"},
        {"design_id": "d-5", "user_name": "Дмитрий М.", "rating": 5, "text": "Идеально для спальни."},
        {"design_id": "d-7", "user_name": "Иван П.", "rating": 4, "text": "Геометрия смотрится стильно."},
        {"design_id": "d-9", "user_name": "Анна С.", "rating": 5, "text": "Минимализм — идеально."},
    ]
    for rd in reviews_data:
        from uuid import uuid4
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

    # ── Recommendations ───────────────────────────────────────────────
    targets_data = [
        ("d-1","d-2",1), ("d-1","d-5",2), ("d-1","d-12",3),
        ("d-5","d-4",1), ("d-5","d-1",2),
        ("d-9","d-10",1), ("d-9","d-6",2),
    ]
    rec_map: dict[tuple, Recommendation] = {}
    for source_id, target_id, _order in targets_data:
        key = (RecommendationSourceType.DESIGN, source_id)
        if key not in rec_map:
            rec_map[key] = Recommendation(
                id=f"rec-{source_id}",
                source_type=RecommendationSourceType.DESIGN,
                source_id=source_id,
            )
        rec_map[key].targets.append(RecommendationTarget(
            target_type=RecommendationTargetType.DESIGN,
            target_id=target_id,
        ))
    for rec in rec_map.values():
        existing = await _mem_recommendation_repo.find_by_source(rec.source_type, rec.source_id)
        if existing is None:
            await _mem_recommendation_repo.save(rec)
    print(f"Recommendations seeded: {len(targets_data)} targets across {len(rec_map)} sources", file=sys.stderr)


def run():
    import uvicorn
    # Seed everything first
    asyncio.run(seed_everything())
    # Then run server
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=False)


if __name__ == "__main__":
    run()