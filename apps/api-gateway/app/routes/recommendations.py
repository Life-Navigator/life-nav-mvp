"""Recommendation generation endpoint.

POST /api/recommendations/generate

The recommendation envelope is run through the compliance module before
return. If the LLM produces text that fails compliance, the route
strips ``next_best_action`` and surfaces the compliance_notes so the UI
can refer the user to the appropriate partner.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import Field

from ..auth import AuthenticatedUser, current_user
from ..deps import get_gemini, get_neo4j, get_qdrant
from ..schemas.common import QueryRequest, RecommendationEnvelope
from ..services.compliance import check_recommendation
from ..services.gemini import GeminiClient
from ..services.graphrag_personal import retrieve_personal
from ..services.neo4j_client import Neo4jClient
from ..services.qdrant import QdrantClient

router = APIRouter()


class GenerateBody(QueryRequest):
    domain: str = Field(default="general")


SYSTEM_PROMPT = (
    "You are the LifeNavigator concierge. Generate a recommendation as a JSON "
    "object with fields: summary, recommended_actions (array of strings), "
    "rationale, relevant_goals (array of strings), constraints_considered "
    "(array of strings), risks (array of strings), confidence_score (0..1), "
    "next_best_action (single string), should_refer_to_partner (boolean), "
    "partner_type (string|null). Use planning language. Do NOT recommend "
    "specific securities. Do NOT diagnose, prescribe, or guarantee outcomes."
)


@router.post("/generate", response_model=RecommendationEnvelope)
async def generate(
    body: GenerateBody,
    user: AuthenticatedUser = Depends(current_user),
    gemini: GeminiClient = Depends(get_gemini),
    qdrant: QdrantClient = Depends(get_qdrant),
    neo4j: Neo4jClient = Depends(get_neo4j),
) -> RecommendationEnvelope:
    personal = await retrieve_personal(
        user_id=user.user_id,
        query=body.query,
        gemini=gemini,
        qdrant=qdrant,
        neo4j=neo4j,
        limit=body.limit,
        domain=body.domain,
    )
    context = "\n".join(
        f"- {h.get('entity_type','?')}: {h.get('title','') or h.get('summary','')}"
        for h in personal.fused
    )
    raw = await gemini.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=f"User query: {body.query}\n\nUser's relevant context:\n{context}\n\nReturn JSON only.",
    )
    envelope = _coerce_envelope(raw)
    compliance = check_recommendation(envelope.summary + " " + envelope.rationale + " " + (envelope.next_best_action or ""))
    envelope.compliance_notes = compliance.compliance_notes
    if not compliance.ok:
        # Strip the actionable parts; require human review.
        envelope.next_best_action = None
        envelope.should_refer_to_partner = True
        envelope.partner_type = _partner_for(compliance)
    return envelope


def _coerce_envelope(raw: str) -> RecommendationEnvelope:
    """Best-effort parse of the LLM JSON output. On failure, return an
    empty envelope rather than 500ing.
    """
    import json

    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("not an object")
        return RecommendationEnvelope.model_validate(data)
    except Exception:
        return RecommendationEnvelope(
            summary=(raw or "").strip()[:1000] or "No recommendation produced.",
            rationale="",
        )


def _partner_for(compliance) -> str | None:
    cats = {v.category for v in compliance.violations}
    if "medical" in cats:
        return "physician"
    if "securities" in cats:
        return "licensed_financial_advisor"
    if "guarantee" in cats:
        return "advisor"
    return None
