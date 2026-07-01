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
    provider = "google_aistudio"  # API-key auth (AI Studio). See VertexGeminiClient for the ADC path.

    def __init__(self, api_key: str, embedding_model: str, generation_model: str, timeout: float = 30.0) -> None:
        self._api_key = api_key
        self._embedding_model = embedding_model
        self._generation_model = generation_model
        self._timeout = timeout

    @property
    def model_name(self) -> str:
        return self._generation_model

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


VERTEX_GEMINI_HOST_GLOBAL = "aiplatform.googleapis.com"


class VertexGeminiClient:
    """Gemini via Vertex AI authenticated with ADC — NO API key (org policy disallows keys).

    Exposes the SAME generate()/generate_with_usage()/configured/ready contract as GeminiClient, so the
    advisor's GeminiAdvisorLLM wrapper uses it unchanged. Embeddings are intentionally NOT provided here
    (the live advisor path needs generation only; the embedding worker keeps its own path). Auth failure is
    LOUD: `.token()` raises VertexAuthError, which propagates so the caller logs it and records a visible
    model fallback — never a silent downgrade.
    """

    provider = "vertex_gemini"

    def __init__(self, *, project: str, region: str, generation_model: str, token_provider: Any,
                 timeout: float = 120.0) -> None:
        self._project = project
        self._region = region or "us-central1"
        self._generation_model = generation_model
        self._tp = token_provider
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings, token_provider: Any,
                      generation_model: Optional[str] = None) -> "VertexGeminiClient":
        # generation_model override lets us build a faster variant (e.g. gemini-2.5-flash) for the advisor
        # fast path without touching the default (Pro) client. None → the configured default.
        return cls(
            project=settings.vertex_project,
            region=settings.vertex_region,
            generation_model=generation_model or settings.vertex_gemini_model or settings.gemini_generation_model,
            token_provider=token_provider,
            # Gemini 2.5 Pro is a slow reasoning model; advisor JSON over a large context can take 45-90s.
            # 45s caused ReadTimeout -> None -> deterministic fallback in prod. 120s gives real headroom.
            timeout=max(settings.http_timeout_seconds, 120.0),
        )

    @property
    def configured(self) -> bool:
        # Config presence only (project + model). Token validity is proven on first call, loudly.
        return bool(self._project and self._generation_model)

    def ready(self) -> bool:
        return self.configured

    @property
    def model_name(self) -> str:
        return self._generation_model

    def _endpoint(self) -> str:
        host = VERTEX_GEMINI_HOST_GLOBAL if self._region == "global" else f"{self._region}-aiplatform.googleapis.com"
        return (f"https://{host}/v1/projects/{self._project}/locations/{self._region}"
                f"/publishers/google/models/{self._generation_model}:generateContent")

    async def _bearer(self) -> str:
        # Token refresh is blocking (network); keep it off the event loop.
        return await asyncio.to_thread(self._tp.token)

    async def generate(self, system_prompt: str, user_prompt: str, temperature: Optional[float] = None) -> str:
        text, _ = await self.generate_with_usage(system_prompt, user_prompt, temperature)
        return text

    async def generate_with_usage(
        self, system_prompt: str, user_prompt: str, temperature: Optional[float] = None
    ) -> tuple[str, dict[str, int]]:
        if not self.configured:
            raise RuntimeError("VertexGeminiClient is not configured (VERTEX_PROJECT / model missing).")
        token = await self._bearer()  # raises VertexAuthError loudly if ADC is unavailable
        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        }
        if temperature is not None:
            payload["generationConfig"] = {"temperature": float(temperature)}
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await _request_with_retry(
                lambda: client.post(self._endpoint(), json=payload, headers=headers), label="vertex-generate")
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
