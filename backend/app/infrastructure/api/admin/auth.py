"""Phase 1 — admin profile endpoint. The sole purpose is to validate the
full guard chain (JWT decode → role claim check → DB fetch) end-to-end
before any business-facing admin pages are built.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.application.user.use_cases import GetProfile
from app.container import get_user_repo
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


class AdminMeResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    created_at: str


@router.get("/me", response_model=AdminMeResponse)
async def admin_me(
    admin_id: str = Depends(get_current_admin_id),
    user_repo=Depends(get_user_repo),
):
    uc = GetProfile(user_repo)
    user = await uc.execute(admin_id)
    if user is None:
        # Guard passed (valid admin token) but DB has no such user — stale
        # token after account deletion. 401 forces a fresh sign-in.
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "created_at": user.created_at.isoformat(),
    }
