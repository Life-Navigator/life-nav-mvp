"""Domain Projection — bridge discovery goals into the per-domain tables.

Discovery writes the user's goals to ``life.*`` (objectives, candidate_goals,
graph). But the dashboard domain pages read from the *domain* schemas
(``career.*``, ``education.*``, ``family.*``). Without a bridge, a user who tells
the advisor "I want a CEO role" or "executive education at Harvard" sees nothing
on the Career/Education pages — and is asked to re-enter it. This service projects
each discovered goal into the matching domain table so the captured data shows up
where the user expects it.

Honesty rules (No-mock-data):
- We only project the user's OWN explicitly-stated goals (career/education) and
  unambiguous entities (a pet from "we got a puppy"). We never invent a person's
  name, so partners/dependents are NOT auto-created (those tables require a name).
- Every projected row carries provenance in ``metadata`` (source, supporting
  quote, confidence, candidate-goal id) so it's distinguishable + user-editable.
- Deterministic uuid5 ids → re-running discovery upserts in place (no duplicates).
- Best-effort + fail-soft: a missing table or write error never breaks a turn.
"""
from __future__ import annotations

import uuid
from typing import Any

from app.services.life_discovery import _now

_PROJ_NS = uuid.NAMESPACE_DNS
_MIN_CONFIDENCE = 0.5

_ROLE_KEYWORDS = {
    "ceo": "CEO", "cfo": "CFO", "cto": "CTO", "coo": "COO",
    "vice president": "Vice President", "vp": "VP", "director": "Director",
    "founder": "Founder", "partner": "Partner",
}
_PET_SPECIES = {
    "puppy": "dog", "dog": "dog", "kitten": "cat", "cat": "cat",
    "bird": "bird", "fish": "fish", "hamster": "hamster", "rabbit": "rabbit",
}


def _role_from_text(text: str) -> str | None:
    t = (text or "").lower()
    for kw, label in _ROLE_KEYWORDS.items():
        if kw in t:
            return label
    return None


def _species_from_text(text: str) -> str | None:
    t = (text or "").lower()
    for kw, species in _PET_SPECIES.items():
        if kw in t:
            return species
    return None


def _mentions_pet(text: str) -> bool:
    return _species_from_text(text) is not None or "pet" in (text or "").lower()


class DomainProjectionService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    async def project(self, ctx: Any, candidate_goals: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Project career/education goals + unambiguous family entities into domain tables."""
        projected: list[dict[str, Any]] = []
        for g in candidate_goals or []:
            try:
                conf = float(g.get("confidence") or 0.0)
            except (TypeError, ValueError):
                conf = 0.0
            if conf < _MIN_CONFIDENCE:
                continue
            text = str(g.get("goal") or g.get("objective") or "").strip()
            if not text:
                continue
            domain = g.get("domain") or "core"
            quotes = g.get("supporting_quotes") or []
            quote = (quotes[0] if quotes else text)[:500]
            prov = {
                "source": "discovery_projection",
                "supporting_quote": quote,
                "confidence": conf,
                "objective_key": g.get("objective_key"),
            }
            try:
                if domain == "career":
                    projected.append(await self._project_career(ctx, text, prov))
                elif domain == "education":
                    projected.append(await self._project_education(ctx, text, prov))
                elif domain == "family" and _mentions_pet(text):
                    projected.append(await self._project_pet(ctx, text, prov))
            except Exception:  # noqa: BLE001 — projection must never break a discovery turn
                continue
        return [p for p in projected if p]

    def _id(self, ctx: Any, table: str, text: str) -> str:
        return str(uuid.uuid5(_PROJ_NS, f"{ctx.user_id}:proj:{table}:{text.lower()}"))

    async def _project_career(self, ctx: Any, text: str, prov: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": self._id(ctx, "career_goals", text),
            "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "title": text[:200],
            "goal_type": "advancement",
            "target_role": _role_from_text(text),
            "status": "active",
            "metadata": prov,
            "updated_at": _now(),
        }
        await self._sb.upsert("career_goals", row, schema="career")
        return {"table": "career.career_goals", "id": row["id"]}

    async def _project_education(self, ctx: Any, text: str, prov: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": self._id(ctx, "education_goals", text),
            "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "title": text[:200],
            "goal_type": "credential",
            "status": "active",
            "metadata": prov,
            "updated_at": _now(),
        }
        await self._sb.upsert("education_goals", row, schema="education")
        return {"table": "education.education_goals", "id": row["id"]}

    async def _project_pet(self, ctx: Any, text: str, prov: dict[str, Any]) -> dict[str, Any]:
        species = _species_from_text(text) or "pet"
        # We don't invent a name; use a clear, editable placeholder. name is NOT NULL.
        name = "New puppy" if species == "dog" and "puppy" in text.lower() else f"New {species}"
        row = {
            "id": self._id(ctx, "pets", species),  # one placeholder pet per species, editable
            "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "name": name,
            "species": species,
            "metadata": prov,
            "updated_at": _now(),
        }
        await self._sb.upsert("pets", row, schema="family")
        return {"table": "family.pets", "id": row["id"]}
