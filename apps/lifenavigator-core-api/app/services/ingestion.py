"""Structured ingestion layer — the ONLY sanctioned path for an LLM/agent (via the MCP server) to
write discovered data into the life model.

Guarantees (sprint contract):
  * No model writes arbitrary tables — the TOOL decides the table, never the caller/LLM.
  * Every write is schema-validated (Pydantic) with allowed enums; invalid input is REJECTED with a
    structured error and NO partial write.
  * Every row is tenant/user scoped from the resolved context (never from the payload).
  * Every row carries provenance (source, confidence, confirmation_status, idempotency_key, refs).
  * Writes are idempotent (deterministic id) — repeated submissions update in place, never duplicate.
  * Candidate/inferred data is never silently promoted to confirmed.

Backed by the same SupabaseClient + `life` schema the rest of core-api uses. The MCP server is a thin
protocol wrapper over this service; this is where the logic lives so it is unit-testable.
"""
from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator

from ..models.common import UserContext

LIFE = "life"
_NS = uuid.NAMESPACE_DNS


def _now() -> str:
    from .life_discovery import _now as _n
    return _n()


# ---- Controlled vocabularies -------------------------------------------------
class Domain(str, Enum):
    finance = "finance"; family = "family"; health = "health"
    education = "education"; career = "career"; core = "core"


class ConfirmationStatus(str, Enum):
    confirmed = "confirmed"      # the user explicitly stated/affirmed it
    inferred = "inferred"        # the model inferred it; qualify when surfaced
    candidate = "candidate"      # provisional; never surfaced as fact


class SourceType(str, Enum):
    user_message = "user_message"; document = "document"; email = "email"
    calendar = "calendar"; agent_inference = "agent_inference"; external = "external"


class RelationType(str, Enum):
    supports = "supports"; conflicts = "conflicts"; blocks = "blocks"
    accelerates = "accelerates"; depends_on = "depends_on"


class Severity(str, Enum):
    low = "low"; medium = "medium"; high = "high"


class NarrativeKey(str, Enum):
    family_foundation = "family_foundation"; career_acceleration = "career_acceleration"
    financial_stabilization = "financial_stabilization"; health_life_balance = "health_life_balance"
    legacy_entrepreneurship = "legacy_entrepreneurship"; exploring = "exploring"


# ---- Provenance (required on every submission) -------------------------------
class Provenance(BaseModel):
    submitted_by: str = Field(..., min_length=1)         # who/what (e.g. "arcana-discovery", "claude-desktop")
    source_type: SourceType = SourceType.agent_inference
    conversation_id: Optional[str] = None
    document_id: Optional[str] = None
    email_id: Optional[str] = None
    calendar_event_id: Optional[str] = None
    user_message: Optional[str] = None                   # the source utterance, if any


class _Base(BaseModel):
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    confirmation_status: ConfirmationStatus = ConfirmationStatus.candidate
    provenance: Provenance
    idempotency_key: Optional[str] = None


class LifeFactIn(_Base):
    fact_type: str = Field(..., min_length=1, max_length=80)
    value: str = Field(..., min_length=1)
    domain: Domain = Domain.core


class GoalIn(_Base):
    goal_title: str = Field(..., min_length=1)
    domain: Domain = Domain.core
    timeframe: Optional[str] = None
    priority: Optional[str] = None
    related_narrative: Optional[NarrativeKey] = None
    supporting_quote: Optional[str] = None
    dependencies: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class ConstraintIn(_Base):
    label: str = Field(..., min_length=1)
    domain: Domain = Domain.core
    detail: Optional[str] = None
    severity: Severity = Severity.medium


class RiskIn(_Base):
    label: str = Field(..., min_length=1)
    domain: Domain = Domain.core
    severity: Severity = Severity.medium


class OpportunityIn(_Base):
    label: str = Field(..., min_length=1)
    domain: Domain = Domain.core


class NarrativeIn(_Base):
    narrative_key: NarrativeKey
    summary: Optional[str] = None


class RelationshipIn(_Base):
    from_ref: str = Field(..., min_length=1)
    to_ref: str = Field(..., min_length=1)
    relation_type: RelationType
    domain: Optional[Domain] = None

    @field_validator("to_ref")
    @classmethod
    def _no_self_edge(cls, v: str, info: Any) -> str:
        if v.strip() and v.strip() == (info.data.get("from_ref") or "").strip():
            raise ValueError("from_ref and to_ref must differ")
        return v


class IngestionService:
    """Validate → scope → stamp provenance → idempotent upsert. One method per MCP tool."""

    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    # ---- helpers -------------------------------------------------------------
    @staticmethod
    def _det_id(ctx: UserContext, table: str, key: str) -> str:
        return str(uuid.uuid5(_NS, f"{ctx.user_id}:{table}:{key}"))

    @staticmethod
    def _prov_dict(m: _Base) -> dict[str, Any]:
        p = m.provenance
        return {"submitted_by": p.submitted_by, "source_type": p.source_type.value,
                "conversation_id": p.conversation_id, "document_id": p.document_id,
                "email_id": p.email_id, "calendar_event_id": p.calendar_event_id,
                "user_message": p.user_message}

    @staticmethod
    def _ok(table: str, row_id: str) -> dict[str, Any]:
        return {"ok": True, "table": f"{LIFE}.{table}", "id": row_id, "action": "upserted"}

    @staticmethod
    def _err(code: str, errors: Any) -> dict[str, Any]:
        return {"ok": False, "code": code, "errors": errors}

    def _validate(self, model: type[BaseModel], payload: dict[str, Any]):
        try:
            return model(**(payload or {})), None
        except ValidationError as e:
            return None, self._err("schema_validation",
                                   [{"field": ".".join(str(x) for x in err["loc"]), "msg": err["msg"]}
                                    for err in e.errors()])

    async def _upsert(self, table: str, row: dict[str, Any], *, on_conflict: Optional[str] = None) -> dict[str, Any]:
        res = await self._sb.upsert(table, row, schema=LIFE, on_conflict=on_conflict)
        if not res:
            return self._err("write_failed", "database rejected the write")
        return self._ok(table, row["id"])

    # ---- tools ---------------------------------------------------------------
    async def submit_life_fact(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(LifeFactIn, payload)
        if err:
            return err
        key = m.idempotency_key or f"{m.fact_type}:{m.value}".lower()
        row = {"id": self._det_id(ctx, "facts", key), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "fact_type": m.fact_type, "value": m.value, "domain": m.domain.value,
               "confidence": m.confidence, "confirmation_status": m.confirmation_status.value,
               "source": m.provenance.source_type.value, "provenance": self._prov_dict(m),
               "idempotency_key": m.idempotency_key, "updated_at": _now()}
        return await self._upsert("facts", row)

    async def submit_goal(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(GoalIn, payload)
        if err:
            return err
        normalized = m.goal_title.strip().lower()
        # idempotent on the natural dedupe key (user_id, normalized_goal): same goal → same id, no dup.
        row = {"id": self._det_id(ctx, "candidate_goals", normalized), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "goal_text": m.goal_title, "normalized_goal": normalized, "domain": m.domain.value,
               "confidence": m.confidence, "supporting_quote": m.supporting_quote,
               # candidate/inferred NEVER auto-promoted to confirmed.
               "status": "confirmed" if m.confirmation_status == ConfirmationStatus.confirmed else "active",
               "confirmation_status": m.confirmation_status.value, "source": m.provenance.source_type.value,
               "provenance": {**self._prov_dict(m), "timeframe": m.timeframe, "priority": m.priority,
                              "related_narrative": m.related_narrative.value if m.related_narrative else None,
                              "stated_dependencies": m.dependencies, "stated_risks": m.risks},
               "idempotency_key": m.idempotency_key, "updated_at": _now()}
        return await self._upsert("candidate_goals", row, on_conflict="user_id,normalized_goal")

    async def submit_constraint(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(ConstraintIn, payload)
        if err:
            return err
        key = m.idempotency_key or m.label.lower()
        row = {"id": self._det_id(ctx, "constraints", key), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "label": m.label, "detail": m.detail, "severity": m.severity.value,
               "confidence": m.confidence, "confirmation_status": m.confirmation_status.value,
               "source": m.provenance.source_type.value, "provenance": self._prov_dict(m),
               "idempotency_key": m.idempotency_key}
        return await self._upsert("constraints", row)

    async def submit_risk(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(RiskIn, payload)
        if err:
            return err
        key = m.idempotency_key or m.label.lower()
        row = {"id": self._det_id(ctx, "risks", key), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "label": m.label, "domain": m.domain.value, "severity": m.severity.value,
               "confidence": m.confidence, "confirmation_status": m.confirmation_status.value,
               "source": m.provenance.source_type.value, "provenance": self._prov_dict(m),
               "idempotency_key": m.idempotency_key}
        return await self._upsert("risks", row)

    async def submit_opportunity(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(OpportunityIn, payload)
        if err:
            return err
        key = m.idempotency_key or m.label.lower()
        row = {"id": self._det_id(ctx, "opportunities", key), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "label": m.label, "domain": m.domain.value,
               "confidence": m.confidence, "confirmation_status": m.confirmation_status.value,
               "source": m.provenance.source_type.value, "provenance": self._prov_dict(m),
               "idempotency_key": m.idempotency_key}
        return await self._upsert("opportunities", row)

    async def submit_narrative(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(NarrativeIn, payload)
        if err:
            return err
        # A submitted narrative is a CANDIDATE signal stored as a fact — the canonical dominant_narrative
        # remains DERIVED from the goal set (never overwritten by a submission).
        key = m.idempotency_key or "narrative"
        row = {"id": self._det_id(ctx, "facts", f"narrative:{m.narrative_key.value}"),
               "user_id": ctx.user_id, "tenant_id": ctx.user_id, "fact_type": "dominant_narrative",
               "value": m.narrative_key.value, "domain": "core", "confidence": m.confidence,
               "confirmation_status": m.confirmation_status.value, "source": m.provenance.source_type.value,
               "provenance": {**self._prov_dict(m), "summary": m.summary}, "idempotency_key": m.idempotency_key,
               "updated_at": _now()}
        return await self._upsert("facts", row)

    async def submit_relationship(self, ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
        m, err = self._validate(RelationshipIn, payload)
        if err:
            return err
        key = m.idempotency_key or f"{m.from_ref}:{m.relation_type.value}:{m.to_ref}".lower()
        row = {"id": self._det_id(ctx, "relationships", key), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
               "from_ref": m.from_ref, "to_ref": m.to_ref, "relation_type": m.relation_type.value,
               "domain": m.domain.value if m.domain else None, "confidence": m.confidence,
               "confirmation_status": m.confirmation_status.value, "source": m.provenance.source_type.value,
               "provenance": self._prov_dict(m), "idempotency_key": m.idempotency_key, "updated_at": _now()}
        return await self._upsert("relationships", row)


# Tool registry — name → (method, input model). The MCP server iterates this; the LLM picks a TOOL,
# never a table. Adding a tool here is the only way to add a write path.
TOOL_REGISTRY: dict[str, type[BaseModel]] = {
    "submit_life_fact": LifeFactIn, "submit_goal": GoalIn, "submit_constraint": ConstraintIn,
    "submit_risk": RiskIn, "submit_opportunity": OpportunityIn, "submit_narrative": NarrativeIn,
    "submit_relationship": RelationshipIn,
}
