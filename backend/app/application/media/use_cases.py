"""Phase 6 — media upload / delete use cases.

Validation order matters. Cheapest, most-likely-to-fire checks first so we
spend zero CPU on bad uploads:

  1. Header content-length / declared MIME pre-filter (caller-side, in the
     API layer — see `infrastructure/api/admin/media.py`). Fast 4xx
     without even reading the body.
  2. Per-purpose `max_size_bytes` (here, after stream-to-bytes).
  3. MIME re-derived from Pillow's format detection (truth, not header).
  4. Pillow open + `verify()` for "is this even an image?" (corrupt
     bytes raise `MediaCorruptError`).
  5. Dimension window per purpose.

Only after all five pass do we call `FileStorage.save(...)` — we never
write a byte to disk for a rejected upload.

Why no DB-side transaction wraps the storage call:
  Storage is filesystem (or S3); neither participates in our SQLAlchemy
  Unit-of-Work. The sequence is "save file → create DB row"; if the row
  insert fails, we orphan the file. We accept that small risk because
  (a) the row insert is a single-statement INSERT with no business
  invariants beyond uniqueness, and (b) a future janitor can sweep the
  storage for orphan paths against `SELECT path FROM media_assets`.
  Reversing the order would be worse — DB row pointing at a file that
  doesn't exist breaks the public URL contract.

`DeleteMedia` deletes the row first, then the file:
  If the file deletion fails, we have a row pointing at a missing file
  (404 on the URL) — recoverable with another `DELETE`. The opposite
  order would risk dangling file references in `Design.image` etc.
"""
from __future__ import annotations

import io
import os
from typing import BinaryIO

from app.domain.media.entities import MediaAsset
from app.domain.media.exceptions import (
    MediaCorruptError,
    MediaInvalidDimensionsError,
    MediaInvalidMimeError,
    MediaTooLargeError,
)
from app.domain.media.repositories import MediaAssetRepository
from app.domain.media.services import FileStorage
from app.domain.media.value_objects import (
    GLOBAL_MAX_SIZE_BYTES,
    MediaPurpose,
    constraints_for,
)


# Pillow format → canonical (mime, extension). The format string Pillow
# returns is uppercase ("JPEG", "PNG", "WEBP"); we map it once here so
# the rest of the use case deals in lowercase MIMEs and extensions.
_PILLOW_FORMAT_MAP: dict[str, tuple[str, str]] = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


class UploadMedia:
    """Validate + persist an uploaded file.

    Stateless w.r.t. the repository — `repo` and `storage` are injected
    once, but a single `UploadMedia` instance is safe to reuse across
    requests (no per-call mutable state).
    """

    def __init__(self, repo: MediaAssetRepository, storage: FileStorage):
        self.repo = repo
        self.storage = storage

    async def execute(
        self,
        *,
        actor_id: str,
        stream: BinaryIO,
        original_name: str,
        declared_mime: str,
        purpose: MediaPurpose,
    ) -> MediaAsset:
        # 1) Read the stream end-to-end. We don't trust the Content-Length
        # header for the size check — the API layer uses it for the cheap
        # pre-reject (saves bandwidth on huge uploads), but here we measure
        # bytes actually read so a header that lies can't slip past.
        data = stream.read()
        size = len(data)
        if size == 0:
            # Empty file — short-circuit to MediaCorruptError. Pillow on
            # zero bytes raises UnidentifiedImageError which would map to
            # the same domain exception two steps later, but rejecting
            # here means we don't bother importing Pillow for a request
            # that's obviously broken.
            raise MediaCorruptError("Uploaded file is empty")
        if size > GLOBAL_MAX_SIZE_BYTES:
            raise MediaTooLargeError(
                f"File size {size}B exceeds the global cap of "
                f"{GLOBAL_MAX_SIZE_BYTES}B"
            )

        constraints = constraints_for(purpose)
        if size > constraints.max_size_bytes:
            raise MediaTooLargeError(
                f"File size {size}B exceeds the {purpose.value} cap of "
                f"{constraints.max_size_bytes}B"
            )

        # 2) Cheap declared-MIME pre-filter. Even if the bytes pass Pillow,
        # an admin who picked "purpose=PANEL_PHOTO" but uploaded a .pdf
        # should get an immediate 415 — Pillow on a PDF would raise
        # UnidentifiedImageError, mapping to `MediaCorruptError`, which is
        # technically true but less helpful than "wrong MIME".
        if declared_mime not in constraints.allowed_mimes:
            raise MediaInvalidMimeError(
                f"MIME {declared_mime!r} is not allowed for {purpose.value}; "
                f"expected one of {sorted(constraints.allowed_mimes)}"
            )

        # 3) Authoritative MIME from Pillow. Header lied? `actual_mime`
        # may differ from `declared_mime` — we trust the bytes.
        # Import here so the domain doesn't pull Pillow at module load
        # time (the domain layer must stay infra-free; this use case is
        # already application-layer, but the cost is the same).
        from PIL import Image, UnidentifiedImageError

        try:
            with Image.open(io.BytesIO(data)) as img:
                # `verify()` reads the file header end-to-end without
                # decoding pixel data — fast integrity check.
                img.verify()
            # `verify()` leaves the image in an undefined state (per
            # Pillow docs) — re-open for dimension reads.
            img2 = Image.open(io.BytesIO(data))
            pillow_format = (img2.format or "").upper()
            width, height = img2.size
        except (UnidentifiedImageError, OSError) as exc:
            raise MediaCorruptError(
                f"File is not a valid image: {exc}"
            ) from exc

        if pillow_format not in _PILLOW_FORMAT_MAP:
            raise MediaInvalidMimeError(
                f"Pillow detected unsupported format {pillow_format!r}"
            )
        actual_mime, extension = _PILLOW_FORMAT_MAP[pillow_format]
        if actual_mime not in constraints.allowed_mimes:
            raise MediaInvalidMimeError(
                f"Detected MIME {actual_mime!r} is not allowed for "
                f"{purpose.value}"
            )

        # 4) Dimension policy.
        if (
            width < constraints.min_width or height < constraints.min_height
            or width > constraints.max_width or height > constraints.max_height
        ):
            raise MediaInvalidDimensionsError(
                f"Image dimensions {width}x{height} px are outside the "
                f"allowed window for {purpose.value}: "
                f"{constraints.min_width}-{constraints.max_width} x "
                f"{constraints.min_height}-{constraints.max_height} px"
            )

        # 5) All checks passed — write to storage, then persist the row.
        # Order matters; see module docstring.
        path = await self.storage.save(
            io.BytesIO(data), purpose=purpose, extension=extension,
        )
        asset = MediaAsset(
            path=path,
            mime=actual_mime,
            size_bytes=size,
            original_name=_safe_original_name(original_name),
            uploaded_by=actor_id,
            purpose=purpose,
        )
        return await self.repo.create(asset)


class DeleteMedia:
    """Remove a media asset (DB row + file).

    Returns True on success, False if no such asset existed (idempotent —
    a second DELETE for the same id is not an error).
    """

    def __init__(self, repo: MediaAssetRepository, storage: FileStorage):
        self.repo = repo
        self.storage = storage

    async def execute(self, asset_id: str) -> bool:
        asset = await self.repo.get_by_id(asset_id)
        if asset is None:
            return False
        deleted = await self.repo.delete(asset_id)
        if deleted:
            # Storage delete is idempotent — safe to call even if the
            # path is already gone (e.g. a previous half-completed delete).
            await self.storage.delete(asset.path)
        return deleted


def _safe_original_name(name: str) -> str:
    """Strip path components from `original_name` before storing.

    The frontend may send `"vacation/IMG_001.jpg"`; we don't display the
    folder part (it's not even ours), and storing it muddies later log
    grepping. Truncate to a sane length to keep the column small.
    """
    base = os.path.basename(name or "")
    return base[:255]
