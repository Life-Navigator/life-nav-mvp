"""Gemini client (embeddings + generation).

Pure async wrapper over Gemini's REST endpoint. No retry logic baked
in — callers can wrap with their own backoff.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx


@dataclass
class GeminiClient:
    api_key: str
    embedding_model: str = "gemini-embedding-001"
    generation_model: str = "gemini-2.5-flash"
    timeout_seconds: float = 30.0

    async def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("refused to embed empty text")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/"
            f"models/{self.embedding_model}:embedContent?key={self.api_key}"
        )
        payload = {"content": {"parts": [{"text": text}]}}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await client.post(url, json=payload)
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
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError):
                return ""
