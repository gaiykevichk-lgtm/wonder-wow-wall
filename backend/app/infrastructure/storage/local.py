"""Phase 6 — local-filesystem `FileStorage`.

Writes under `<root>/<purpose>/<uuid4>.<ext>`. nginx serves the same
tree at `/uploads/<purpose>/<uuid4>.<ext>` (see `nginx.conf`), so
`url_for(path)` is just `/uploads/{path}`.

Why a UUID-based filename and not `original_name`:
  * Collision-free without a DB roundtrip — UUID4 is unique enough.
  * URL-safe without escaping — admins upload files with spaces, Cyrillic,
    and non-ASCII punctuation; serving those requires manual encoding
    everywhere we render the URL. A UUID dodges the whole problem.
  * Defends against path-traversal injections at the storage layer —
    even if `original_name` were `"../../etc/passwd"`, our path is
    `<purpose>/<uuid>.<ext>` regardless. The use case also sanitises
    `original_name` before persisting it as metadata, but the storage
    layer doesn't trust the caller either.

The directory is created lazily on first write — saves a startup
side-effect and lets tests use temp dirs without separate setup.

I/O is sync (`open`, `write`) because the `aiofiles` dep would be one
more wheel pull for a 5-line write. We accept the event-loop block since
files are capped at 20MB; on a NVMe that's a millisecond. Revisit when
profiling shows otherwise.
"""
from __future__ import annotations

import os
from typing import BinaryIO
from uuid import uuid4

from app.domain.media.services import FileStorage
from app.domain.media.value_objects import MediaPurpose


class LocalFileStorage(FileStorage):
    """Filesystem-backed adapter.

    Args:
      root: absolute filesystem directory under which `<purpose>/<uuid>.<ext>`
            is written. Must be writable by the backend process.
      url_prefix: URL path prefix the frontend uses to fetch files. nginx
            proxies this to the same `root` directory. Default `/uploads`
            matches the bundled nginx config and the docker-compose volume.
    """

    def __init__(self, root: str, url_prefix: str = "/uploads"):
        self._root = os.path.abspath(root)
        # Normalise: no trailing slash so `f"{prefix}/{path}"` doesn't
        # produce double-slash URLs (which most servers tolerate but
        # break some image CDN cache keys).
        self._url_prefix = url_prefix.rstrip("/")

    async def save(
        self, stream: BinaryIO, *, purpose: MediaPurpose, extension: str,
    ) -> str:
        # Path layout: `<purpose>/<uuid4>.<ext>`. Purpose first so a
        # human can `ls /var/uploads/PANEL_PHOTO/` and immediately see
        # what's there.
        rel_path = f"{purpose.value}/{uuid4()}.{extension.lower()}"
        abs_path = os.path.join(self._root, rel_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as f:
            # Read-and-write in one go — UploadMedia already buffered the
            # bytes; we don't try to re-stream chunks here. If file sizes
            # ever exceed memory comfort (~50MB), switch to a chunked
            # `shutil.copyfileobj(stream, f)` and revisit `UploadMedia`'s
            # whole-file `data = stream.read()`.
            f.write(stream.read())
        return rel_path

    async def delete(self, path: str) -> None:
        abs_path = os.path.join(self._root, path)
        # Idempotent — the use case retries; missing file is success.
        try:
            os.remove(abs_path)
        except FileNotFoundError:
            pass

    def url_for(self, path: str) -> str:
        # Always forward-slash separators in URLs even if `path` came
        # back with `os.sep == "\\"` on Windows. We don't currently
        # support Windows in production, but cheap to keep portable.
        normalised = path.replace(os.sep, "/")
        return f"{self._url_prefix}/{normalised}"
