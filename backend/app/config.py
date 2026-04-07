from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "dev-secret-key-change-in-prod"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:3000"
    USE_MEMORY_REPOS: bool = False
    ENV: str = "development"

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
