"""Phase 4A — `ListOrdersAdmin` use case tests.

Wire-level behavior of the use case is trivial; what matters here is that
the page/size validation rejects garbage input AND the InMemory repo, fed
through the same use case, returns the right slice for various filter
combinations. Repo behaviour is tested via the use case (vs. directly) so
the contract is exercised end-to-end inside the application layer.
"""
from datetime import datetime, timedelta

import pytest

from app.application.order.use_cases import ListOrdersAdmin
from app.domain.order.entities import Order, OrderItem
from app.domain.order.filters import OrderFilters
from app.domain.order.value_objects import Address, OrderStatus
from app.domain.user.entities import User
from app.infrastructure.persistence.repositories.memory import InMemoryOrderRepository


def _addr() -> Address:
    return Address(city="Москва", street="Пушкина", building="1")


def _make_order(*, number: str, user_id: str, status: OrderStatus, days_ago: int, price: int = 1000) -> Order:
    return Order(
        id=f"order-{number}",
        number=number,
        user_id=user_id,
        status=status,
        items=[OrderItem(design_id="d", design_name="Wall", unit_price=price, quantity=1)],
        address=_addr(),
        created_at=datetime.utcnow() - timedelta(days=days_ago),
    )


@pytest.fixture
def repo_with_orders():
    repo = InMemoryOrderRepository()
    # Spread across statuses, users, and dates so each filter axis can be
    # exercised in isolation.
    orders = [
        _make_order(number="WW-1", user_id="u-1", status=OrderStatus.PLACED, days_ago=1),
        _make_order(number="WW-2", user_id="u-1", status=OrderStatus.DELIVERED, days_ago=10),
        _make_order(number="WW-3", user_id="u-2", status=OrderStatus.IN_PROGRESS, days_ago=2),
        _make_order(number="WW-4", user_id="u-2", status=OrderStatus.PLACED, days_ago=40),
        _make_order(number="WW-5", user_id="u-3", status=OrderStatus.CONFIRMED, days_ago=5),
    ]
    for o in orders:
        repo._orders.append(o)
    return repo


class TestPageSizeValidation:
    @pytest.mark.asyncio
    async def test_page_zero_rejected(self, repo_with_orders):
        with pytest.raises(ValueError):
            await ListOrdersAdmin(repo_with_orders).execute(OrderFilters(), page=0, size=10)

    @pytest.mark.asyncio
    async def test_size_zero_rejected(self, repo_with_orders):
        with pytest.raises(ValueError):
            await ListOrdersAdmin(repo_with_orders).execute(OrderFilters(), page=1, size=0)

    @pytest.mark.asyncio
    async def test_size_above_max_rejected(self, repo_with_orders):
        with pytest.raises(ValueError):
            await ListOrdersAdmin(repo_with_orders).execute(OrderFilters(), page=1, size=999)


class TestFiltering:
    @pytest.mark.asyncio
    async def test_no_filters_returns_all_sorted_newest_first(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(OrderFilters())
        assert total == 5
        # Newest first → days_ago=1 (WW-1) is first
        assert items[0].number == "WW-1"
        # Oldest last → days_ago=40 (WW-4) is last
        assert items[-1].number == "WW-4"

    @pytest.mark.asyncio
    async def test_status_filter(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(status=OrderStatus.PLACED)
        )
        assert total == 2
        assert {o.number for o in items} == {"WW-1", "WW-4"}

    @pytest.mark.asyncio
    async def test_user_filter(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(user_id="u-2")
        )
        assert total == 2
        assert {o.number for o in items} == {"WW-3", "WW-4"}

    @pytest.mark.asyncio
    async def test_date_window(self, repo_with_orders):
        # Last 7 days → WW-1, WW-3, WW-5 (days_ago = 1, 2, 5)
        now = datetime.utcnow()
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(date_from=now - timedelta(days=7), date_to=now + timedelta(seconds=1))
        )
        assert total == 3
        assert {o.number for o in items} == {"WW-1", "WW-3", "WW-5"}

    @pytest.mark.asyncio
    async def test_search_by_order_number(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(search="ww-2")  # case-insensitive
        )
        assert total == 1
        assert items[0].number == "WW-2"

    @pytest.mark.asyncio
    async def test_search_by_user_email_via_users_source(self):
        # When users_source is wired (the production-like setup), search
        # should also match user.email and user.name.
        users = [
            User(id="u-1", email="ivan@test.com", password_hash="x", name="Иван"),
            User(id="u-2", email="petr@test.com", password_hash="x", name="Пётр"),
        ]
        repo = InMemoryOrderRepository(users_source=lambda: users)
        repo._orders = [
            _make_order(number="WW-1", user_id="u-1", status=OrderStatus.PLACED, days_ago=1),
            _make_order(number="WW-2", user_id="u-2", status=OrderStatus.PLACED, days_ago=2),
        ]
        items, total = await ListOrdersAdmin(repo).execute(
            OrderFilters(search="ivan")  # matches u-1's email and name
        )
        assert total == 1
        assert items[0].number == "WW-1"

    @pytest.mark.asyncio
    async def test_combined_filters_AND(self, repo_with_orders):
        # status=PLACED AND user=u-1 → only WW-1
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(status=OrderStatus.PLACED, user_id="u-1")
        )
        assert total == 1
        assert items[0].number == "WW-1"


class TestPagination:
    @pytest.mark.asyncio
    async def test_first_page(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(), page=1, size=2
        )
        assert total == 5  # total ignores pagination
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_last_partial_page(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(), page=3, size=2
        )
        assert total == 5
        assert len(items) == 1

    @pytest.mark.asyncio
    async def test_page_beyond_data_returns_empty(self, repo_with_orders):
        items, total = await ListOrdersAdmin(repo_with_orders).execute(
            OrderFilters(), page=10, size=10
        )
        assert total == 5
        assert items == []
