from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.infrastructure.api import auth, catalog, orders, subscriptions, projects, contacts
from app.infrastructure.security.middleware import SecurityHeadersMiddleware
from app.infrastructure.security.rate_limit import limiter

app = FastAPI(
    title="Wonder Wow Wall API",
    description="REST API для B2C магазина модульных стеновых панелей",
    version="0.1.0",
)

# ─── Rate Limiting ──────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Security Headers ──────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ─── CORS ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# ─── Routers ────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(catalog.router, prefix="/api", tags=["catalog"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(contacts.router, prefix="/api", tags=["contacts"])


@app.get("/api/health")
async def health(request: Request):
    return {"status": "ok"}
