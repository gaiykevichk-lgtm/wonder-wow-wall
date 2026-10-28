"""Phase 12 — S3 storage backend implementing FileStorage interface.

Used when USE_S3=true. Reads settings from app.config.
"""
from __future__ import annotations

import io
import os
from typing import BinaryIO
from uuid import uuid4

import boto3
from botocore.config import Config

from app.config import settings
from app.domain.media.services import FileStorage
from app.domain.media.value_objects import MediaPurpose


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


class S3Storage(FileStorage):
    """S3-backed FileStorage for media uploads.

    Stores files at:
        {BUCKET}/{purpose}/{uuid}.{ext}

    The `{purpose}` prefix keeps different content types isolated and
    makes lifecycle policies (e.g. purge temp/ after 24h) easier.
    """

    def __init__(self, bucket: str, url_prefix: str):
        self._bucket = bucket
        self._url_prefix = url_prefix.rstrip("/")
        self._client = _get_s3_client()

    def _purpose_prefix(self, purpose: MediaPurpose) -> str:
        """Map MediaPurpose enum to a short S3 key prefix."""
        return purpose.value  # DESIGN_PREVIEW, PANEL_PHOTO, BANNER, MISC

    async def save(
        self, stream: BinaryIO, *, purpose: MediaPurpose, extension: str,
    ) -> str:
        """Write `stream` to S3 and return the storage-relative path."""
        # extension from the caller has no leading dot (e.g. "jpg", "png")
        ext = extension.lstrip(".")
        key = f"{self._purpose_prefix(purpose)}/{uuid4()}.{ext}"

        data = stream.read()
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=f"image/{extension.lstrip('.').lower()}",
        )
        return key

    async def delete(self, path: str) -> None:
        """Delete `path` from S3 (no-op if already absent)."""
        try:
            self._client.delete_object(Bucket=self._bucket, Key=path)
        except Exception:
            # Storage delete is best-effort; callers treat this as non-fatal.
            pass

    def url_for(self, path: str) -> str:
        """Return the public URL for `path`.

        The path is stored WITHOUT the leading `/uploads/` prefix (that's
        added by `imageSrc()` in the frontend).  When S3 has a public-read
        policy this returns the direct S3 URL.  When the bucket is private
        the caller must use presigned URLs; in that case this method returns
        the same path so `imageSrc()` rewrites it through the nginx proxy
        which will apply its own auth check.
        """
        return f"{self._url_prefix}/{path}"
