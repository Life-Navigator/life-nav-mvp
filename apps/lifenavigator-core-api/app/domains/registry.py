"""Domain registry — the single source of which domains are LIVE.

Only registered DomainService implementations are live. Unfinished domains are
NEVER exposed as live and NEVER return fake data — they appear only as names in
``unavailable()`` (metadata) so the frontend can show a roadmap, not empty tiles.
"""
from __future__ import annotations

from .base import DomainService

# The 10 platform domains (the roadmap). Live ones are whatever is registered.
KNOWN_DOMAINS: list[str] = [
    "finance",
    "health",
    "career",
    "family",
    "education",
    "goals",
    "risk",
    "calendar",
    "roadmap",
    "scenarios",
]


class DomainRegistry:
    def __init__(self, services: dict[str, DomainService]) -> None:
        self._services = services

    def live(self) -> dict[str, DomainService]:
        return self._services

    def live_names(self) -> list[str]:
        return list(self._services.keys())

    def is_live(self, domain: str) -> bool:
        return domain in self._services

    def unavailable(self) -> list[str]:
        """Known domains that are not yet live (metadata only — no data)."""
        return [d for d in KNOWN_DOMAINS if d not in self._services]
