"""Gemini client (embeddings + generation).

Async wrapper over Gemini's REST endpoint with a small retry on transient
provider errors (429 rate limit, 503 overload, 500 internal). Auth (401/403),
validation (400), and safety blocks are not retried. Safety blocks arrive as
HTTP 200 with a blockReason, so they never reach the retry path.
"""
from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from typing import Awaitable, Callable

import httpx

logger = logging.getLogger(__name__)

# Transient statuses worth retrying.
RETRY_STATUSES = frozenset({429, 500, 503})


async def request_with_retry(
    do_request: Callable[[], Awaitable[httpx.Response]],
    *,
    label: str = "gemini",
    max_retries: int = 2,
    backoff: tuple[float, ...] = (0.5, 1.5),
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    rand: Callable[[], float] = random.random,
) -> httpx.Response:
    """Call ``do_request`` and retry only on transient Gemini statuses with
    exponential backoff + jitter (default 2 retries: ~0.5s, then ~1.5s).

    Returns the final response either way — the caller still calls
    ``raise_for_status()``. Logs only ``label + status + attempt`` — never
    prompts, payloads, user data, or secrets.
    """
    resp = await do_request()
    for attempt in range(max_retries):
        if resp.status_code < 400 or resp.status_code not in RETRY_STATUSES:
            return resp
        base = backoff[attempt] if attempt < len(backoff) else backoff[-1]
        delay = base + rand() * (base / 2)  # +0..50% jitter
        logger.warning(
            "gemini %s: transient %s; retry %d/%d in %dms",
            label, resp.status_code, attempt + 1, max_retries, int(delay * 1000),
        )
        await sleep(delay)
        resp = await do_request()
    return resp


@dataclass
class GeminiClient:
    api_key: str
    embedding_model: str = "gemini-embedding-001"
    generation_model: str = "gemini-2.5-flash"
    timeout_seconds: float = 30.0
    max_retries: int = 2
    backoff: tuple[float, ...] = (0.5, 1.5)

    async def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("refused to embed empty text")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/{self.embedding_model}:embedContent?key={self.api_key}"
        )
        payload = {"content": {"parts": [{"text": text}]}}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await request_with_retry(
                lambda: client.post(url, json=payload),
                label="embed", max_retries=self.max_retries, backoff=self.backoff,
            )
            r.raise_for_status()
            return r.json()["embedding"]["values"]

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/{self.generation_model}:generateContent?key={self.api_key}"
        )
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await request_with_retry(
                lambda: client.post(url, json=payload),
                label="generate", max_retries=self.max_retries, backoff=self.backoff,
            )
            r.raise_for_status()
            data = r.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError):
                return ""
