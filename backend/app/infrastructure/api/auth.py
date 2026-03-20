from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.application.user.use_cases import Register, Login, GetProfile, UpdateProfile
from app.container import user_repo
from app.utils.dependencies import get_current_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    created_at: str


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    phone: str | None = None


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest):
    uc = Register(user_repo)
    try:
        result = await uc.execute(body.name, body.email, body.phone, body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user = result["user"]
    return {
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "phone": user.phone, "created_at": user.created_at.isoformat(),
        },
        "token": result["token"],
    }


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    uc = Login(user_repo)
    try:
        result = await uc.execute(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    user = result["user"]
    return {
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "phone": user.phone, "created_at": user.created_at.isoformat(),
        },
        "token": result["token"],
    }


@router.get("/me", response_model=UserResponse)
async def me(user_id: str = Depends(get_current_user_id)):
    uc = GetProfile(user_repo)
    user = await uc.execute(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "phone": user.phone, "created_at": user.created_at.isoformat(),
    }


@router.patch("/me", response_model=UserResponse)
async def update_profile(body: UpdateProfileRequest, user_id: str = Depends(get_current_user_id)):
    uc = UpdateProfile(user_repo)
    user = await uc.execute(user_id, name=body.name, phone=body.phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "phone": user.phone, "created_at": user.created_at.isoformat(),
    }
