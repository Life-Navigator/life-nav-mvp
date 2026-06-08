"""Life Orchestrator Agent — routes a chat turn through the grounded flow.

Flow (F2):
  1. classify intent → relevant domains
  2. assemble Supabase authoritative facts + (if grounded) Personal GraphRAG
  3. ANTI-HALLUCINATION GATE: if the system of record has no authoritative facts,
     DO NOT call Gemini — ask the user / surface missing data instead.
  4. apply central governance boundaries if available (disabled until seeded)
  5. call Gemini server-side ONLY with the gated evidence packet
  6. pass output through Trust/Safety; on block return a safe fallback
  7. persist the turn; return the grounded response with evidence metadata
"""
from __future__ import annotations

import logging

from ..clients.gemini import GeminiClient
from ..grounding.context_builder import ContextBuilder
from ..models.common import ChatTurnResponse, EvidencePacket, GovernanceVerdict, UserContext
from ..services.medical_safety import MedicalSafetyGate
from .memory import MemoryAgent
from .trust_safety import TrustSafetyAgent

log = logging.getLogger("core.orchestrator")

_FINANCE_KEYWORDS = (
    "net worth", "spend", "spending", "debt", "cash", "money", "account",
    "budget", "retirement", "savings", "afford", "income", "expense", "invest",
)

_FALLBACK = (
    "I'm not able to give a confident answer right now. Your data is safe — "
    "please try again in a moment."
)


_HEALTH_KEYWORDS = (
    "sleep", "nutrition", "exercise", "workout", "activity", "wellness", "habit",
    "steps", "vital", "health", "fitness", "diet", "recovery", "hydration",
)

_CAREER_KEYWORDS = (
    "career", "job", "role", "promotion", "promoted", "market value", "what am i worth",
    "raise", "salary", "compensation", "employer", "resume", "interview", "hire", "hiring",
)

_EDUCATION_KEYWORDS = (
    "school", "college", "degree", "program", "major", "bootcamp", "mba", "law school",
    "grad school", "graduate program", "tuition", "student debt", "education", "study",
    "university", "phd", "masters", "bachelor", "course", "scholarship",
)


def _classify(query: str) -> tuple[str, list[str]]:
    q = (query or "").lower()
    if any(k in q for k in _EDUCATION_KEYWORDS):
        return "education_query", ["education"]
    if any(k in q for k in _CAREER_KEYWORDS):
        return "career_query", ["career"]
    if any(k in q for k in _HEALTH_KEYWORDS):
        return "health_query", ["health"]
    if any(k in q for k in _FINANCE_KEYWORDS):
        return "finance_query", ["finance"]
    # Ambiguous (e.g. "why are you recommending this?") -> ground on any recommendation.
    return "general", ["finance", "health", "career", "education"]


class LifeOrchestratorAgent:
    def __init__(
        self,
        context_builder: ContextBuilder,
        gemini: GeminiClient,
        trust_safety: TrustSafetyAgent,
        memory: MemoryAgent,
    ) -> None:
        self._ctx_builder = context_builder
        self._gemini = gemini
        self._trust_safety = trust_safety
        self._memory = memory
        self._medical = MedicalSafetyGate()

    async def handle(
        self, ctx: UserContext, query: str, conversation_id: str | None = None
    ) -> ChatTurnResponse:
        intent, domains = _classify(query)

        # Medical safety: for health queries, BLOCK diagnosis/dosing/treatment and
        # ESCALATE emergencies before any model call (HEALTH_GOVERNANCE_STANDARD).
        if "health" in domains:
            decision = self._medical.evaluate(query)
            if not decision.allowed:
                return ChatTurnResponse(
                    message=decision.message,
                    grounded=True,
                    used_gemini=False,
                    conversation_id=conversation_id,
                    governance=GovernanceVerdict(passed=(decision.action != "block")),
                )

        packet = await self._ctx_builder.build_evidence_packet(ctx, query, domains, intent=intent)

        # (3) ANTI-HALLUCINATION GATE — no facts → no model call.
        if not packet.has_sufficient_grounding:
            return ChatTurnResponse(
                message=self._insufficient_message(packet),
                grounded=True,
                used_gemini=False,
                missing_facts=packet.missing_facts,
                evidence=[],
                conversation_id=conversation_id,
            )

        # (5) Gemini — server-side, prompted ONLY with the gated packet.
        system_prompt = self._system_prompt(packet)
        user_prompt = self._user_prompt(query, packet)
        raw = await self._gemini.generate(system_prompt, user_prompt)

        # (6) Trust/Safety — mandatory.
        verdict = self._trust_safety.review(raw, domain=domains[0] if domains else "core")
        if not verdict.passed:
            log.info("trust/safety blocked output: %s", verdict.reasons)
            return ChatTurnResponse(
                message=_FALLBACK,
                grounded=True,
                used_gemini=True,
                fallback=True,
                conversation_id=conversation_id,
                governance=GovernanceVerdict(passed=False),
            )

        # (7) persist + return with evidence metadata.
        await self._memory.persist_turn(ctx, conversation_id, query, raw)
        return ChatTurnResponse(
            message=raw,
            grounded=True,
            used_gemini=True,
            missing_facts=packet.missing_facts,
            evidence=packet.graph_evidence,
            conversation_id=conversation_id,
            governance=GovernanceVerdict(
                passed=True,
                audit_id=verdict.audit_id,
                character_score=verdict.character_score,
            ),
        )

    # --- prompt assembly: authoritative facts override; missing facts are asked ---
    def _system_prompt(self, packet: EvidencePacket) -> str:
        parts = [
            "You are LifeNavigator, a careful financial and life advisor.",
            "Answer ONLY from the AUTHORITATIVE FACTS and GRAPH EVIDENCE below.",
            "Never invent numbers or facts. If something is in MISSING FACTS, ask "
            "the user for it instead of guessing.",
        ]
        if packet.central_context:
            parts.append(f"\nCENTRAL_CONTEXT (methodology):\n{packet.central_context}")
        parts.append("\nAUTHORITATIVE FACTS:\n" + self._facts_block(packet))
        if packet.missing_facts:
            parts.append("\nMISSING FACTS (ask, do not invent): " + ", ".join(packet.missing_facts))
        return "\n".join(parts)

    def _user_prompt(self, query: str, packet: EvidencePacket) -> str:
        ev = "\n".join(
            f"- {e.get('source')}: {e.get('label') or e.get('entity_type')} {e.get('entity_id') or ''}".strip()
            for e in packet.graph_evidence
        )
        return f"GRAPH EVIDENCE:\n{ev or '(none)'}\n\nUser question: {query}"

    def _facts_block(self, packet: EvidencePacket) -> str:
        lines = []
        for f in packet.authoritative_facts:
            lines.append(f"- {f.get('fact')}: {f.get('value')}")
        return "\n".join(lines) or "(none)"

    def _insufficient_message(self, packet: EvidencePacket) -> str:
        missing = ", ".join(packet.missing_facts) or "your account data"
        return (
            "I don't have enough of your data yet to answer that accurately. "
            f"To help, please connect or add: {missing}. "
            "I won't guess at numbers I can't verify."
        )
