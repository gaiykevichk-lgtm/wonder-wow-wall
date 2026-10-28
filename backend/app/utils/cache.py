"""Tiny in-process TTL cache for read-only, side-effect-free async calls.

Used by Phase-3 dashboard snapshot. Intentionally NOT a general-purpose
cache:
  * one shared dict, process-local (no Redis);
  * keys built from all positional + keyword args using `repr()` —
    caller must pass only hashable/repr-stable arguments;
  * entries expire lazily on read (no background janitor thread);
  * two workers serving the same key may both miss and populate; the
    second write wins. Acceptable because the function is pure and
    the race is rare.

Why not `functools.lru_cache`? It doesn't honor TTL and doesn't support
async callables cleanly.
"""

from __future__ import annotations

import asyncio
import time
from functools import wraps
from typing import Any, Awaitable, Callable, TypeVar

_T = TypeVar("_T")

# Module-global store so decorated callables across different repo
# instances share the cache (repo instances are per-request in FastAPI).
_STORE: dict[str, tuple[float, Any]] = {}
_LOCK = asyncio.Lock()


def _make_key(fn_name: str, args: tuple, kwargs: dict) -> str:
    # `self` (args[0]) is deliberately skipped when the wrapped callable
    # is a bound method — different repo instances produced by FastAPI DI
    # would otherwise never share a cache entry. `self` is identified by
    # convention (first arg, not hashable-sensitive). Callers that want
    # per-instance caching can flip `skip_self=False` when decorating.
    parts = [fn_name]
    for a in args:
        parts.append(repr(a))
    for k in sorted(kwargs):
        parts.append(f"{k}={kwargs[k]!r}")
    return "|".join(parts)


def cached(ttl_seconds: float, *, skip_self: bool = True) -> Callable:
    """Decorator: cache async-function results for `ttl_seconds`.

    Example:
        @cached(60.0)
        async def expensive(self, rng: DateRange): ...
    """

    if ttl_seconds <= 0:
        raise ValueError(f"ttl_seconds must be positive, got {ttl_seconds}")

    def decorator(fn: Callable[..., Awaitable[_T]]) -> Callable[..., Awaitable[_T]]:
        qual = fn.__qualname__

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> _T:
            key_args = args[1:] if skip_self and args else args
            key = _make_key(qual, tuple(key_args), kwargs)

            now = time.monotonic()
            entry = _STORE.get(key)
            if entry is not None:
                expires_at, value = entry
                if expires_at > now:
                    return value  # type: ignore[return-value]

            # Miss / expired — compute outside the lock, then publish.
            value = await fn(*args, **kwargs)
            async with _LOCK:
                _STORE[key] = (time.monotonic() + ttl_seconds, value)
            return value

        # Expose for tests to drop entries between cases.
        wrapper._cache_key = lambda *a, **kw: _make_key(  # type: ignore[attr-defined]
            qual, tuple(a[1:]) if skip_self and a else tuple(a), kw,
        )
        return wrapper

    return decorator


def clear_cache() -> None:
    """Drop every cached entry. Intended for tests."""
    _STORE.clear()
