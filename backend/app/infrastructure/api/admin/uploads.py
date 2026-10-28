"""Phase 12 — S3 upload endpoints for panel variant wizard.

Provides presigned URLs for direct browser-to-S3 uploads.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.infrastructure.storage.s3 import (
    generate_presigned_upload_url,
    generate_variant_image_key,
    generate_variant_design_image_key,
    generate_temp_upload_key,
)
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Request/Response Models ─────────────────────────────────────────


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    panel_id: str | None = None
    texture_id: str | None = None
    # variant_id — если передан, фото попадает в папку конкретного
    # варианта (variants/{panel_id}/variants/{variant_id}/design/).
    # Используется только для интерьерных фото.
    variant_id: str | None = None


class PresignedUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    public_url: str | None = None


class TempUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"


# ─── Endpoints ────────────────────────────────────────────────────────


@router.post("/upload/presigned", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    body: PresignedUploadRequest,
    admin_id: str = Depends(get_current_admin_id),
):
    """Generate a presigned URL for direct S3 upload.
    
    The frontend should:
    1. Call this endpoint to get the presigned URL
    2. PUT the file directly to S3 using the presigned URL
    3. Use the returned object_key when creating the panel variant
    
    This avoids passing large files through the API server.
    """
    try:
        # Generate object key
        if body.variant_id and body.panel_id:
            # Интерьерное фото — папка конкретного варианта, не шарится
            object_key = generate_variant_design_image_key(
                panel_id=body.panel_id,
                variant_id=body.variant_id,
                filename=body.filename,
            )
        elif body.panel_id and body.texture_id:
            # Товарное фото — общая папка panel+texture
            object_key = generate_variant_image_key(
                panel_id=body.panel_id,
                texture_id=body.texture_id,
                filename=body.filename,
            )
        else:
            # Temp upload if no panel/texture specified yet
            object_key = generate_temp_upload_key(
                filename=body.filename,
                admin_id=admin_id,
            )
        
        # Generate presigned URL
        upload_url = generate_presigned_upload_url(
            object_key=object_key,
            content_type=body.content_type,
            expires_in=settings.S3_URL_EXPIRE_SECONDS,
        )
        
        # Return the URL and object key for later reference
        return PresignedUploadResponse(
            upload_url=upload_url,
            object_key=object_key,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate upload URL: {str(e)}",
        )


@router.post("/upload/temp", response_model=PresignedUploadResponse)
async def get_temp_upload_url(
    body: TempUploadRequest,
    admin_id: str = Depends(get_current_admin_id),
):
    """Generate a presigned URL for temporary upload.
    
    Temporary uploads are stored under `temp/{admin_id}/` and should be
    moved to the final location when the variant is created.
    """
    try:
        object_key = generate_temp_upload_key(
            filename=body.filename,
            admin_id=admin_id,
        )
        
        upload_url = generate_presigned_upload_url(
            object_key=object_key,
            content_type=body.content_type,
            expires_in=settings.S3_URL_EXPIRE_SECONDS,
        )
        
        return PresignedUploadResponse(
            upload_url=upload_url,
            object_key=object_key,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate upload URL: {str(e)}",
        )


# ─── S3 Configuration for Frontend ──────────────────────────────────

class S3ConfigResponse(BaseModel):
    endpoint: str
    bucket: str
    region: str
    upload_expire_seconds: int


@router.get("/upload/config", response_model=S3ConfigResponse)
async def get_upload_config(
    admin_id: str = Depends(get_current_admin_id),
):
    """Get S3 configuration for the frontend.
    
    Returns the S3 endpoint and bucket info so the frontend knows
    where to upload files.
    """
    return S3ConfigResponse(
        endpoint=settings.S3_ENDPOINT,
        bucket=settings.S3_BUCKET,
        region=settings.S3_REGION or "ru-1",
        upload_expire_seconds=settings.S3_URL_EXPIRE_SECONDS,
    )
