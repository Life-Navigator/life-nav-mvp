"""Shared contract primitives — the wire types between Core API and frontend.

These mirror DOMAIN_DATA_CONTRACTS.md (F/G/H). Every domain view-model is
COMPLETE: the frontend renders it directly and never assembles raw rows or
computes business values. Freshness + Confidence travel with every payload so
the UI can show staleness/uncertainty without extra calls.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser


# --------------------------------------------------------------------------- #
# Identity
# --------------------------------------------------------------------------- #
class UserContext(BaseModel):
    """The authenticated caller. ``tenant_id == user_id`` for personal data."""

    user_id: str
    email: Optional[str] = None
    role: str = "authenticated"

    @property
    def tenant_id(self) -> str:
        return self.user_id

    @classmethod
    def from_auth(cls, user: "AuthenticatedUser") -> "UserContext":
        return cls(user_id=user.user_id, email=user.email, role=user.role)


# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #
class Money(BaseModel):
    amount: float
    currency: str = "USD"


class SourceRef(BaseModel):
    """Provenance for a fact/tile, for the trust UI."""

    system: Literal["supabase", "qdrant", "neo4j", "computed"]
    table: Optional[str] = None
    label: Optional[str] = None
    collection: Optional[str] = None
    as_of: Optional[str] = None


class Freshness(BaseModel):
    as_of: Optional[str] = None
    stale: bool = False
    sources: list[SourceRef] = Field(default_factory=list)


class Confidence(BaseModel):
    score: float = 0.0
    basis: Literal["complete", "partial", "sparse", "missing"] = "missing"
    missing_fields: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Recommendation (H contract)
# --------------------------------------------------------------------------- #
class Evidence(BaseModel):
    statement: str
    source: SourceRef


class ActionStep(BaseModel):
    step: str
    effort: Literal["low", "medium", "high"] = "medium"
    impact: Literal["low", "medium", "high"] = "medium"


class Escalation(BaseModel):
    type: Literal["medical", "legal", "tax", "financial_advice"]
    disclaimer: str


class GovernanceVerdict(BaseModel):
    audit_id: Optional[str] = None
    character_score: Optional[float] = None
    passed: bool = True


class Recommendation(BaseModel):
    id: str
    title: str
    explanation: str
    evidence: list[Evidence] = Field(default_factory=list)
    source_tables: list[str] = Field(default_factory=list)
    source_graph_nodes: list[dict[str, str]] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    confidence: Confidence = Field(default_factory=Confidence)
    priority: Literal["high", "medium", "low"] = "medium"
    affected_domains: list[str] = Field(default_factory=list)
    action_steps: list[ActionStep] = Field(default_factory=list)
    escalation: Optional[Escalation] = None
    generated_by: str = "core-api"
    governance: Optional[GovernanceVerdict] = None


# --------------------------------------------------------------------------- #
# Domain envelopes (F + G contracts)
# --------------------------------------------------------------------------- #
class DomainViewModel(BaseModel):
    """The complete payload a domain surface renders (F contract)."""

    domain: str
    user_id: str
    generated_at: str
    freshness: Freshness = Field(default_factory=Freshness)
    confidence: Confidence = Field(default_factory=Confidence)
    data: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[Recommendation] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)


class DomainChatContext(BaseModel):
    """Per-domain grounding for chat/agents (G contract)."""

    domain: str
    authoritative_facts: list[dict[str, Any]] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list)
    relevant_goals: list[dict[str, Any]] = Field(default_factory=list)
    risks: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    graph_evidence: list[dict[str, Any]] = Field(default_factory=list)
    freshness: Freshness = Field(default_factory=Freshness)
    confidence: Confidence = Field(default_factory=Confidence)


class WriteResult(BaseModel):
    ok: bool = True
    entity_id: Optional[str] = None
    detail: Optional[str] = None


# --------------------------------------------------------------------------- #
# Orchestration (agent ↔ orchestrator) + chat response
# --------------------------------------------------------------------------- #
class EvidencePacket(BaseModel):
    """What the orchestrator assembles before any model call. Gemini is prompted
    ONLY with this — never raw cross-user data, never ungated content.
    """

    intent: str = "general"
    domains: list[str] = Field(default_factory=list)
    authoritative_facts: list[dict[str, Any]] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list)
    graph_evidence: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    central_context: Optional[str] = None  # disabled until ln_central is seeded
    freshness: Freshness = Field(default_factory=Freshness)
    confidence: Confidence = Field(default_factory=Confidence)

    @property
    def has_sufficient_grounding(self) -> bool:
        """Anti-hallucination gate: we only reason when the system of record has
        at least one authoritative fact. Otherwise we ask, never invent.
        """
        return len(self.authoritative_facts) > 0


class ChatTurnResponse(BaseModel):
    message: str
    grounded: bool = True
    used_gemini: bool = False
    missing_facts: list[str] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    conversation_id: Optional[str] = None
    governance: Optional[GovernanceVerdict] = None
    fallback: bool = False
