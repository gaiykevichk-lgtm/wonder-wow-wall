"""Phase 12 — S3 storage for panel variant images.

Uses S3 presigned URLs for secure uploads directly from the browser.
"""

import boto3
from botocore.config import Config
from uuid import uuid4

from app.config import settings


# ─── S3 Client ────────────────────────────────────────────────────────

def _get_s3_client():
    """Get boto3 S3 client configured for Timeweb Cloud S3."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION or "ru-1",
        config=Config(signature_version="s3v4"),
    )


# ─── Presigned URL Generation ─────────────────────────────────────────

def generate_presigned_upload_url(
    object_key: str,
    content_type: str = "image/jpeg",
    expires_in: int = 3600,
) -> str:
    """Generate a presigned PUT URL for direct browser upload to S3.
    
    Args:
        object_key: S3 object key (e.g., 'variants/panel-123/texture-abc/photo-1.jpg')
        content_type: Expected content type of the uploaded file
        expires_in: URL validity in seconds (default 1 hour)
    
    Returns:
        Presigned URL for PUT operation
    """
    client = _get_s3_client()
    try:
        url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        raise RuntimeError(f"Failed to generate presigned URL: {e}")


def generate_presigned_download_url(
    object_key: str,
    expires_in: int = 3600,
) -> str:
    """Generate a presigned GET URL for downloading from S3.
    
    Args:
        object_key: S3 object key
        expires_in: URL validity in seconds
    
    Returns:
        Presigned URL for GET operation
    """
    client = _get_s3_client()
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.S3_BUCKET,
                "Key": object_key,
            },
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        raise RuntimeError(f"Failed to generate download URL: {e}")


# ─── Object Key Helpers ───────────────────────────────────────────────

def generate_variant_image_key(
    panel_id: str,
    texture_id: str,
    filename: str,
) -> str:
    """Generate S3 object key for a variant image.
    
    Format: variants/{panel_id}/{texture_id}/{uuid}-{filename}
    """
    import os
    ext = os.path.splitext(filename)[1] if filename else ".jpg"
    unique_id = str(uuid4())[:8]
    safe_filename = f"{unique_id}{ext}"
    return f"variants/{panel_id}/{texture_id}/{safe_filename}"


def generate_variant_design_image_key(
    panel_id: str,
    variant_id: str,
    filename: str,
) -> str:
    """Generate S3 object key for a variant's interior/design photo.
    
    Each variant gets its own sub-folder so interior photos are isolated
    per variant and never shared with other variants of the same texture.
    
    Format: variants/{panel_id}/variants/{variant_id}/design/{uuid}-{filename}
    """
    import os
    ext = os.path.splitext(filename)[1] if filename else ".jpg"
    unique_id = str(uuid4())[:8]
    safe_filename = f"{unique_id}{ext}"
    return f"variants/{panel_id}/variants/{variant_id}/design/{safe_filename}"


def generate_temp_upload_key(
    filename: str,
    admin_id: str,
) -> str:
    """Generate S3 object key for temporary upload.
    
    Format: temp/{admin_id}/{uuid}-{filename}
    """
    import os
    ext = os.path.splitext(filename)[1] if filename else ".jpg"
    unique_id = str(uuid4())[:8]
    safe_filename = f"{unique_id}{ext}"
    return f"temp/{admin_id}/{safe_filename}"


# ─── S3 URL Helpers ───────────────────────────────────────────────────

def get_public_url(object_key: str) -> str:
    """Get public URL for an S3 object (if bucket is public).
    
    For private buckets, use generate_presigned_download_url instead.
    """
    return f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/{object_key}"


# ─── Delete Object ────────────────────────────────────────────────────

def delete_object(object_key: str) -> bool:
    """Delete an object from S3.
    
    Args:
        object_key: S3 object key to delete
    
    Returns:
        True if deleted, False if not found or error
    """
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET, Key=object_key)
        return True
    except Exception:
        return False
