"""Context assembly: domain authoritative facts + personal graph evidence +
(optional) central governance corpus → an EvidencePacket.

Central corpus (``ln_central``) is SCAFFOLDED but DISABLED until seeded — when
disabled, no CENTRAL_CONTEXT is added to the packet (matching today's stripped
behavior). Authoritative facts come from the system of record (Supabase via the
domain services); the model never sees raw rows, only this packet.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..domains.base import DomainService
from ..models.common import (
    Confidence,
    DomainChatContext,
    EvidencePacket,
    Freshness,
    UserContext,
)
from .retriever import RECOMMENDATION_LABELS, Retriever


class ContextBuilder:
    def __init__(
        self,
        domain_services: dict[str, DomainService],
        retriever: Retriever,
        *,
        central_enabled: bool = False,  # ln_central not seeded yet (Phase 8)
    ) -> None:
        self._domains = domain_services
        self._retriever = retriever
        self._central_enabled = central_enabled

    async def build_domain_context(self, ctx: UserContext, domain: str) -> DomainChatContext:
        service = self._domains[domain]
        return await service.chat_context(ctx)

    async def build_evidence_packet(
        self, ctx: UserContext, query: str, domains: list[str], *, intent: str = "general"
    ) -> EvidencePacket:
        authoritative: list[dict] = []
        missing: list[str] = []
        relevant = [d for d in domains if d in self._domains]

        for domain in relevant:
            dctx = await self.build_domain_context(ctx, domain)
            authoritative.extend(dctx.authoritative_facts)
            missing.extend(dctx.missing_facts)

        # Recommendation evidence subgraph -> authoritative facts (domain-generic).
        # Uses the CLASSIFIED domains (not just registered services), so chat can
        # answer "why are you recommending this?" for Health even while HealthService
        # is unregistered — the evidence lives in the graph.
        for d in domains:
            if d in RECOMMENDATION_LABELS:
                authoritative.extend(await self._retriever.recommendation_evidence(ctx, domain=d))

        # Only retrieve from the graph once we know there are facts worth grounding
        # against (saves a Gemini embed call + a Qdrant/Neo4j round-trip otherwise).
        graph_evidence: list[dict] = []
        if authoritative:
            for domain in relevant:
                graph_evidence.extend(
                    await self._retriever.retrieve_personal(query, ctx, domain=domain)
                )

        central_context = None
        if self._central_enabled:
            central_context = ""  # Phase 8 seeds ln_central + fills this.

        basis = "partial" if authoritative else "missing"
        return EvidencePacket(
            intent=intent,
            domains=relevant,
            authoritative_facts=authoritative,
            missing_facts=sorted(set(missing)),
            graph_evidence=graph_evidence,
            central_context=central_context,
            freshness=Freshness(as_of=datetime.now(timezone.utc).isoformat()),
            confidence=Confidence(
                score=0.6 if authoritative else 0.0,
                basis=basis,  # type: ignore[arg-type]
                missing_fields=sorted(set(missing)),
            ),
        )
