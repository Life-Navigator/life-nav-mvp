"""Discovery Coverage (Elite Sprint 47).

Every domain understands its own completeness: started / partial / complete, a coverage %, the
missing inputs, and what completing it unlocks. This is the canonical source for the domain cards
(never "No Data") and the "My Discovery" page. It composes existing signals — advisor answers
(life_vision.prompts), canonical objectives, and the financial resolver's missing inputs — into one
per-domain view. No new intelligence.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from ..models.common import UserContext
from .domain_summary import missing_for

# Degree labeling — never "doctorate in Juris Doctorate"; JD/MBA/MD get their proper names, others "BS in X".
_DEGREE_ORDER = {"high_school": 1, "certificate": 1, "bootcamp": 1, "associate": 2, "bachelor": 3,
                 "master": 4, "mba": 4, "jd": 5, "juris": 5, "doctorate": 5, "phd": 5, "md": 5}


def _degree_label(degree_type: Any, field: Any) -> str:
    dt = str(degree_type or "").strip().lower()
    fl = str(field or "").strip()
    blob = f"{dt} {fl}".lower()
    if "juris" in blob or dt == "jd":
        return "Juris Doctor (JD)"
    if "mba" in blob:
        return "MBA"
    if dt == "md" or "doctor of medicine" in blob:
        return "MD"
    abbr = {"bachelor": "BS", "associate": "Associate's", "master": "MS", "doctorate": "PhD", "phd": "PhD",
            "high_school": "High school diploma", "certificate": "Certificate", "bootcamp": "Bootcamp"}
    base = abbr.get(dt, dt.title() if dt else "Degree")
    if base in ("High school diploma", "Certificate", "Bootcamp") or not fl:
        return base
    return f"{base} in {fl}"


def _degree_rank(degree_type: Any) -> int:
    dt = str(degree_type or "").strip().lower()
    return next((v for kw, v in _DEGREE_ORDER.items() if kw in dt), 0)


def _parse_date(s: Any) -> Any:
    try:
        return date.fromisoformat(str(s)[:10]) if s else None
    except Exception:  # noqa: BLE001
        return None


def _is_planned(r: dict[str, Any]) -> bool:
    """A future/in-progress education record (e.g. a JD starting Aug 2026) — NOT a completed credential."""
    status = str(r.get("status") or "").strip().lower()
    if status == "completed":
        return False
    if status in ("in_progress", "planned", "enrolled"):
        return True
    today = date.today()
    return any((_parse_date(r.get(k)) or today) > today for k in ("start_date", "graduation_date", "end_date")
               if r.get(k))

# Each domain: the advisor question(s) that cover it, keyword match for a canonical objective, and
# what completing discovery unlocks. Education has no advisor question yet (honest: coverage caps).
# `baseline_missing`: what's still needed when the user HAS named a goal in the domain (baseline detail, NOT
# "a goal"). `goal_missing`: the label when the user has NOT named any goal in the domain yet.
DOMAINS: dict[str, dict[str, Any]] = {
    "finance": {"label": "Financial", "advisor_keys": ["financial_goal", "risk", "time_horizon"],
                "objective_kw": ["financ", "retire", "wealth", "debt", "saving", "invest"],
                "baseline_missing": ["financial readiness target", "savings/debt priorities"],
                "goal_missing": "financial goal",
                "unlocks": ["Retirement projection", "Readiness scoring", "Scenario planning"]},
    "career": {"label": "Career", "advisor_keys": ["career_goal"],
               "objective_kw": ["career", "job", "professional", "promotion"],
               "baseline_missing": ["current role", "target promotion", "timeline"],
               "goal_missing": "career goal",
               "unlocks": ["Career readiness", "Compensation analysis", "Offer comparison"]},
    "family": {"label": "Family", "advisor_keys": ["family_goal"],
               "objective_kw": ["family", "child", "parent", "spouse", "home", "housing"],
               "baseline_missing": ["wedding timeline", "house timeline", "family timeline"],
               "goal_missing": "family goal",
               "unlocks": ["Protection planning", "Housing affordability", "Survivor planning"]},
    "health": {"label": "Health", "advisor_keys": ["health_goal"],
               "objective_kw": ["health", "wellness", "fitness", "longevity"],
               "baseline_missing": ["current fitness baseline", "target definition", "training routine"],
               "goal_missing": "health goal",
               "unlocks": ["Health readiness", "Wellness recommendations", "Longevity planning"]},
    "education": {"label": "Education", "advisor_keys": [],
                  "objective_kw": ["education", "degree", "school", "college", "study", "learn"],
                  "baseline_missing": ["program/skill target"], "goal_missing": "education interest",
                  "unlocks": ["Degree ROI", "Education funding", "Skill planning"]},
}


# Authoritative domain RECORD tables. If the user already has REAL records here, the dashboard card must
# NEVER say "not started" / "0%" — the platform knows something, so the card cannot pretend it knows nothing.
# (table, schema), counted fail-soft. Service-role reads bypass RLS (incl. the health feature gate).
_RECORD_SOURCES: dict[str, list[tuple[str, str]]] = {
    "finance": [("financial_accounts", "finance"), ("assets", "finance")],
    "career": [("career_profiles", "public"), ("career_goals", "career")],
    "education": [("education_records", "public"), ("certifications", "education"), ("programs", "education")],
    "health": [("health_profiles", "health"), ("body_metrics", "health")],
    "family": [("family_profiles", "family"), ("family_members", "family"), ("family_members", "public")],
}


class DiscoveryCoverageService:
    def __init__(self, life: Any, supabase: Any, resolver: Any = None) -> None:
        self._life = life
        self._sb = supabase
        self._resolver = resolver

    async def _has_records(self, ctx: UserContext, key: str) -> bool:
        """True if the user has any REAL record in this domain's authoritative tables (fail-soft)."""
        for table, schema in _RECORD_SOURCES.get(key, []):
            try:
                rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"},
                                             limit=1, schema=schema)
                if rows:
                    return True
            except Exception:  # noqa: BLE001 — missing table / RLS / locked domain → just skip
                continue
        return False

    async def _one(self, table: str, schema: str, ctx: UserContext, order: str = "updated_at.desc") -> dict:
        try:
            rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"},
                                         limit=1, order=order, schema=schema)
            return rows[0] if rows else {}
        except Exception:  # noqa: BLE001
            return {}

    async def _count(self, table: str, schema: str, ctx: UserContext) -> int:
        try:
            rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=schema)
            return len(rows or [])
        except Exception:  # noqa: BLE001
            return 0

    async def _domain_facts(self, ctx: UserContext, key: str) -> dict[str, Any]:
        """Concrete KNOWN values per domain (the dashboard card's primary content — like Financial Overview).
        Read from the durable domain tables, fail-soft. Human-shaped (no snake_case leaking to the UI)."""
        f: dict[str, Any] = {}
        if key == "career":
            p = await self._one("career_profiles", "public", ctx)
            g = await self._one("career_goals", "career", ctx)
            if p.get("current_title"):
                f["Current role"] = p["current_title"]
            if p.get("current_company"):
                f["Company"] = p["current_company"]
            if p.get("skills"):
                f["Skills"] = ", ".join(p["skills"][:6])
            if (p.get("summary") or "").startswith("Focus:"):
                f["Focus"] = p["summary"][6:].strip()
            if g.get("target_role"):
                f["Target role"] = g["target_role"]
        elif key == "health":
            p = await self._one("health_profiles", "health", ctx, order="created_at.desc")
            m = await self._one("body_metrics", "health", ctx, order="created_at.desc")
            g = await self._one("health_goals", "health", ctx)
            if p.get("height_cm"):
                cm = float(p["height_cm"]); ft = int(cm / 30.48); inch = round((cm / 2.54) - ft * 12)
                f["Height"] = f"{ft}'{inch}\""
            wkg, bf = m.get("weight_kg"), m.get("body_fat_pct")
            if wkg:
                lbs = round(float(wkg) / 0.453592)
                f["Weight"] = f"{lbs} lbs"
                if bf:
                    fat = round(lbs * float(bf) / 100, 1)
                    f["Body fat"] = f"{float(bf):g}%"
                    f["Fat mass"] = f"~{fat:g} lbs"
                    f["Lean mass"] = f"~{round(lbs - fat, 1):g} lbs"
            elif bf:
                f["Body fat"] = f"{float(bf):g}%"
            if g.get("goal_type"):
                f["Goal"] = (g.get("title") or g["goal_type"])
        elif key == "education":
            certs = await self._count("certifications", "education", ctx)
            prof = await self._one("education_profiles", "education", ctx)
            try:
                rows = await self._sb.select("education_records", filters={"user_id": f"eq.{ctx.user_id}"},
                                             limit=20, schema="public") or []
            except Exception:  # noqa: BLE001
                rows = []
            # credential can also live in education_profiles.existing_credentials (advisor sync)
            for c in (prof.get("existing_credentials") or []):
                rows.append({"degree_type": c.get("highest_level"), "field_of_study": c.get("field"),
                             "institution_name": c.get("school"), "status": "completed"})
            completed, planned = [], []
            for r in rows:
                lbl = _degree_label(r.get("degree_type"), r.get("field_of_study"))
                school = r.get("institution_name")
                disp = f"{lbl}, {school}" if school else lbl
                (planned if _is_planned(r) else completed).append((_degree_rank(r.get("degree_type")), disp))
            if completed:
                f["Highest completed"] = max(completed, key=lambda x: x[0])[1]
            if planned:  # JD/MBA-in-progress shown SEPARATELY, never as highest completed
                f["Planned / in progress"] = planned[0][1]
            if rows:
                f["Records"] = f"{len(rows)} {'degree' if len(rows) == 1 else 'degrees'}"
            if certs:
                f["Certificates"] = certs
        elif key == "family":
            # The deployed family.family_profiles uses marital_status + a metadata JSONB (the planning facts
            # — wedding_timeline/home_goal/children_goal/family_goals — live in metadata, not as columns).
            p = await self._one("family_profiles", "family", ctx)
            meta = p.get("metadata") or {}
            status = p.get("marital_status") or p.get("relationship_status") or meta.get("relationship_status")
            if status:
                f["Status"] = status
            wedding = meta.get("wedding_timeline") or p.get("wedding_timeline")
            if wedding:
                f["Wedding"] = wedding
            goals = list(meta.get("family_goals") or p.get("family_goals") or [])
            if not goals:
                goals = [g for g, on in (("Buy a first home", meta.get("home_goal") or p.get("home_goal")),
                                         ("Start a family", meta.get("children_goal") or p.get("children_goal")))
                         if on]
            if goals:
                f["Goals"] = ", ".join(goals[:4])
        elif key == "finance":
            rows = []
            try:
                rows = await self._sb.select("financial_planning_goals", filters={"user_id": f"eq.{ctx.user_id}"},
                                             limit=20, schema="finance")
            except Exception:  # noqa: BLE001
                rows = []
            for r in rows or []:
                if r.get("goal_type") == "financial_foundation":
                    f["Primary priority"] = r.get("label") or "Financial foundation"
                elif r.get("goal_type") == "home_price_range":
                    lo, hi = r.get("amount_min"), r.get("amount_max")
                    if lo or hi:
                        f["Home range"] = f"${int(lo or 0) // 1000}K–${int(hi or 0) // 1000}K"
        return f

    async def coverage(self, ctx: UserContext) -> dict[str, Any]:
        vis = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="life")
        prompts0 = (vis[0].get("prompts") or {}) if vis else {}
        answered = set(prompts0.get("discovery_answered") or [])
        deprioritized = {str(d).lower() for d in (prompts0.get("deprioritized_domains") or [])}
        objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="life")
        obj_text = [f"{o.get('root_objective_key', '')} {o.get('title', '')}".lower() for o in objs]
        # P0.3: persisted candidate goals carry an explicit domain — a domain the user spoke to is never 0%.
        try:
            cands = await self._sb.select("candidate_goals", filters={"user_id": f"eq.{ctx.user_id}"},
                                          limit=50, schema="life")
        except Exception:  # noqa: BLE001
            cands = []
        goal_domains = {str(c.get("domain") or "").lower() for c in cands}
        fin_missing: list[dict[str, Any]] = []
        if self._resolver is not None:
            try:
                fin_missing = (await self._resolver.resolve(ctx)).get("missing") or []
            except Exception:  # noqa: BLE001
                pass

        domains = []
        for key, spec in DOMAINS.items():
            answered_here = [k for k in spec["advisor_keys"] if k in answered]
            # P0.3: an explicit candidate goal tagged to this domain means the user spoke to it.
            has_goal = key in goal_domains
            has_objective = any(any(kw in t for kw in spec["objective_kw"]) for t in obj_text)
            # coverage signals: each answered advisor question + an objective + (finance) resolved inputs
            total_signals = max(1, len(spec["advisor_keys"]) + 1)  # +1 for "has an objective"
            got = len(answered_here) + (1 if has_objective else 0)
            coverage_pct = round(100 * got / total_signals)
            if not spec["advisor_keys"] and not has_objective and not has_goal:
                coverage_pct = 0  # no path to cover this domain yet (e.g. education with no stated goal)
            # READ-PATH FIX: the dashboard card and the domain page must agree. If the domain has REAL records
            # (degrees, a career profile, accounts, …) the card is never "not started", even with no discovery
            # goal/objective. "If the platform knows something, the card cannot pretend it knows nothing."
            has_records = await self._has_records(ctx, key)
            has_data = has_goal or has_records
            # P0.3: any real data floors coverage at "started" — a domain we know something about is never 0%.
            if has_data:
                coverage_pct = max(coverage_pct, 30)
            is_deprioritized = key in deprioritized
            facts = await self._domain_facts(ctx, key) if has_data else {}
            # MISSING labels (P3): say what's actually missing — never "X goal" once we already know the domain.
            if is_deprioritized:
                missing_inputs = []  # the user explicitly set this aside (e.g. education: degree complete)
            elif facts and key in ("health", "education", "career", "family", "finance"):
                # SHARED CONTRACT: every domain derives SPECIFIC missing items from the known facts — never the
                # generic baseline list ("current role", "wedding timeline") once those facts are captured.
                # One truth for the dashboard card, onboarding review, readiness, and advisor.
                missing_inputs = missing_for(key, facts)
                if coverage_pct < 60:  # rich captured facts read as real progress, not a flat 30%
                    coverage_pct = min(85, 30 + 12 * len(facts))
            elif has_data:
                missing_inputs = list(spec.get("baseline_missing", [])) if coverage_pct < 80 else []
            else:
                # nothing known in this domain → name the missing goal (+ finance: resolved-input gaps)
                missing_inputs = [spec.get("goal_missing", f"{key} goal")]
                if key == "finance" and fin_missing:
                    missing_inputs += [m["input"] for m in fin_missing]
            status = ("deprioritized" if is_deprioritized else
                      "complete" if coverage_pct >= 80 else "partial" if coverage_pct >= 40
                      else "started" if coverage_pct > 0 else "not_started")
            domains.append({
                "domain": key, "label": spec["label"], "coverage_pct": coverage_pct, "status": status,
                "confidence_pct": min(95, coverage_pct) if coverage_pct else 0,
                "facts": facts,  # concrete KNOWN values — the card's primary content (like Financial Overview)
                "has_objective": has_objective or has_data,
                "missing": missing_inputs[:5], "unlocks": spec["unlocks"],
                # Scope the CTA to the DOMAIN advisor so "Continue health discovery" opens the Health
                # Advisor, not the generic Arcana orchestrator (CommandCenter reads ?agent=).
                "cta": (f"/dashboard/advisor?agent={key}_advisor" if (missing_inputs or coverage_pct < 80)
                        else None),
                "source": "Advisor Discovery",
            })

        overall = round(sum(d["coverage_pct"] for d in domains) / len(domains))
        return {
            "overall_coverage_pct": overall,
            "domains": domains,
            "recommendation_quality": _band(overall),
            "scenario_quality": _band(overall),
            "decision_brain_quality": _band(overall),
            "note": "Coverage is computed from advisor answers + canonical objectives + resolved inputs — no domain is ever just 'No Data'.",
        }


def _band(pct: int) -> str:
    return "High" if pct >= 70 else "Medium" if pct >= 40 else "Low"
