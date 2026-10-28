"""Admin-only persistent configurator instruction."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from app.utils.dependencies import get_current_admin_id
from app.application.configurator.prompt_settings import read_prompt_settings, save_prompt_settings

router = APIRouter()


class PromptSettingsUpdate(BaseModel):
    system_prompt: str = Field(min_length=1, max_length=20000)

    @field_validator("system_prompt")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Промпт не может быть пустым")
        return value.strip()


class PromptSettingsResponse(BaseModel):
    system_prompt: str
    updated_at: str


@router.get("/configurator/settings", response_model=PromptSettingsResponse)
async def read_settings(_admin_id: str = Depends(get_current_admin_id)):
    return await read_prompt_settings()


@router.patch("/configurator/settings", response_model=PromptSettingsResponse)
async def update_settings(body: PromptSettingsUpdate, _admin_id: str = Depends(get_current_admin_id)):
    return await save_prompt_settings(body.system_prompt)
