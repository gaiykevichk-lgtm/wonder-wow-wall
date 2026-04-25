"""Phase 8C — `/api/admin/subscription-plans` integration tests."""
from datetime import datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_audit_repo,
    _mem_subscription_plan_repo,
    _mem_subscription_repo,
)
from app.container import user_repo as _mem_user_repo
from app.domain.subscription.entities import Subscription
from app.domain.subscription.value_objects import SubscriptionStatus
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    _mem_user_repo._users.clear()
    # Snapshot/restore the seed plans (3 baseline tariffs) so deletes
    # in this suite don't cascade to other API tests in the suite run.
    saved_plans = list(_mem_subscription_plan_repo._plans)
    saved_subs = list(_mem_subscription_repo._subs)
    _mem_audit_repo._entries.clear()
    yield
    _mem_user_repo._users.clear()
    _mem_audit_repo._entries.clear()
    _mem_subscription_plan_repo._plans.clear()
    _mem_subscription_plan_repo._plans.extend(saved_plans)
    _mem_subscription_repo._subs.clear()
    _mem_subscription_repo._subs.extend(saved_subs)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _admin_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Admin", "email": "admin@test.com",
            "phone": "+7 999 000 00 00", "password": "secret123",
        },
    )
    user_id = resp.json()["user"]["id"]
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id,
    )
    login = await client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "secret123"},
    )
    return login.json()["token"]


def _payload(plan_id="vip", **over):
    base = {
        "id": plan_id, "name": "VIP", "price": 25000, "period": "мес",
        "area_limit_m2": 50.0, "popular": False,
        "is_active": True, "sort_order": 5,
        "features": ["A", "B"],
    }
    base.update(over)
    return base


class TestList:
    @pytest.mark.asyncio
    async def test_list_includes_seed_plans(self, client):
        # The container seeds the 3 baseline plans (`starter`, `popular`,
        # `business`); admin list must show all of them.
        token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/subscription-plans",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        ids = {p["id"] for p in resp.json()["items"]}
        assert {"starter", "popular", "business"}.issubset(ids)


class TestCreate:
    @pytest.mark.asyncio
    async def test_happy_201(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/subscription-plans",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["id"] == "vip"

    @pytest.mark.asyncio
    async def test_id_conflict_409(self, client):
        token = await _admin_token(client)
        resp = await client.post(
            "/api/admin/subscription-plans",
            headers={"Authorization": f"Bearer {token}"},
            # `starter` is one of the seeded plans.
            json=_payload(plan_id="starter"),
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "subscription_plan_id_conflict"


class TestPatch:
    @pytest.mark.asyncio
    async def test_unknown_404(self, client):
        token = await _admin_token(client)
        resp = await client.patch(
            "/api/admin/subscription-plans/missing",
            headers={"Authorization": f"Bearer {token}"},
            json={"price": 100},
        )
        assert resp.status_code == 404
        assert resp.json()["code"] == "subscription_plan_not_found"

    @pytest.mark.asyncio
    async def test_patch_price(self, client):
        token = await _admin_token(client)
        # Price-bump on the seeded `starter` plan.
        resp = await client.patch(
            "/api/admin/subscription-plans/starter",
            headers={"Authorization": f"Bearer {token}"},
            json={"price": 7500},
        )
        assert resp.status_code == 200
        assert resp.json()["price"] == 7500


class TestDelete:
    @pytest.mark.asyncio
    async def test_happy_204(self, client):
        token = await _admin_token(client)
        # Create a fresh plan with no subscriptions, then delete it.
        await client.post(
            "/api/admin/subscription-plans",
            headers={"Authorization": f"Bearer {token}"},
            json=_payload(plan_id="trial"),
        )
        resp = await client.delete(
            "/api/admin/subscription-plans/trial",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_in_use_409(self, client):
        token = await _admin_token(client)
        # Seed an active subscription pointing at `popular`.
        sub = Subscription(
            user_id="u1", plan_id="popular",
            status=SubscriptionStatus.ACTIVE,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        _mem_subscription_repo._subs.append(sub)
        resp = await client.delete(
            "/api/admin/subscription-plans/popular",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "subscription_plan_in_use"

    @pytest.mark.asyncio
    async def test_missing_404(self, client):
        token = await _admin_token(client)
        resp = await client.delete(
            "/api/admin/subscription-plans/missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
