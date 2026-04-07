"""Root conftest — ensures tests always run against in-memory repos."""

import os

# Force in-memory repos regardless of .env contents.
# Must be set BEFORE any app module is imported.
os.environ["USE_MEMORY_REPOS"] = "true"

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset rate limiter state before each test to avoid cross-test pollution."""
    from app.infrastructure.security.rate_limit import limiter
    limiter.reset()
    yield
