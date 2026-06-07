"""Recommendation Agent (F2 scaffold).

Fans out to domain services, collects H-contract recommendations, and ranks them
cross-domain by priority. Domain engines that emit recs land per-domain; in F2
this returns whatever domains expose (finance returns [] until Phase 1).
"""
from __future__ import annotations

from ..domains.base import DomainService
from ..models.common import Recommendation, UserContext

_PRIORITY = {"high": 0, "medium": 1, "low": 2}


class RecommendationAgent:
    async def collect(
        self, ctx: UserContext, services: dict[str, DomainService]
    ) -> list[Recommendation]:
        recs: list[Recommendation] = []
        for service in services.values():
            recs.extend(await service.recommendations(ctx))
        return self.rank(recs)

    def rank(self, recs: list[Recommendation]) -> list[Recommendation]:
        return sorted(recs, key=lambda r: _PRIORITY.get(r.priority, 1))
