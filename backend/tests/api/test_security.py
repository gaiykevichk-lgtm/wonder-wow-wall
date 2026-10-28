"""Tests for Phase 9: backend security — rate limiting, headers, CORS, JWT guard."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestSecurityHeaders:
    @pytest.mark.asyncio
    async def test_health_has_security_headers(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert resp.headers["X-XSS-Protection"] == "1; mode=block"
        assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "camera=()" in resp.headers["Permissions-Policy"]


class TestCORS:
    @pytest.mark.asyncio
    async def test_cors_allowed_origin(self, client):
        resp = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    @pytest.mark.asyncio
    async def test_cors_disallowed_origin(self, client):
        resp = await client.options(
            "/api/health",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Should not have allow-origin for unknown origin
        assert resp.headers.get("access-control-allow-origin") != "http://evil.com"

    @pytest.mark.asyncio
    async def test_cors_allowed_methods_explicit(self, client):
        resp = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        allowed = resp.headers.get("access-control-allow-methods", "")
        assert "POST" in allowed

    @pytest.mark.asyncio
    async def test_cors_allowed_headers_explicit(self, client):
        resp = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )
        allowed = resp.headers.get("access-control-allow-headers", "")
        assert "authorization" in allowed.lower()


class TestRateLimiting:
    @pytest.mark.asyncio
    async def test_login_rate_limit(self, client):
        """After 5 login attempts, 6th should be rate-limited (429)."""
        for i in range(5):
            await client.post("/api/auth/login", json={
                "email": f"test{i}@example.com", "password": "wrong",
            })

        resp = await client.post("/api/auth/login", json={
            "email": "test99@example.com", "password": "wrong",
        })
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_register_rate_limit(self, client):
        """After 3 register attempts, 4th should be rate-limited (429)."""
        for i in range(3):
            await client.post("/api/auth/register", json={
                "name": "User", "email": f"rl-{i}@test.com",
                "phone": "+7000", "password": "pass123",
            })

        resp = await client.post("/api/auth/register", json={
            "name": "User", "email": "rl-extra@test.com",
            "phone": "+7000", "password": "pass123",
        })
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_contacts_rate_limit(self, client):
        """After 5 contact submissions, 6th should be rate-limited (429)."""
        for i in range(5):
            await client.post("/api/contacts", json={
                "name": "User", "email": f"c{i}@test.com", "message": "Hi",
            })

        resp = await client.post("/api/contacts", json={
            "name": "User", "email": "extra@test.com", "message": "Hi",
        })
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_forgot_password_rate_limit(self, client):
        """After 3 forgot-password attempts, 4th should be rate-limited (429)."""
        for i in range(3):
            await client.post("/api/auth/forgot-password", json={
                "email": f"fp-{i}@test.com",
            })

        resp = await client.post("/api/auth/forgot-password", json={
            "email": "fp-extra@test.com",
        })
        assert resp.status_code == 429


class TestResetPasswordRateLimit:
    @pytest.mark.asyncio
    async def test_reset_password_rate_limit(self, client):
        """After 5 reset-password attempts, 6th should be rate-limited (429)."""
        for i in range(5):
            await client.post("/api/auth/reset-password", json={
                "email": f"rp-{i}@test.com", "token": "000000", "new_password": "newpass",
            })

        resp = await client.post("/api/auth/reset-password", json={
            "email": "rp-extra@test.com", "token": "000000", "new_password": "newpass",
        })
        assert resp.status_code == 429


class TestJWTSecretGuard:
    def test_default_secret_allowed_in_development(self):
        """In development mode, default secret is OK (no crash at import)."""
        from app.config import settings
        assert settings.JWT_SECRET == "dev-secret-key-change-in-prod"
        assert settings.ENV == "development"
        # If we got here, the guard did not raise — correct for dev mode

    def test_default_secret_rejected_in_production(self, monkeypatch):
        """In production mode, default secret must raise RuntimeError."""
        import importlib
        import app.config as config_module

        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("JWT_SECRET", "dev-secret-key-change-in-prod")

        with pytest.raises(RuntimeError, match="JWT_SECRET must be changed"):
            importlib.reload(config_module)

        # Restore development config so other tests aren't affected
        monkeypatch.setenv("ENV", "development")
        importlib.reload(config_module)
