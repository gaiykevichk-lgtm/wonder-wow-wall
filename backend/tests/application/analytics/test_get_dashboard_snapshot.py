"""Phase 3 — GetDashboardSnapshot use case."""

from datetime import date, datetime, timedelta

import pytest

from app.application.analytics.use_cases import GetDashboardSnapshot
from app.domain.analytics.value_objects import DateRange
from app.domain.order.entities import Order, OrderItem
from app.domain.order.value_objects import Address, OrderStatus
from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole
from app.infrastructure.persistence.repositories.analytics_repo import (
    InMemoryAnalyticsRepository,
)


def _user(created_at: datetime, *, role: UserRole = UserRole.CUSTOMER) -> User:
    return User(
        id=f"u-{created_at.isoformat()}",
        email=f"{created_at.timestamp()}@test.com",
        password_hash="x",
        name="T",
        phone="+7",
        role=role,
        created_at=created_at,
    )


def _order(
    *,
    created_at: datetime,
    status: OrderStatus,
    design_id: str = "d1",
    design_name: str = "Demo",
    price: int = 1000,
    qty: int = 1,
) -> Order:
    return Order(
        id=f"o-{created_at.isoformat()}-{design_id}",
        number="WW-1",
        user_id="u1",
        status=status,
        items=[OrderItem(
            design_id=design_id, design_name=design_name,
            unit_price=price, quantity=qty,
        )],
        address=Address(city="Москва", street="Пушкина", building="1"),
        created_at=created_at,
    )


@pytest.fixture
def today() -> date:
    return date(2026, 4, 24)


@pytest.fixture
def anchor(today) -> datetime:
    return datetime.combine(today, datetime.min.time()) + timedelta(hours=12)


@pytest.fixture
def rng(today) -> DateRange:
    return DateRange.last_n_days(7, today=today)


async def _snap(orders, users, rng, *, top_limit: int = 5):
    repo = InMemoryAnalyticsRepository(
        orders=lambda: orders,
        users=lambda: users,
    )
    return await GetDashboardSnapshot(repo).execute(rng, top_limit=top_limit)


@pytest.mark.asyncio
async def test_empty_data_returns_zero_metrics_and_full_zero_series(rng):
    dto = await _snap([], [], rng)

    assert [m.key for m in dto.metrics] == ["revenue", "orders", "new_users", "avg_order_value"]
    assert [m.value for m in dto.metrics] == [0, 0, 0, 0]

    # Gap-filling contract: one point per day in the range, value=0.
    assert len(dto.revenue_series.points) == rng.days
    assert all(p.value == 0 for p in dto.revenue_series.points)
    assert len(dto.new_users_series.points) == rng.days

    assert dto.orders_by_status == []
    assert dto.top_designs == []


@pytest.mark.asyncio
async def test_revenue_counts_only_revenue_statuses(anchor, rng):
    orders = [
        _order(created_at=anchor, status=OrderStatus.PLACED, price=100),     # NOT counted
        _order(created_at=anchor, status=OrderStatus.CONFIRMED, price=500),  # counted
        _order(created_at=anchor, status=OrderStatus.DELIVERED, price=700),  # counted
    ]
    dto = await _snap(orders, [], rng)

    revenue = next(m for m in dto.metrics if m.key == "revenue").value
    orders_count = next(m for m in dto.metrics if m.key == "orders").value
    avg = next(m for m in dto.metrics if m.key == "avg_order_value").value

    # PLACED is counted in `orders` (3) but not `revenue` (500+700).
    assert revenue == 1200
    assert orders_count == 3
    assert avg == 1200 // 3  # integer division, 400


@pytest.mark.asyncio
async def test_out_of_range_orders_are_excluded(anchor, rng):
    stale = anchor - timedelta(days=30)  # outside last 7 days
    orders = [
        _order(created_at=stale, status=OrderStatus.DELIVERED, price=9999),
        _order(created_at=anchor, status=OrderStatus.DELIVERED, price=100),
    ]
    dto = await _snap(orders, [], rng)

    revenue = next(m for m in dto.metrics if m.key == "revenue").value
    assert revenue == 100


@pytest.mark.asyncio
async def test_orders_by_status_skips_zero_and_preserves_enum_order(anchor, rng):
    orders = [
        _order(created_at=anchor, status=OrderStatus.PLACED),
        _order(created_at=anchor, status=OrderStatus.PLACED),
        _order(created_at=anchor, status=OrderStatus.DELIVERED),
    ]
    dto = await _snap(orders, [], rng)

    # Enum order: placed, confirmed, in_progress, delivered, installed.
    assert [b.status for b in dto.orders_by_status] == ["placed", "delivered"]
    assert [b.count for b in dto.orders_by_status] == [2, 1]


@pytest.mark.asyncio
async def test_top_designs_ranked_by_quantity_desc(anchor, rng):
    orders = [
        _order(created_at=anchor, status=OrderStatus.CONFIRMED,
               design_id="d1", design_name="Alpha", qty=3),
        _order(created_at=anchor, status=OrderStatus.CONFIRMED,
               design_id="d2", design_name="Beta", qty=1),
        _order(created_at=anchor, status=OrderStatus.CONFIRMED,
               design_id="d1", design_name="Alpha", qty=2),
    ]
    dto = await _snap(orders, [], rng, top_limit=5)

    assert [t.design_id for t in dto.top_designs] == ["d1", "d2"]
    assert dto.top_designs[0].orders_count == 5  # 3 + 2
    assert dto.top_designs[1].orders_count == 1


@pytest.mark.asyncio
async def test_new_users_only_counts_users_registered_in_range(anchor, rng):
    users = [
        _user(anchor - timedelta(days=30)),  # old
        _user(anchor),                       # in range
        _user(anchor - timedelta(days=1)),   # in range
    ]
    dto = await _snap([], users, rng)

    new_users = next(m for m in dto.metrics if m.key == "new_users").value
    assert new_users == 2


@pytest.mark.asyncio
async def test_series_points_are_day_bucketed(anchor, rng):
    # Two orders on the same day — they should collapse into ONE point
    # with the summed value.
    orders = [
        _order(created_at=anchor, status=OrderStatus.CONFIRMED, price=100),
        _order(created_at=anchor + timedelta(hours=2),
               status=OrderStatus.DELIVERED, price=150),
    ]
    dto = await _snap(orders, [], rng)

    by_day = {p.day: p.value for p in dto.revenue_series.points}
    assert by_day[anchor.date()] == 250
    # Every other day in the window must still be present with 0.
    assert len(by_day) == rng.days
