"""Gemini client (F1 placeholder) — server-side reasoning ONLY.

The API key lives only in the Fly environment. This client is never importable
into any frontend/Vercel path (ARCHITECTURE_BOUNDARIES.md). Real embed/generate
(behind the Trust/Safety gate) lands in F2.
"""
from __future__ import annotations

from ..config import Settings

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiClient:
    def __init__(self, api_key: str, embedding_model: str, generation_model: str, timeout: float = 8.0) -> None:
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
            timeout=settings.http_timeout_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def embed(self, text: str) -> list[float]:  # pragma: no cover - F2
        raise NotImplementedError("Gemini embed lands in F2 (grounding).")

    async def generate(self, prompt: str) -> str:  # pragma: no cover - F2
        raise NotImplementedError(
            "Gemini generate lands in F2 (behind the Trust/Safety gate)."
        )

    def ready(self) -> bool:
        # Config presence only — we do NOT spend a token on health checks.
        return self.configured
