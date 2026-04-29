"""Development server with seeded admin user."""
import asyncio
import uvicorn
from app.infrastructure.security.jwt import hash_password
from app.domain.user.entities import User
from app.domain.user.value_objects import UserRole
from app.container import _mem_user_repo

async def seed():
    _mem_user_repo._users = [u for u in _mem_user_repo._users if u.email != 'admin@wow.ru']
    admin = User(
        id='admin-root',
        email='admin@wow.ru',
        password_hash=hash_password('admin123'),
        name='Admin',
        phone='+79001234567',
        role=UserRole.ADMIN
    )
    await _mem_user_repo.create(admin)
    print(f"Admin seeded: {admin.email} / admin123")

if __name__ == "__main__":
    asyncio.run(seed())
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001)