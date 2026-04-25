"""Phase 6 — `UploadMedia` use case (validation order + happy path).

Mocks `FileStorage` so we don't hit the filesystem; uses real Pillow to
generate test images so the validation pipeline is exercised end-to-end.
"""
import io

import pytest
from PIL import Image

from app.application.media.use_cases import DeleteMedia, UploadMedia
from app.domain.media.exceptions import (
    MediaCorruptError,
    MediaInvalidDimensionsError,
    MediaInvalidMimeError,
    MediaTooLargeError,
)
from app.domain.media.value_objects import MediaPurpose
from app.infrastructure.persistence.repositories.memory import (
    InMemoryMediaAssetRepository,
)


# ─── Fakes ───────────────────────────────────────────────────────────


class _FakeStorage:
    """In-memory `FileStorage` — records calls so we can assert that we
    DON'T write to storage on rejected uploads, which is the whole point
    of validating before saving (see UploadMedia module docstring).
    """

    def __init__(self):
        self.saved: list[tuple[str, MediaPurpose, str, bytes]] = []
        self.deleted: list[str] = []

    async def save(self, stream, *, purpose, extension):
        data = stream.read()
        path = f"{purpose.value}/fake-{len(self.saved)}.{extension}"
        self.saved.append((path, purpose, extension, data))
        return path

    async def delete(self, path):
        self.deleted.append(path)

    def url_for(self, path):
        return f"/uploads/{path}"


# ─── Helpers ─────────────────────────────────────────────────────────


def _png_bytes(width: int, height: int) -> bytes:
    """Synthesise a PNG of the requested pixel dimensions."""
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color="red").save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes(width: int, height: int, quality: int = 80) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color="blue").save(
        buf, format="JPEG", quality=quality,
    )
    return buf.getvalue()


# ─── Happy path ──────────────────────────────────────────────────────


class TestHappyPath:
    @pytest.mark.asyncio
    async def test_panel_photo_jpeg_creates_asset(self):
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        data = _jpeg_bytes(800, 800)

        asset = await UploadMedia(repo, storage).execute(
            actor_id="admin-1",
            stream=io.BytesIO(data),
            original_name="panel.jpg",
            declared_mime="image/jpeg",
            purpose=MediaPurpose.PANEL_PHOTO,
        )

        assert asset.id  # generated UUID
        assert asset.path.endswith(".jpg")
        assert asset.path.startswith("PANEL_PHOTO/")
        # MIME comes from Pillow (the truth), not from the declared header.
        assert asset.mime == "image/jpeg"
        assert asset.size_bytes == len(data)
        assert asset.original_name == "panel.jpg"
        assert asset.uploaded_by == "admin-1"
        assert asset.purpose == MediaPurpose.PANEL_PHOTO

        # Side effects landed in both stores.
        assert len(repo._assets) == 1
        assert len(storage.saved) == 1
        assert storage.saved[0][1] == MediaPurpose.PANEL_PHOTO

    @pytest.mark.asyncio
    async def test_design_preview_png(self):
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()

        asset = await UploadMedia(repo, storage).execute(
            actor_id="admin-1",
            stream=io.BytesIO(_png_bytes(500, 500)),
            original_name="thumb.png",
            declared_mime="image/png",
            purpose=MediaPurpose.DESIGN_PREVIEW,
        )

        assert asset.mime == "image/png"
        assert asset.path.endswith(".png")

    @pytest.mark.asyncio
    async def test_original_name_path_components_stripped(self):
        # Defense against admin uploading a file picker that includes a
        # subfolder name — we never display the folder, and storing it
        # muddles audit logs. See `_safe_original_name`.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()

        asset = await UploadMedia(repo, storage).execute(
            actor_id="admin-1",
            stream=io.BytesIO(_jpeg_bytes(800, 800)),
            original_name="vacation/photos/IMG_001.jpg",
            declared_mime="image/jpeg",
            purpose=MediaPurpose.PANEL_PHOTO,
        )

        assert asset.original_name == "IMG_001.jpg"


# ─── Size rejections ─────────────────────────────────────────────────


class TestTooLarge:
    @pytest.mark.asyncio
    async def test_per_purpose_cap_rejects_design_preview(self):
        # DESIGN_PREVIEW caps at 5MB; build a 6MB JPEG.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        # JPEG with a huge canvas + max quality to push past 5MB easily.
        big = _jpeg_bytes(2500, 2500, quality=100)
        # Pad if Pillow compressed too well — keep test deterministic.
        if len(big) <= 5 * 1024 * 1024:
            big = big + b"\x00" * (5 * 1024 * 1024 + 1 - len(big))

        with pytest.raises(MediaTooLargeError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(big),
                original_name="huge.jpg",
                declared_mime="image/jpeg",
                purpose=MediaPurpose.DESIGN_PREVIEW,
            )
        # Crucial invariant: the file was NOT written to storage.
        assert storage.saved == []
        assert repo._assets == []

    @pytest.mark.asyncio
    async def test_global_cap_takes_precedence_over_purpose(self):
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        # 21MB raw bytes — exceeds even the global 20MB cap regardless of
        # which purpose was selected.
        with pytest.raises(MediaTooLargeError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(b"\x00" * (21 * 1024 * 1024)),
                original_name="huge.bin",
                declared_mime="image/jpeg",
                purpose=MediaPurpose.MISC,
            )

    @pytest.mark.asyncio
    async def test_empty_file_rejected_as_corrupt(self):
        # Empty isn't "too large" or "wrong mime" — it's not an image.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        with pytest.raises(MediaCorruptError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(b""),
                original_name="empty.jpg",
                declared_mime="image/jpeg",
                purpose=MediaPurpose.MISC,
            )


# ─── MIME rejections ─────────────────────────────────────────────────


class TestInvalidMime:
    @pytest.mark.asyncio
    async def test_declared_mime_not_in_allowlist(self):
        # PDF declared up front — rejected at the cheap pre-filter
        # without even trying to decode.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        with pytest.raises(MediaInvalidMimeError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(b"%PDF-1.4\n%fake"),
                original_name="report.pdf",
                declared_mime="application/pdf",
                purpose=MediaPurpose.PANEL_PHOTO,
            )
        assert storage.saved == []

    @pytest.mark.asyncio
    async def test_declared_jpeg_actually_text_is_corrupt(self):
        # Header lies: declared image/jpeg but bytes are a text blob.
        # Pillow can't decode → MediaCorruptError (NOT InvalidMime —
        # the cheap pre-filter passed; the decoder rejected it).
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        with pytest.raises(MediaCorruptError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(b"hello world this is not an image"),
                original_name="fake.jpg",
                declared_mime="image/jpeg",
                purpose=MediaPurpose.PANEL_PHOTO,
            )


# ─── Dimension rejections ────────────────────────────────────────────


class TestInvalidDimensions:
    @pytest.mark.asyncio
    async def test_too_small_design_preview(self):
        # DESIGN_PREVIEW min is 400x400; 200x200 should fail.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        with pytest.raises(MediaInvalidDimensionsError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(_png_bytes(200, 200)),
                original_name="tiny.png",
                declared_mime="image/png",
                purpose=MediaPurpose.DESIGN_PREVIEW,
            )

    @pytest.mark.asyncio
    async def test_too_large_design_preview_dimensions(self):
        # DESIGN_PREVIEW max is 3000x3000; 3500x3500 should fail.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        with pytest.raises(MediaInvalidDimensionsError):
            await UploadMedia(repo, storage).execute(
                actor_id="admin-1",
                stream=io.BytesIO(_png_bytes(3500, 3500)),
                original_name="huge.png",
                declared_mime="image/png",
                purpose=MediaPurpose.DESIGN_PREVIEW,
            )

    @pytest.mark.asyncio
    async def test_misc_accepts_tiny_image(self):
        # MISC has no dimension floor — drift detector against a future
        # change that adds one and breaks small-icon uploads.
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        asset = await UploadMedia(repo, storage).execute(
            actor_id="admin-1",
            stream=io.BytesIO(_png_bytes(16, 16)),
            original_name="favicon.png",
            declared_mime="image/png",
            purpose=MediaPurpose.MISC,
        )
        assert asset.size_bytes > 0


# ─── Delete ──────────────────────────────────────────────────────────


class TestDelete:
    @pytest.mark.asyncio
    async def test_happy_delete_removes_row_and_file(self):
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        asset = await UploadMedia(repo, storage).execute(
            actor_id="admin-1",
            stream=io.BytesIO(_jpeg_bytes(800, 800)),
            original_name="x.jpg",
            declared_mime="image/jpeg",
            purpose=MediaPurpose.PANEL_PHOTO,
        )

        deleted = await DeleteMedia(repo, storage).execute(asset.id)
        assert deleted is True
        assert repo._assets == []
        # File deletion was invoked with the same path the upload returned.
        assert storage.deleted == [asset.path]

    @pytest.mark.asyncio
    async def test_delete_unknown_id_is_idempotent(self):
        repo = InMemoryMediaAssetRepository()
        storage = _FakeStorage()
        deleted = await DeleteMedia(repo, storage).execute("does-not-exist")
        assert deleted is False
        # No file deletion attempted — saves a syscall on bogus IDs.
        assert storage.deleted == []
