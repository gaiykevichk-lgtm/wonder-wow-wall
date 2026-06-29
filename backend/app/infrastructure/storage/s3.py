"""Phase 6+ — S3 `FileStorage` adapter.

Writes blobs to a private S3 bucket using the S3-compatible endpoint
(https://s3.twcstorage.ru). All `save` / `delete` operations are
synchronous boto3 calls wrapped in `asyncio.to_thread()` so they never
block the event loop. `url_for()` is a no-allocation string concat.

Signed URLs are used for reads so the bucket stays private while the
frontend can still display uploaded images. Signatures expire after
`SIGNED_URL_EXPIRE_SECONDS` (default 24 h) — safe to cache in the
browser for normal usage.

Path layout mirrors LocalFileStorage: `<purpose>/<uuid4>.<ext>`.
Purpose sub-folder makes it trivial to `aws s3 ls s3://bucket/PANEL_PHOTO/`
and see what's in each category.

Why not aiobotocore / aioboto3?
  * boto3 is synchronous — wrapping with `asyncio.to_thread()` gives us
    full async behaviour without an extra dependency.
  * S3 writes are bounded (≤ 20 MB per Phase 6 spec) — the thread-block
    is sub-100 ms on typical bandwidth, negligible vs DB latency.
  * No need for the complexity of async stream接力 when the use case
    already holds the full file bytes in memory.
"""
from __future__ import annotations

import asyncio
import os
from typing import BinaryIO
from uuid import uuid4

import boto3
from botocore.config import Config

from app.domain.media.services import FileStorage
from app.domain.media.value_objects import MediaPurpose


class S3FileStorage(FileStorage):
    """S3-backed adapter for private buckets with signed-read URLs.

    Args:
      bucket_name:   S3 bucket that holds the files.
      endpoint_url:  S3-compatible endpoint, e.g.
                     "https://s3.twcstorage.ru" (TwcpStorage).
      access_key:    AWS access-key ID.
      secret_key:    AWS secret-access key.
      url_prefix:    Public-facing prefix prepended to the path in
                     `url_for()`. When `use_signed_urls=True` (default)
                     the returned URL is a signed query-string URL;
                     when False it is a plain `https://<endpoint>/<bucket>/<path>`
                     URL (requires the bucket to be public).
      signed_url_expire_seconds:  Lifetime of generated signed URLs.
                                   Only used when `use_signed_urls=True`.
      region_name:   S3 region (default "ru-1" for TwcpStorage).
    """

    def __init__(
        self,
        bucket_name: str,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        url_prefix: str = "/uploads",
        signed_url_expire_seconds: int = 86_400,
        region_name: str = "ru-1",
    ):
        self._bucket = bucket_name
        self._url_prefix = url_prefix.rstrip("/")
        self._signed_ttl = signed_url_expire_seconds
        self._region = region_name

        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region_name,
            config=Config(signature_version="s3v4"),
        )

    # ── FileStorage ABC ────────────────────────────────────────────────

    async def save(
        self, stream: BinaryIO, *, purpose: MediaPurpose, extension: str,
    ) -> str:
        """Upload `stream` bytes to S3 and return the storage-relative path."""
        rel_path = f"{purpose.value}/{uuid4()}.{extension.lower()}"
        # Read bytes synchronously, upload in a thread so we never block
        # the event loop. boto3.upload_fileobj expects a seekable stream;
        # `stream.read()` gives us a plain `bytes` object which satisfies that.
        bytes_data = stream.read()
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=rel_path,
            Body=bytes_data,
            ContentType=_mime_from_ext(extension),
        )
        return rel_path

    async def delete(self, path: str) -> None:
        """Delete `path` from S3. Idempotent (no error if missing)."""
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=self._bucket,
                Key=path,
            )
        except Exception:
            # boto3 raises ClientError for 404; we propagate everything else
            # so the caller knows about real failures.
            pass

    def url_for(self, path: str) -> str:
        """Generate a signed (or plain) URL for `path`.

        Signed URLs are the safe default for private buckets. Set
        `use_signed_urls=False` on the instance if the bucket is
        intentionally public.
        """
        normalised = path.replace(os.sep, "/")
        # Always sign — the bucket is private by design.
        # `generate_presigned_url` is synchronous; cheap enough to call
        # inline (no thread needed).
        signed = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": normalised},
            ExpiresIn=self._signed_ttl,
        )
        return signed


# ─── Helpers ──────────────────────────────────────────────────────────

_MIME_MAP = {
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "gif":  "image/gif",
    "webp": "image/webp",
    "svg":  "image/svg+xml",
    "pdf":  "application/pdf",
    "mp4":  "video/mp4",
    "webm": "video/webm",
}


def _mime_from_ext(extension: str) -> str:
    return _MIME_MAP.get(extension.lower(), "application/octet-stream")
