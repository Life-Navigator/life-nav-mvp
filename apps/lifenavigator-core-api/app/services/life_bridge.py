"""Canonical Data Bridge (Elite Sprint 40).

Closes the audit's root cause: the web platform collects onboarding data into one set of tables and
the intelligence platform reasons over another, so onboarding never reached readiness /
recommendations / discovery. This bridge projects the web onboarding data that ACTUALLY exists in
production — `public.user_persona_profile` (populated for 63 users: primary_goals + risk_profile +
income/asset profile) and, when present, `public.goals` / `public.risk_assessments` — into the
canonical Life Model (`life.*`) so every downstream system reasons from one truth. Idempotent.

Verified against prod: finance.user_financial_profile does NOT exist and public.goals/
risk_assessments are empty platform-wide; user_persona_profile is the real source, so it is the
primary bridge input. Financial inputs for tools come from finance.financial_accounts /
net_worth_snapshots (which the persona activation populates).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..models.common import UserContext

LIFE = "life"

# Map a persona/onboarding goal phrase to a canonical root objective (so the bridge never probes).
_GOAL_ROOT: list[tuple[tuple[str, ...], str]] = [
    (("emergency fund", "save", "savings", "debt", "pay down", "pay off", "invest", "investing", "retire", "retirement", "wealth", "net worth", "taxes", "irregular income"), "financial_independence"),
    (("family", "kids", "child", "children", "mortgage", "home", "house", "college for"), "family_stability"),
    (("business", "career", "promotion", "job", "raise", "separate business"), "career_growth"),
    (("school", "degree", "mba", "education", "certification"), "education_advancement"),
    (("health", "fitness", "weight", "wellness"), "health_longevity"),
    (("estate", "legacy", "inherit", "trust"), "legacy"),
]
_RISK_TOLERANCE = {"conservative": 30, "cautious": 35, "moderate": 60, "balanced": 60, "growth": 75, "aggressive": 85, "very aggressive": 95}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _root_for(goal: str) -> str:
    g = (goal or "").lower()
    for sigs, root in _GOAL_ROOT:
        if any(s in g for s in sigs):
            return root
    return "financial_independence"  # persona goals are predominantly financial


class LifeBridgeService:
    def __init__(self, supabase: Any, life: Any) -> None:
        self._sb = supabase
        self._life = life  # LifeDiscoveryService — the canonical writer of objectives/graph

    async def _persona(self, ctx: UserContext) -> dict[str, Any]:
        try:
            rows = await self._sb.select("user_persona_profile", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="public")
            return rows[0] if rows else {}
        except Exception:  # noqa: BLE001
            return {}

    async def _public_goals(self, ctx: UserContext) -> list[dict[str, Any]]:
        try:
            return await self._sb.select("goals", filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema="public")
        except Exception:  # noqa: BLE001
            return []

    async def signature(self, ctx: UserContext) -> str:
        """A cheap fingerprint of the onboarding inputs (so reads can detect new onboarding data)."""
        p = await self._persona(ctx)
        g = await self._public_goals(ctx)
        return f"persona={p.get('updated_at') or p.get('persona_id') or ''}#goals={len(g)}"

    async def sync(self, ctx: UserContext) -> dict[str, Any]:
        """Project onboarding data → the canonical Life Model. Idempotent (uuid5-keyed objectives)."""
        persona = await self._persona(ctx)
        bridged_goals = 0
        sources: list[str] = []

        # 1) Persona primary_goals + explicit public.goals → life objectives (canonical, via discovery).
        goal_phrases: list[str] = []
        pg = persona.get("primary_goals")
        if isinstance(pg, list):
            goal_phrases += [str(x) for x in pg]
        elif isinstance(pg, str) and pg.strip():
            goal_phrases.append(pg)
        for row in await self._public_goals(ctx):
            if row.get("title"):
                goal_phrases.append(str(row["title"]))
        if persona:
            sources.append("user_persona_profile")
        for phrase in dict.fromkeys(goal_phrases):  # dedupe, preserve order
            try:
                await self._life.discover_goal(ctx, surface_goal=phrase, why_chain=[{"q": "onboarding goal", "a": phrase}],
                                               root_override=_root_for(phrase))
                bridged_goals += 1
            except Exception:  # noqa: BLE001
                continue

        # 2) Risk profile → life.risk_profiles (persona.risk_profile, else public.risk_assessments).
        risk_label = str(persona.get("risk_profile") or "").lower()
        risk_written = False
        if not risk_label:
            try:
                ra = await self._sb.select("risk_assessments", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, order="created_at.desc", schema="public")
                if ra:
                    risk_label = str(ra[0].get("risk_tolerance") or "").lower()
            except Exception:  # noqa: BLE001
                pass
        if risk_label:
            tol = next((v for k, v in _RISK_TOLERANCE.items() if k in risk_label), 60)
            await self._sb.upsert("risk_profiles", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                    "tolerance": tol, "capacity": tol, "behavior": risk_label,
                                                    "horizon_years": 20, "loss_aversion": 100 - tol}, schema=LIFE)
            risk_written = True
            sources.append("risk_profile")

        # 3) Life vision from the persona if none exists yet (so the dashboard leads with something real).
        if persona.get("display_name") or persona.get("life_stage"):
            try:
                existing = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=LIFE)
                if not existing:
                    stage = persona.get("life_stage") or persona.get("profession") or "this stage of life"
                    await self._life.save_vision(ctx, vision_text=f"Build security and progress through {stage}.",
                                                 prompts={"source": "persona_bridge"})
            except Exception:  # noqa: BLE001
                pass

        return {"bridged_goals": bridged_goals, "risk_written": risk_written, "sources": sources,
                "persona_id": persona.get("persona_id"), "synced_at": _now()}
