"""Domain exceptions for the Media bounded context (Phase 6).

Mapped to HTTP at `infrastructure/api/error_handlers.py`:

    MediaTooLargeError         → 413 (media_too_large)
    MediaInvalidMimeError      → 415 (media_invalid_mime)
    MediaInvalidDimensionsError → 422 (media_invalid_dimensions)
    MediaCorruptError          → 422 (media_corrupt)

Why a dedicated 413 / 415 split (instead of one generic 422):
  * 413 lets nginx / proxies reject the request *before* it reaches us,
    matching the `client_max_body_size` directive. The frontend can also
    detect the size mismatch immediately without reading the JSON body.
  * 415 ("Unsupported Media Type") is the standards-compliant response
    for a wrong MIME — a generic 422 would conflate "wrong content" with
    "wrong shape", which makes admin-side error messaging fuzzy.
  * 422 is reserved for "the file decoded fine but its dimensions are
    out of policy" — the request itself is well-formed.
"""


class MediaTooLargeError(Exception):
    """File exceeds the per-purpose `max_size_bytes` (or global cap)."""


class MediaInvalidMimeError(Exception):
    """File's MIME isn't in `MediaConstraints.allowed_mimes`.

    The MIME is determined by Pillow's format detection (or the magic-byte
    sniffer for non-image purposes), NOT by the client-supplied
    Content-Type header — clients lie. The header is checked first as a
    cheap pre-filter, but the authoritative answer comes from the bytes.
    """


class MediaInvalidDimensionsError(Exception):
    """Image dimensions outside the per-purpose `min_*` / `max_*` window.

    Distinct from `MediaCorruptError`: the file decoded successfully, the
    pixels are just the wrong size for this purpose. Frontend message:
    "Изображение должно быть не меньше 600×600 px".
    """


class MediaCorruptError(Exception):
    """Pillow couldn't decode the image (truncated / not actually an image).

    Separated from `MediaInvalidMimeError` because the symptom is "the
    bytes claim to be a JPEG but Pillow rejects them" — the admin's fix
    is "re-export the file", not "use a different format".
    """
