"""Canonical goal read-path join.

The goal layer is fragmented across four stores (public.goals CRUD+progress, life.candidate_goals
discovery, life.life_objectives root objectives, life.goals objective-linked nodes). Internally that is
acceptable for now; user-visible duplicate/conflicting goals are NOT. This service produces ONE coherent
goal view from the existing stores at READ time — no migration, no write, no delete, no destructive merge.

Rules:
  * Confirmed user goals win over candidate/persona goals (priority order below).
  * Unconfirmed persona/candidate goals NEVER override or duplicate a confirmed version.
  * Duplicates (same normalized title) are MERGED into one canonical goal carrying every source id +
    the richest fields (e.g. progress from public.goals attached to the confirmed objective).
  * Related-but-not-identical goals are CLUSTERED (grouped, not merged) — conservative, never over-dedupe.
  * Honest: if nothing is grounded, return [] (the caller shows "Arcana is still learning your goals").
"""
from __future__ import annotations

import re
from typing import Any

from ..models.common import UserContext

LIFE = "life"

# Source-store priority (lower = more authoritative). Confirmed user truth beats inferred/persona.
_PRIORITY = {
    "objective_confirmed": 1,
    "life_goal_confirmed": 2,
    "public_goal": 3,
    "life_goal": 3,
    "candidate_confirmed": 3,
    "objective_candidate": 4,
    "candidate": 4,
    "persona": 5,
}

# Conservative clustering: a few well-known goal families. Goals sharing a key are GROUPED, not merged.
_CLUSTER_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("home", ("house", "home", "down payment", "mortgage", "property")),
    ("debt", ("debt", "credit card", "loan", "pay off")),
    ("education", ("master", "mba", "degree", "phd", "certification", "school")),
    ("wedding", ("wedding", "married", "marriage", "engaged")),
    ("family", ("family", "child", "kids", "baby", "pregnan")),
    ("fitness", ("fitness", "weight", "gym", "marathon", "health goal")),
    ("career", ("promotion", "promoted", "raise", "career", "startup", "found")),
    ("retirement", ("retire", "retirement", "financial independence")),
]

_STOPWORDS = {"a", "an", "the", "to", "my", "our", "for", "of", "and"}


def _norm(title: str) -> str:
    t = re.sub(r"[^a-z0-9 ]", " ", (title or "").lower())
    toks = [w for w in t.split() if w and w not in _STOPWORDS]
    return " ".join(toks).strip()


def _safety_reframe(title: str) -> tuple[str, str | None]:
    """Body-composition SAFETY framing (P0). A single-digit body-fat target (≤8%) is not a safe maintenance
    range for most people, so we never render an unqualified "reduce body fat to 5%" as a goal. We reframe the
    DISPLAY title to a safe recomposition goal and attach a safety_note — without generating any aggressive-cut
    advice. The user's verbatim goal is untouched in the DB (this is display-time framing only). Returns
    (display_title, safety_note | None)."""
    low = (title or "").lower()
    if "body fat" in low or "bodyfat" in low or "body-fat" in low or "% body" in low:
        nums = [int(n) for n in re.findall(r"(\d{1,2})\s*%", low)]
        if any(n <= 8 for n in nums):
            return (
                "Recompose body safely for long-term health",
                "Your stated single-digit body-fat target needs a safety review/refinement — sub-8% body fat "
                "is not a safe maintenance range for most people. Aim for a sustainable recomposition target.",
            )
    return (title, None)


def _cluster_key(title: str) -> str | None:
    n = (title or "").lower()
    for key, kws in _CLUSTER_KEYWORDS:
        if any(kw in n for kw in kws):
            return key
    return None


class CanonicalGoalsService:
    def __init__(self, life: Any, supabase: Any) -> None:
        self._life = life
        self._sb = supabase

    async def canonical_goals(self, ctx: UserContext) -> list[dict[str, Any]]:
        snap = await self._life.snapshot(ctx)
        entries: list[dict[str, Any]] = []

        # 1) life.life_objectives (via snapshot.objectives — carries confirmed/origin/confidence).
        for o in snap.get("objectives", []) or []:
            confirmed = bool(o.get("confirmed", True)) and (o.get("origin") != "persona_bridge")
            persona = o.get("origin") == "persona_bridge"
            entries.append(self._entry(
                title=o.get("surface_goal") or o.get("title"), domain=self._domain(o.get("themes"), o.get("root")),
                store="life.life_objectives", source_id=o.get("id"),
                priority="persona" if persona else ("objective_confirmed" if confirmed else "objective_candidate"),
                confirmation="candidate" if (persona or not confirmed) else "confirmed",
                confidence=o.get("confidence"), related_objective=o.get("title"), why_chain=o.get("why_chain")))

        # 2) life.goals (objective-linked nodes).
        try:
            for g in await self._rows("goals", ctx, LIFE):
                entries.append(self._entry(
                    title=g.get("title"), domain=g.get("domain"), store="life.goals", source_id=g.get("id"),
                    priority="life_goal_confirmed" if g.get("status") == "confirmed" else "life_goal",
                    confirmation="confirmed" if g.get("status") == "confirmed" else "candidate",
                    timeframe=g.get("target_date"), related_objective=g.get("objective_id")))
        except Exception:  # noqa: BLE001
            pass

        # 3) public.goals (user CRUD + the ONLY store with quantitative progress).
        try:
            for p in await self._rows("goals", ctx, "public"):
                persona = str(p.get("origin") or "").lower() in ("persona", "persona_bridge", "seed")
                entries.append(self._entry(
                    title=p.get("title"), domain=p.get("category") or p.get("domain"), store="public.goals",
                    source_id=p.get("id"), priority="persona" if persona else "public_goal",
                    confirmation="candidate" if persona else "confirmed",
                    status=p.get("status"), progress=p.get("progress_percent"),
                    timeframe=p.get("target_date") or p.get("timeframe")))
        except Exception:  # noqa: BLE001
            pass

        # 4) life.candidate_goals (discovery portfolio — the user's own words).
        for c in snap.get("goal_portfolio", []) or []:
            st = str(c.get("status") or "candidate")
            entries.append(self._entry(
                title=c.get("goal"), domain=c.get("domain"), store="life.candidate_goals", source_id=None,
                priority="candidate_confirmed" if st == "confirmed" else "candidate",
                confirmation="confirmed" if st == "confirmed" else "candidate",
                confidence=c.get("confidence")))

        merged = self._merge(entries)
        return self._rank(merged)

    # ---- helpers -------------------------------------------------------------
    async def _rows(self, table: str, ctx: UserContext, schema: str) -> list[dict[str, Any]]:
        return await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema=schema) or []

    @staticmethod
    def _domain(themes: Any, root: Any = None) -> str:
        if isinstance(themes, (list, tuple)) and themes:
            return str(themes[0])
        return str(root or "core")

    @staticmethod
    def _entry(*, title: str | None, domain: Any, store: str, source_id: Any, priority: str,
               confirmation: str, confidence: Any = None, status: Any = None, progress: Any = None,
               timeframe: Any = None, related_objective: Any = None, related_narrative: Any = None,
               why_chain: Any = None) -> dict[str, Any]:
        display, safety = _safety_reframe((title or "").strip())
        return {"title": display, "domain": str(domain or "core"), "store": store,
                "source_id": source_id, "priority": priority, "confirmation_status": confirmation,
                "confidence": confidence, "status": status, "progress": progress, "timeframe": timeframe,
                "related_objective": related_objective, "related_narrative": related_narrative,
                "why_chain": why_chain, "safety_note": safety}

    def _merge(self, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        groups: dict[str, list[dict[str, Any]]] = {}
        for e in entries:
            if not e["title"]:
                continue
            groups.setdefault(_norm(e["title"]), []).append(e)

        out: list[dict[str, Any]] = []
        for key, members in groups.items():
            members.sort(key=lambda m: _PRIORITY.get(m["priority"], 9))
            best = members[0]                       # most authoritative wins title/status/confirmation
            # progress only ever comes from a real public.goals value — never invented.
            progress = next((m["progress"] for m in members if m["progress"] is not None), None)
            timeframe = best["timeframe"] or next((m["timeframe"] for m in members if m["timeframe"]), None)
            confidence = next((m["confidence"] for m in members if m["confidence"] is not None), None)
            source_ids = [{"store": m["store"], "id": m["source_id"]} for m in members]
            out.append({
                "id": f"cg_{key.replace(' ', '_')[:60]}",   # stable, deterministic per user
                "title": best["title"], "domain": best["domain"], "status": best["status"] or "open",
                "confirmation_status": best["confirmation_status"], "confidence": confidence,
                "priority": best["priority"], "timeframe": timeframe, "progress": progress,
                "source_store": best["store"], "source_ids": source_ids,
                "related_narrative": best["related_narrative"],
                "related_objective": best["related_objective"], "why_chain": best["why_chain"],
                "cluster": _cluster_key(best["title"]),
                "dependencies": [], "risks": [],
                "provenance": {"merged_from": sorted({m["store"] for m in members}),
                               "is_duplicate_merge": len(source_ids) > 1},
            })
        return out

    @staticmethod
    def _rank(goals: list[dict[str, Any]]) -> list[dict[str, Any]]:
        order = {"confirmed": 0, "inferred": 1, "candidate": 2}
        return sorted(goals, key=lambda g: (order.get(g["confirmation_status"], 3),
                                            _PRIORITY.get(g["priority"], 9),
                                            -(g["confidence"] or 0)))
