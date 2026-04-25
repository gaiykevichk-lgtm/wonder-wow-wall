"""Phase 6 — `FileStorage` ABC.

Sits in `domain/media/` (not `infrastructure/`) because the use case
(`UploadMedia`) needs to depend on the abstraction, and Domain Rule
forbids `application/` from importing `infrastructure/`. Concrete
implementations live in `infrastructure/storage/`.

Single, narrow surface — `save` / `delete` / `url_for`. No `read` /
`stream` because the only consumer of bytes (nginx) reads them
out-of-band, not through this interface; adding methods we don't use
just to "look complete" is exactly the kind of speculative abstraction
the conventions warn against.
"""
from abc import ABC, abstractmethod
from typing import BinaryIO

from .value_objects import MediaPurpose


class FileStorage(ABC):
    """Storage backend for binary blobs.

    Lifecycle:
      * `save(stream, purpose, original_name)` reads the stream end-to-end
        and writes it under a deterministic, collision-free path; returns
        the storage-relative path (NOT a URL) for the entity to persist.
      * `delete(path)` removes the file. Idempotent (no error if missing) —
        the use case's transactional safety relies on "delete file then
        delete row" being safe to retry partway through.
      * `url_for(path)` returns the publicly-accessible URL the frontend
        renders. For local-fs that's `/uploads/<path>`; for S3 it's a
        signed URL or CDN endpoint.

    Invariants the implementation MUST uphold:
      * `path` returned by `save` MUST round-trip through `url_for` —
        i.e. fetching the URL must serve the same bytes that were saved.
      * `path` MUST be safe to interpolate into URLs without escaping
        (use UUIDs + lowercased extensions; do NOT echo `original_name`).
    """

    @abstractmethod
    async def save(
        self, stream: BinaryIO, *, purpose: MediaPurpose, extension: str,
    ) -> str:
        """Write `stream` to a fresh path and return that path.

        `extension` is the canonical file extension WITHOUT the dot
        (e.g. `"jpg"`, `"png"`). Implementations build the path as
        `<purpose>/<uuid4>.<extension>`. The caller is responsible for
        deciding the extension based on the validated MIME — the storage
        layer does NOT re-sniff the bytes.
        """
        ...

    @abstractmethod
    async def delete(self, path: str) -> None:
        """Remove `path` from storage. No-op if the path doesn't exist.

        Idempotent because the use case calls this OUTSIDE a DB
        transaction; a partial failure (file deleted, row commit fails)
        must be retryable.
        """
        ...

    @abstractmethod
    def url_for(self, path: str) -> str:
        """Public URL for the given storage-relative path.

        Sync because URL building is pure string concatenation —
        async-coloring would force every caller (incl. response mappers)
        to await a no-op.
        """
        ...
