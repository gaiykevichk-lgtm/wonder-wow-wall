"""Phase 6 — admin media upload endpoints.

* `POST   /api/admin/media`              — `multipart/form-data` upload
* `DELETE /api/admin/media/{id}`         — drop row + file
* `GET    /api/admin/media/constraints`  — per-purpose validation envelope

Domain → HTTP mapping is registered globally in `app/main.py`:

    MediaTooLargeError          → 413  (media_too_large)
    MediaInvalidMimeError       → 415  (media_invalid_mime)
    MediaInvalidDimensionsError → 422  (media_invalid_dimensions)
    MediaCorruptError           → 422  (media_corrupt)

Why a separate `GET /constraints` endpoint:
  The admin file-upload component shows "max 10MB JPEG/PNG/WebP, min
  600x600 px" hints in the UI. Hard-coding those numbers in the frontend
  would let the two halves drift; serving them from the same dict that
  drives validation guarantees they stay in sync.

Why upload bodies are read into memory and not streamed to disk:
  We cap at 20 MB globally (see `GLOBAL_MAX_SIZE_BYTES`); buffering that
  is comfortable on every realistic deploy. nginx's `client_max_body_size
  10M` (the default) is bumped to 20M to match — see `nginx.conf`. If the
  cap ever rises beyond ~50 MB, switch `UploadMedia.execute` to a chunked
  read and re-evaluate the buffer story.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.application.media.use_cases import DeleteMedia, UploadMedia
from app.container import get_file_storage, get_media_repo
from app.domain.media.entities import MediaAsset
from app.domain.media.exceptions import MediaTooLargeError
from app.domain.media.services import FileStorage
from app.domain.media.value_objects import (
    GLOBAL_MAX_SIZE_BYTES,
    MediaPurpose,
    PURPOSE_CONSTRAINTS,
)
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Response shapes ─────────────────────────────────────────────────


class MediaAssetResponse(BaseModel):
    id: str
    path: str
    url: str
    mime: str
    size_bytes: int
    original_name: str
    uploaded_by: str
    purpose: str
    uploaded_at: str


class PurposeConstraintsResponse(BaseModel):
    """Mirrors `MediaConstraints` so the frontend doesn't need to parse
    the enum-keyed dict directly."""
    max_size_bytes: int
    allowed_mimes: list[str]
    min_width: int
    min_height: int
    max_width: int
    max_height: int


class ConstraintsResponse(BaseModel):
    global_max_size_bytes: int
    purposes: dict[str, PurposeConstraintsResponse] = Field(default_factory=dict)


def _to_response(asset: MediaAsset, storage: FileStorage) -> MediaAssetResponse:
    return MediaAssetResponse(
        id=asset.id,
        path=asset.path,
        url=storage.url_for(asset.path),
        mime=asset.mime,
        size_bytes=asset.size_bytes,
        original_name=asset.original_name,
        uploaded_by=asset.uploaded_by,
        purpose=asset.purpose.value,
        uploaded_at=asset.uploaded_at.isoformat(),
    )


# ─── Constraints (read) ──────────────────────────────────────────────


@router.get("/media/constraints", response_model=ConstraintsResponse)
async def get_constraints(
    _admin_id: str = Depends(get_current_admin_id),
):
    """Single source of truth for per-purpose validation rules.

    Frontend reads this on mount and renders the hint text + applies a
    client-side pre-filter (e.g. `<input accept="image/*">`). Validation
    still happens server-side — the client copy is purely a UX nicety.
    """
    return ConstraintsResponse(
        global_max_size_bytes=GLOBAL_MAX_SIZE_BYTES,
        purposes={
            purpose.value: PurposeConstraintsResponse(
                max_size_bytes=c.max_size_bytes,
                allowed_mimes=sorted(c.allowed_mimes),
                min_width=c.min_width,
                min_height=c.min_height,
                max_width=c.max_width,
                max_height=c.max_height,
            )
            for purpose, c in PURPOSE_CONSTRAINTS.items()
        },
    )


# ─── Upload ──────────────────────────────────────────────────────────


@router.post("/media", response_model=MediaAssetResponse, status_code=201)
async def upload_media(
    # `purpose` is a query param so the multipart body stays just the
    # file — keeps `curl -F file=@panel.jpg "URL?purpose=PANEL_PHOTO"`
    # working without an extra `-F purpose=...`. `MediaPurpose` enum
    # validates the value (typo → 422).
    purpose: MediaPurpose = Query(...),
    # `File(...)` is required; FastAPI returns 422 if the multipart part
    # is missing entirely.
    file: UploadFile = File(...),
    admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_media_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    # Pre-reject before the use case reads and validates the stream.
    # Starlette has already buffered the multipart body by this point,
    # so this saves the CPU of Pillow decode + per-purpose validation,
    # not the bandwidth of receiving the upload. Raising the domain
    # exception here lets the global `media_too_large_handler` build the
    # same {detail, code} envelope the post-read check produces, so the
    # frontend can branch on `code: media_too_large` uniformly.
    # `file.size` is populated by Starlette when Content-Length is set.
    if file.size is not None and file.size > GLOBAL_MAX_SIZE_BYTES:
        raise MediaTooLargeError(
            f"File size {file.size}B exceeds the global cap of "
            f"{GLOBAL_MAX_SIZE_BYTES}B"
        )

    use_case = UploadMedia(repo=repo, storage=storage)
    # `file.file` is the SpooledTemporaryFile Starlette gives us; the use
    # case reads it end-to-end via `stream.read()`.
    asset = await use_case.execute(
        actor_id=admin_id,
        stream=file.file,
        original_name=file.filename or "",
        # `file.content_type` is the client-declared MIME — the use case
        # treats it as a hint and re-derives the truth from Pillow.
        declared_mime=(file.content_type or "").lower(),
        purpose=purpose,
    )
    return _to_response(asset, storage)


# ─── Delete ──────────────────────────────────────────────────────────


@router.delete("/media/{asset_id}")
async def delete_media(
    asset_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_media_repo),
    storage: FileStorage = Depends(get_file_storage),
):
    """Removes the row AND the underlying file.

    Returns 204 on success, 404 if the asset doesn't exist (so callers
    can distinguish "I deleted it" from "it wasn't there"). The use case
    itself is idempotent at the file layer — repeated DELETEs after a
    successful one return 404 from the row check.

    The 404 envelope mirrors the global `{detail, code}` convention (see
    `error_handlers.py`) so the admin UI can branch on `code ==
    "media_not_found"` uniformly with the other media error codes.
    """
    deleted = await DeleteMedia(repo=repo, storage=storage).execute(asset_id)
    if not deleted:
        return JSONResponse(
            status_code=404,
            content={"detail": "Media asset not found", "code": "media_not_found"},
        )
    # 204 No Content — empty body (RFC 7230: 204 must not include a body).
    return Response(status_code=204)
