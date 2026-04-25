"""Phase 9 — `/api/admin/audit` integration tests.

Same pattern as the other admin/* API tests: in-memory repos, full ASGI
stack via httpx ASGITransport. Verifies:
  * auth/guard chain — 401 (no token), 403 (customer token).
  * pagination envelope shape (`items / total / page / size`).
  * filter contract — by `action`, `actor_id`, `target_type`/`target_id`,
    and date range; bad enum value → 422.
  * end-to-end audit trail: the retrofitted endpoints (block user,
    update order status, patch settings) actually write entries that
    the audit list endpoint can read back.

The retrofitted endpoints already have their own tests for the action
they perform — here we only assert that audit was *additionally*
recorded with the right shape. Pure-write coverage of `RecordAuditEntry`
lives in `tests/application/audit/test_use_cases.py`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.user.use_cases import GrantAdminRole
from app.container import (
    _mem_audit_repo,
    _mem_panel_repo,
    _mem_shop_settings_repo,
    order_repo as _mem_order_repo,
    user_repo as _mem_user_repo,
)
from app.domain.audit.entities import AuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.catalog.panel import Panel
from app.domain.catalog.value_objects import PanelSize
from app.domain.order.entities import Order
from app.domain.order.value_objects import OrderStatus
from app.domain.shop.settings import ShopSettings
from app.main import app


@pytest.fixture(autouse=True)
def _reset_repos():
    _mem_user_repo._users.clear()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0
    _mem_audit_repo._entries.clear()
    _mem_panel_repo._panels.clear()
    # Reset shop settings to a clean singleton so the diff in the audit
    # entry is predictable (same trick test_shop_settings.py uses).
    _mem_shop_settings_repo._settings = ShopSettings()
    yield
    _mem_user_repo._users.clear()
    _mem_order_repo._orders.clear()
    _mem_order_repo._counter = 0
    _mem_audit_repo._entries.clear()
    _mem_panel_repo._panels.clear()
    _mem_shop_settings_repo._settings = ShopSettings()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _register(client: AsyncClient, *, name: str = "U") -> tuple[str, str, str, str]:
    email = f"u-{uuid.uuid4().hex[:8]}@test.com"
    password = "secret123"
    resp = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "phone": "+7 999 000 00 00", "password": password},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return body["user"]["id"], email, password, body["token"]


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def _admin_token(client: AsyncClient) -> tuple[str, str]:
    user_id, email, password, _ = await _register(client, name="Admin")
    await GrantAdminRole(_mem_user_repo).execute(
        actor_id="SYSTEM", target_user_id=user_id,
    )
    token = await _login(client, email, password)
    return user_id, token


# ─── Auth guard ──────────────────────────────────────────────────────


class TestAuthGuard:
    @pytest.mark.asyncio
    async def test_unauth_returns_401(self, client):
        resp = await client.get("/api/admin/audit")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_customer_returns_403(self, client):
        _, _, _, token = await _register(client)
        resp = await client.get(
            "/api/admin/audit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ─── Read shape & pagination ─────────────────────────────────────────


class TestReadShape:
    @pytest.mark.asyncio
    async def test_empty_list_envelope(self, client):
        _, token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/audit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"items": [], "total": 0, "page": 1, "size": 50}

    @pytest.mark.asyncio
    async def test_seeded_entries_returned_desc(self, client):
        _, token = await _admin_token(client)
        # Seed three entries with predictable created_at order so we can
        # assert the DESC sort. Spreading them by 1s avoids datetime
        # collisions on fast machines.
        now = datetime.utcnow()
        _mem_audit_repo._entries.extend([
            AuditEntry(
                actor_id="admin-1",
                action=AuditAction.USER_BLOCK,
                target_type=AuditTargetType.USER,
                target_id="u-1",
                payload={"email": "a@x"},
                created_at=now - timedelta(seconds=2),
            ),
            AuditEntry(
                actor_id="admin-1",
                action=AuditAction.USER_UNBLOCK,
                target_type=AuditTargetType.USER,
                target_id="u-1",
                payload={"email": "a@x"},
                created_at=now - timedelta(seconds=1),
            ),
            AuditEntry(
                actor_id="admin-2",
                action=AuditAction.ORDER_STATUS_CHANGE,
                target_type=AuditTargetType.ORDER,
                target_id="o-9",
                payload={"from": "placed", "to": "confirmed"},
                created_at=now,
            ),
        ])
        resp = await client.get(
            "/api/admin/audit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        # Newest-first ordering — `order_status_change` is the most recent.
        actions = [item["action"] for item in body["items"]]
        assert actions[0] == "order_status_change"
        assert actions[-1] == "user_block"

    @pytest.mark.asyncio
    async def test_pagination_clamps(self, client):
        _, token = await _admin_token(client)
        # 3 entries, page size 2 → page 1 has 2, page 2 has 1.
        for i in range(3):
            _mem_audit_repo._entries.append(AuditEntry(
                actor_id="admin-1",
                action=AuditAction.USER_BLOCK,
                target_type=AuditTargetType.USER,
                target_id=f"u-{i}",
                payload={},
            ))
        resp = await client.get(
            "/api/admin/audit?page=1&size=2",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 3
        assert len(body["items"]) == 2

        resp = await client.get(
            "/api/admin/audit?page=2&size=2",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert len(body["items"]) == 1


# ─── Filters ─────────────────────────────────────────────────────────


class TestFilters:
    @pytest.mark.asyncio
    async def test_filter_by_action(self, client):
        _, token = await _admin_token(client)
        _mem_audit_repo._entries.extend([
            AuditEntry(actor_id="a", action=AuditAction.USER_BLOCK,
                       target_type=AuditTargetType.USER, target_id="u-1", payload={}),
            AuditEntry(actor_id="a", action=AuditAction.USER_UNBLOCK,
                       target_type=AuditTargetType.USER, target_id="u-1", payload={}),
        ])
        resp = await client.get(
            "/api/admin/audit?action=user_block",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["action"] == "user_block"

    @pytest.mark.asyncio
    async def test_filter_by_target(self, client):
        _, token = await _admin_token(client)
        _mem_audit_repo._entries.extend([
            AuditEntry(actor_id="a", action=AuditAction.USER_BLOCK,
                       target_type=AuditTargetType.USER, target_id="u-1", payload={}),
            AuditEntry(actor_id="a", action=AuditAction.ORDER_STATUS_CHANGE,
                       target_type=AuditTargetType.ORDER, target_id="o-1", payload={}),
        ])
        resp = await client.get(
            "/api/admin/audit?target_type=order&target_id=o-1",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["target_type"] == "order"
        assert body["items"][0]["target_id"] == "o-1"

    @pytest.mark.asyncio
    async def test_filter_by_actor(self, client):
        _, token = await _admin_token(client)
        _mem_audit_repo._entries.extend([
            AuditEntry(actor_id="admin-1", action=AuditAction.USER_BLOCK,
                       target_type=AuditTargetType.USER, target_id="u-1", payload={}),
            AuditEntry(actor_id="admin-2", action=AuditAction.USER_BLOCK,
                       target_type=AuditTargetType.USER, target_id="u-2", payload={}),
        ])
        resp = await client.get(
            "/api/admin/audit?actor_id=admin-1",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["actor_id"] == "admin-1"

    @pytest.mark.asyncio
    async def test_invalid_action_returns_422(self, client):
        _, token = await _admin_token(client)
        resp = await client.get(
            "/api/admin/audit?action=nope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422


# ─── End-to-end: write through retrofitted endpoint, read via audit ──


class TestEndToEnd:
    @pytest.mark.asyncio
    async def test_block_user_writes_audit_visible_via_audit_endpoint(self, client):
        admin_id, token = await _admin_token(client)
        # Seed a target user to block.
        target_id, _, _, _ = await _register(client, name="Victim")

        block_resp = await client.post(
            f"/api/admin/users/{target_id}/block",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert block_resp.status_code == 200, block_resp.text

        # Audit endpoint should now show one user_block entry by us.
        audit_resp = await client.get(
            "/api/admin/audit?action=user_block",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = audit_resp.json()
        assert body["total"] == 1
        entry = body["items"][0]
        assert entry["actor_id"] == admin_id
        assert entry["target_type"] == "user"
        assert entry["target_id"] == target_id

    @pytest.mark.asyncio
    async def test_status_change_writes_audit(self, client):
        admin_id, token = await _admin_token(client)
        # Seed a PLACED order directly into the repo — full order-creation
        # flow is exercised by `test_orders_*.py`; here we just need a
        # row to transition.
        _mem_order_repo._orders.append(
            Order(id="o-42", status=OrderStatus.PLACED, user_id=admin_id),
        )

        resp = await client.patch(
            "/api/admin/orders/o-42/status",
            json={"status": "confirmed"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text

        audit_resp = await client.get(
            "/api/admin/audit?target_type=order&target_id=o-42",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = audit_resp.json()
        assert body["total"] == 1
        entry = body["items"][0]
        assert entry["action"] == "order_status_change"
        assert entry["payload"]["from"] == "placed"
        assert entry["payload"]["to"] == "confirmed"

    @pytest.mark.asyncio
    async def test_settings_patch_writes_audit_with_diff(self, client):
        admin_id, token = await _admin_token(client)
        before = _mem_shop_settings_repo._settings.installation_price

        resp = await client.patch(
            "/api/admin/shop/settings",
            json={"installation_price": before + 1000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text

        audit_resp = await client.get(
            "/api/admin/audit?action=settings_update",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = audit_resp.json()
        assert body["total"] == 1
        entry = body["items"][0]
        assert entry["actor_id"] == admin_id
        assert entry["target_type"] == "settings"
        assert entry["payload"]["changes"]["installation_price"] == {
            "from": before, "to": before + 1000,
        }

    @pytest.mark.asyncio
    async def test_panel_delete_writes_audit(self, client):
        admin_id, token = await _admin_token(client)
        # Seed a panel directly so we don't depend on the create endpoint
        # exercising its own audit retrofits.
        _mem_panel_repo._panels.append(
            Panel(
                id="p-77",
                name="Brick",
                slug="brick",
                size=PanelSize(width_mm=300, height_mm=600, label="30×60"),
                base_price=1900,
            ),
        )

        resp = await client.delete(
            "/api/admin/panels/p-77",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 204, resp.text

        audit_resp = await client.get(
            "/api/admin/audit?action=panel_delete",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = audit_resp.json()
        assert body["total"] == 1
        entry = body["items"][0]
        assert entry["actor_id"] == admin_id
        assert entry["target_type"] == "panel"
        assert entry["target_id"] == "p-77"
        # Phase 10 — DELETE wires `CleanupRecommendationsOnDelete`, so
        # the payload also carries a `recommendations_cleanup` cascade
        # report (zero-effect here because no curation references this
        # panel). Assert subset on the original keys + presence of the
        # cascade report rather than full equality.
        assert entry["payload"]["name"] == "Brick"
        assert entry["payload"]["slug"] == "brick"
        assert entry["payload"]["recommendations_cleanup"] == {
            "source_dropped": False,
            "targets_pruned": 0,
        }

    @pytest.mark.asyncio
    async def test_x_forwarded_for_lands_in_audit_ip(self, client):
        """When the request arrives behind a proxy, the first hop in
        `X-Forwarded-For` becomes the audit entry IP. Pins the
        `get_request_ip` resolution path end-to-end."""
        admin_id, token = await _admin_token(client)
        target_id, _, _, _ = await _register(client, name="Victim")

        resp = await client.post(
            f"/api/admin/users/{target_id}/block",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Forwarded-For": "203.0.113.42, 10.0.0.1",
            },
        )
        assert resp.status_code == 200, resp.text

        audit_resp = await client.get(
            "/api/admin/audit?action=user_block",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = audit_resp.json()
        assert body["total"] == 1
        # Only the leftmost hop is trusted — see `get_request_ip` rationale.
        assert body["items"][0]["ip"] == "203.0.113.42"
