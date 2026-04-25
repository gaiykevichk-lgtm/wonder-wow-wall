"""Phase 6 — `MediaAsset` aggregate root.

A row in `media_assets` represents a file that has already been validated
and persisted to the configured `FileStorage` (see `services.py`). Storing
the path (not the URL) keeps the entity portable across storage backends:
local-fs today, S3-compatible later (see `FILE-STORAGE-ROADMAP.md`).

`uploaded_by` is a `users.id` FK so the admin panel can display "uploaded
by Alice" and so we can audit who uploaded what after the fact.

Why no behaviour on this aggregate yet:
  Files are immutable from the domain's point of view — the only mutation
  we'd want is `delete`, which is a coordinated action between repository
  AND storage, so it lives at the use-case layer (`DeleteMedia`). Adding
  a `MediaAsset.delete()` method would tempt callers to think the entity
  alone can erase a file, which is false.
"""
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from .value_objects import MediaPurpose


@dataclass
class MediaAsset:
    """Aggregate Root — Media Asset (admin upload).

    `path` is opaque storage-relative (e.g. `DESIGN_PREVIEW/abcd-ef...png`),
    NEVER an absolute filesystem path or a URL. Translation to a public
    URL is the storage adapter's job (`FileStorage.url_for(path)`); the
    domain stays unaware of "where" the bytes physically live.
    """

    id: str = field(default_factory=lambda: str(uuid4()))
    path: str = ""
    mime: str = ""
    size_bytes: int = 0
    original_name: str = ""
    uploaded_by: str = ""  # users.id, "SYSTEM" for seeded fixtures
    purpose: MediaPurpose = MediaPurpose.MISC
    uploaded_at: datetime = field(default_factory=datetime.utcnow)
