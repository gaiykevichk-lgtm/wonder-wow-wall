from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.infrastructure.api import auth, catalog, orders, subscriptions, projects, contacts

app = FastAPI(
    title="Wonder Wow Wall API",
    description="REST API для B2C магазина модульных стеновых панелей",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(catalog.router, prefix="/api", tags=["catalog"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(contacts.router, prefix="/api", tags=["contacts"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
