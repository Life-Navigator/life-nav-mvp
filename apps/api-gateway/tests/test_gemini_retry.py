"""Tests for the Gemini transient-retry policy (request_with_retry).

asyncio_mode=auto (see pytest.ini), so plain `async def test_*` runs.
"""
from __future__ import annotations

import pytest

from app.services.gemini import RETRY_STATUSES, request_with_retry


class _Resp:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


def _sequenced(statuses: list[int]):
    """Return (do_request, calls) where do_request yields the next status."""
    calls = {"n": 0}

    async def do_request() -> _Resp:
        s = statuses[min(calls["n"], len(statuses) - 1)]
        calls["n"] += 1
        return _Resp(s)

    return do_request, calls


async def _noop_sleep(_d: float) -> None:
    return None


# Deterministic + instant: zero backoff, zero jitter.
_FAST = {"backoff": (0.0, 0.0), "sleep": _noop_sleep, "rand": lambda: 0.0}


async def test_503_then_200_succeeds_after_retry():
    do, calls = _sequenced([503, 200])
    r = await request_with_retry(do, label="t", **_FAST)
    assert r.status_code == 200
    assert calls["n"] == 2  # initial + 1 retry


async def test_429_then_200_succeeds_after_retry():
    do, calls = _sequenced([429, 200])
    r = await request_with_retry(do, label="t", **_FAST)
    assert r.status_code == 200
    assert calls["n"] == 2


async def test_500_then_200_succeeds_after_retry():
    do, calls = _sequenced([500, 200])
    r = await request_with_retry(do, label="t", **_FAST)
    assert r.status_code == 200
    assert calls["n"] == 2


async def test_auth_error_is_not_retried():
    do, calls = _sequenced([401, 200])
    r = await request_with_retry(do, label="t", **_FAST)
    assert r.status_code == 401
    assert calls["n"] == 1  # no retry


async def test_validation_error_is_not_retried():
    do, calls = _sequenced([400, 200])
    r = await request_with_retry(do, label="t", **_FAST)
    assert r.status_code == 400
    assert calls["n"] == 1


async def test_max_retries_returns_last_response():
    do, calls = _sequenced([503, 503, 503, 503])
    r = await request_with_retry(do, label="t", max_retries=2, **_FAST)
    assert r.status_code == 503  # caller's raise_for_status() surfaces the error
    assert calls["n"] == 3  # initial + 2 retries (max)


def test_retry_status_set():
    assert RETRY_STATUSES == frozenset({429, 500, 503})
    for non_transient in (200, 400, 401, 403, 404):
        assert non_transient not in RETRY_STATUSES
