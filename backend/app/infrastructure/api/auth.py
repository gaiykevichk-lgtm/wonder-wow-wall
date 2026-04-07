from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.application.user.use_cases import Register, Login, GetProfile, UpdateProfile, ForgotPassword, ResetPassword
from app.container import get_user_repo
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, user_repo=Depends(get_user_repo)):
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
async def login(body: LoginRequest, user_repo=Depends(get_user_repo)):
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
async def me(user_id: str = Depends(get_current_user_id), user_repo=Depends(get_user_repo)):
    uc = GetProfile(user_repo)
    user = await uc.execute(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "phone": user.phone, "created_at": user.created_at.isoformat(),
    }


@router.patch("/me", response_model=UserResponse)
async def update_profile(body: UpdateProfileRequest, user_id: str = Depends(get_current_user_id), user_repo=Depends(get_user_repo)):
    uc = UpdateProfile(user_repo)
    user = await uc.execute(user_id, name=body.name, phone=body.phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "phone": user.phone, "created_at": user.created_at.isoformat(),
    }


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, user_repo=Depends(get_user_repo)):
    uc = ForgotPassword(user_repo)
    return await uc.execute(body.email)


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, user_repo=Depends(get_user_repo)):
    uc = ResetPassword(user_repo)
    try:
        return await uc.execute(body.email, body.token, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
