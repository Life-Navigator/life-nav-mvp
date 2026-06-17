"""Gemini client — server-side reasoning ONLY.

The API key lives only in the Fly environment; this client is never importable
into any frontend/Vercel path (ARCHITECTURE_BOUNDARIES.md). Embeddings use
gemini-embedding-001 (3072-dim, MUST match the worker); generation uses
gemini-2.5-flash. Transient provider errors (429/500/503) are retried; auth and
safety blocks are not. Logs never include prompts, payloads, user data, or keys.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Awaitable, Callable, Optional

import httpx

from ..config import Settings

log = logging.getLogger("core.gemini")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
RETRY_STATUSES = frozenset({429, 500, 503})


async def _request_with_retry(
    do_request: Callable[[], Awaitable[httpx.Response]],
    *,
    label: str,
    max_retries: int = 2,
    backoff: tuple[float, ...] = (0.5, 1.5),
) -> httpx.Response:
    resp = await do_request()
    for attempt in range(max_retries):
        if resp.status_code < 400 or resp.status_code not in RETRY_STATUSES:
            return resp
        base = backoff[attempt] if attempt < len(backoff) else backoff[-1]
        delay = base + random.random() * (base / 2)
        log.warning("gemini %s transient %s; retry %d/%d", label, resp.status_code, attempt + 1, max_retries)
        await asyncio.sleep(delay)
        resp = await do_request()
    return resp


class GeminiClient:
    def __init__(self, api_key: str, embedding_model: str, generation_model: str, timeout: float = 30.0) -> None:
        self._api_key = api_key
        self._embedding_model = embedding_model
        self._generation_model = generation_model
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings) -> "GeminiClient":
        return cls(
            api_key=settings.gemini_api_key,
            embedding_model=settings.gemini_embedding_model,
            generation_model=settings.gemini_generation_model,
            # generation is slower than the 8s downstream default
            timeout=max(settings.http_timeout_seconds, 30.0),
        )

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def ready(self) -> bool:
        # Config presence only — we never spend a token on health checks.
        return self.configured

    async def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("refused to embed empty text")
        url = f"{GEMINI_BASE}/{self._embedding_model}:embedContent?key={self._api_key}"
        payload = {"content": {"parts": [{"text": text}]}}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await _request_with_retry(lambda: client.post(url, json=payload), label="embed")
            r.raise_for_status()
            return r.json()["embedding"]["values"]

    async def generate(self, system_prompt: str, user_prompt: str, temperature: Optional[float] = None) -> str:
        text, _ = await self.generate_with_usage(system_prompt, user_prompt, temperature)
        return text

    async def generate_with_usage(
        self, system_prompt: str, user_prompt: str, temperature: Optional[float] = None
    ) -> tuple[str, dict[str, int]]:
        """Like generate() but also returns token usage {prompt_tokens, completion_tokens, total_tokens}
        from Gemini's usageMetadata — for advisor telemetry / cost metering."""
        url = f"{GEMINI_BASE}/{self._generation_model}:generateContent?key={self._api_key}"
        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        }
        if temperature is not None:
            payload["generationConfig"] = {"temperature": float(temperature)}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await _request_with_retry(lambda: client.post(url, json=payload), label="generate")
            r.raise_for_status()
            data = r.json()
        u = data.get("usageMetadata") or {}
        usage = {
            "prompt_tokens": int(u.get("promptTokenCount") or 0),
            "completion_tokens": int(u.get("candidatesTokenCount") or 0),
            "total_tokens": int(u.get("totalTokenCount") or 0),
        }
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"], usage
        except (KeyError, IndexError, TypeError):
            return "", usage
