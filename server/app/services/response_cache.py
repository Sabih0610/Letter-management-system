from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import TypeVar

T = TypeVar("T")

_cache: dict[str, tuple[datetime, object]] = {}
_cache_lock = asyncio.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_fresh(expires_at: datetime) -> bool:
    return expires_at > _now()


async def get_cached_response(key: str) -> object | None:
    cached = _cache.get(key)
    if not cached:
        return None
    expires_at, value = cached
    if _is_fresh(expires_at):
        return value

    async with _cache_lock:
        cached = _cache.get(key)
        if cached and not _is_fresh(cached[0]):
            _cache.pop(key, None)
    return None


async def set_cached_response(key: str, value: object, ttl_seconds: int) -> None:
    async with _cache_lock:
        _cache[key] = (_now() + timedelta(seconds=ttl_seconds), value)


async def get_or_set_response(key: str, ttl_seconds: int, loader: Callable[[], Awaitable[T]]) -> T:
    cached = await get_cached_response(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    value = await loader()
    await set_cached_response(key, value, ttl_seconds)
    return value


async def invalidate_response_cache(prefixes: list[str]) -> None:
    async with _cache_lock:
        keys = [key for key in _cache.keys() if any(key.startswith(prefix) for prefix in prefixes)]
        for key in keys:
            _cache.pop(key, None)

