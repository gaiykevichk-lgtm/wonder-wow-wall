from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "dev-secret-key-change-in-prod"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:3000"
    USE_MEMORY_REPOS: bool = False
    ENV: str = "development"

    # ─── Phase 6 — depth-estimation settings ─────────────────────────
    # `stub` is the safe default — the real adapter requires onnxruntime +
    # numpy + pillow + a checkpoint on disk. Production sets `local`.
    # See docs/design-docs/DEPTH-ESTIMATION-INFRA.md.
    DEPTH_PROVIDER: str = "stub"
    DEPTH_MODEL_PATH: str = ""
    DEPTH_INPUT_SIZE: int = 256

    # ─── Phase 6 (admin panel) — media file storage ──────────────────
    # `MEDIA_STORAGE_ROOT` is the absolute filesystem directory the
    # `LocalFileStorage` adapter writes into. nginx mounts the same
    # directory (see `docker-compose.yml:backend.volumes`) and serves it
    # at `/uploads/`. In the test rig this is overridden per-test to a
    # `tempfile.TemporaryDirectory` so the suite never touches disk
    # state outside its sandbox.
    MEDIA_STORAGE_ROOT: str = "/var/uploads"
    # URL prefix the frontend uses to fetch uploaded files. Must match
    # the nginx `location` alias. Kept configurable for environments
    # that mount uploads under a CDN subdomain.
    MEDIA_URL_PREFIX: str = "/uploads"

    # Derived
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Guard: reject insecure JWT_SECRET in production
if settings.is_production and settings.JWT_SECRET == "dev-secret-key-change-in-prod":
    raise RuntimeError(
        "FATAL: JWT_SECRET must be changed from default value in production. "
        "Set a secure random secret via the JWT_SECRET environment variable."
    )
