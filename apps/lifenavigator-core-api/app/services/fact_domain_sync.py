"""Fact → Domain Sync (advisor/onboarding capture → existing domain profile tables).

The advisor captures broad facts to life.facts / life.candidate_goals (provenance + discovery record). This
service NORMALIZES durable facts into the EXISTING domain tables the dashboard reads — one durable source of
truth per domain.

Extraction is LLM-based (NOT brittle regex): the model returns strict per-domain JSON, then deterministic
validation coerces/clamps it before any write. Fail-soft: if the LLM is unavailable or output is malformed,
NOTHING is written (we never push unvalidated free text into normalized records).

Conflict rule: manual > integration > confirmed-chat > inferred-chat. Chat sync FILLS MISSING fields only;
never overwrites a non-empty existing value; lists are UNIONed. Provenance stays in life.facts.

Domains: career → public.career_profiles + career.career_goals · education → education.education_profiles ·
health → health.health_profiles + health.body_metrics + health.health_goals (needs is_health_enabled()) ·
family → family.family_profiles (needs migration) · finance → finance.financial_planning_goals (planning
targets ONLY — NEVER accounts/assets/liabilities).
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any, Optional

from ..models.common import UserContext

log = logging.getLogger("core.fact_domain_sync")

_NS = uuid.UUID("6f1a2b3c-4d5e-6f70-8190-a2b3c4d5e6f7")
_MIN_CONFIDENCE = 0.55  # below this a domain is needs_review, not auto-synced


def _det_id(user_id: str, key: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{key}"))


def _result(domain: str, table: str, *, source: str, confidence: float) -> dict[str, Any]:
    return {"domain": domain, "table": table, "fields_updated": [], "fields_skipped": [],
            "needs_review": [], "confidence": confidence, "source": source, "errors": []}


def _num(v: Any) -> Optional[float]:
    try:
        if v is None or isinstance(v, bool):
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _str(v: Any, cap: int = 80) -> Optional[str]:
    if not isinstance(v, str):
        return None
    s = v.strip()
    return s[:cap] or None


def _strlist(v: Any, cap: int = 12) -> list[str]:
    if not isinstance(v, list):
        return []
    return [s.strip()[:60] for s in v if isinstance(s, str) and s.strip()][:cap]


# --------------------------------------------------------------------------- LLM extraction
_EXTRACT_SYSTEM = (
    "You extract DURABLE life facts from a user's message into strict JSON for LifeNavigator. Return ONLY a "
    "JSON object with these optional domain keys; OMIT a domain entirely if the message has no durable fact "
    "for it. NEVER invent facts. Shape:\n"
    '{"career":{"current_role":str,"company":str,"focus":str,"skills":[str],"target_role":str,'
    '"confidence":0.0,"should_sync":true},'
    '"education":{"highest_level":str,"field":str,"school":str,"priority":"sufficient|active",'
    '"confidence":0.0,"should_sync":true},'
    '"health":{"height_in":num,"weight_lbs":num,"body_fat_pct":num,"goal_type":str,"goal_detail":str,'
    '"cardio_goal":str,"safety_constraint":str,"training_status":str,"confidence":0.0,"should_sync":true},'
    '"family":{"relationship_status":str,"wedding_timeline":str,"home_goal":bool,"children_goal":bool,'
    '"family_goals":[str],"planning_priorities":[str],"confidence":0.0,"should_sync":true},'
    '"finance_planning":{"priority":str,"home_price_min":num,"home_price_max":num,'
    '"targets":[{"goal_type":str,"label":str,"amount":num}],"linked_domains":[str],"confidence":0.0,'
    '"should_sync":true}}\n'
    "RULES: confidence 0-1 (high for explicit facts like '6 ft', '210 lbs', 'BS in X from Y', 'Senior "
    "Architect at Z', 'getting married next June', '$500K-$750K home'; lower for inferred goals; set "
    "should_sync=false when ambiguous). height_in in inches, weight_lbs in pounds, body_fat_pct as a number. "
    "SAFETY: health may capture wellness/fitness facts but NEVER diagnoses, treatment, medication, or TRT/"
    "steroid protocols. finance_planning is PLANNING goals/targets ONLY — NEVER account balances/holdings. "
    "family is planning goals, not legal conclusions. JSON only, no prose, no markdown."
)


def _parse_json(raw: str) -> Optional[dict[str, Any]]:
    s = (raw or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", s).strip()
    i, j = s.find("{"), s.rfind("}")
    if i == -1 or j == -1 or j < i:
        return None
    try:
        d = json.loads(s[i:j + 1])
        return d if isinstance(d, dict) else None
    except Exception:  # noqa: BLE001
        return None


async def extract_domain_facts(gemini: Any, message: str) -> Optional[dict[str, Any]]:
    """LLM structured extraction → validated per-domain facts. None on no-LLM / failure / malformed (fail-soft)."""
    g = gemini
    text = (message or "").strip()
    if not g or not getattr(g, "configured", False) or len(text.split()) < 3:
        return None
    user = f'User message:\n"""{text[:1500]}"""\n\nReturn the JSON now.'
    try:
        raw = await g.generate(_EXTRACT_SYSTEM, user, temperature=0.1)
    except Exception:  # noqa: BLE001
        return None
    data = _parse_json(raw)
    if not data:
        return None
    out: dict[str, dict[str, Any]] = {}
    # CAREER
    c = data.get("career") or {}
    if isinstance(c, dict) and c.get("should_sync") is not False:
        cf = {"current_role": _str(c.get("current_role")), "company": _str(c.get("company")),
              "focus": _str(c.get("focus")), "skills": _strlist(c.get("skills")),
              "target_role": _str(c.get("target_role")),
              "confidence": _num(c.get("confidence")) or 0.6}
        if any([cf["current_role"], cf["company"], cf["target_role"], cf["skills"]]):
            out["career"] = cf
    # EDUCATION
    e = data.get("education") or {}
    if isinstance(e, dict) and e.get("should_sync") is not False:
        ef = {"highest_level": _str(e.get("highest_level"), 30), "field": _str(e.get("field")),
              "school": _str(e.get("school")), "priority": _str(e.get("priority"), 20),
              "confidence": _num(e.get("confidence")) or 0.6}
        if ef["highest_level"] or ef["school"]:
            out["education"] = ef
    # HEALTH (wellness only; clamp numbers to sane ranges)
    h = data.get("health") or {}
    if isinstance(h, dict) and h.get("should_sync") is not False:
        hin, wlb, bf = _num(h.get("height_in")), _num(h.get("weight_lbs")), _num(h.get("body_fat_pct"))
        hf = {"height_in": hin if hin and 36 <= hin <= 96 else None,
              "weight_lbs": wlb if wlb and 60 <= wlb <= 700 else None,
              "body_fat_pct": bf if bf and 2 <= bf <= 70 else None,
              "goal_type": _str(h.get("goal_type")), "goal_detail": _str(h.get("goal_detail"), 240),
              "cardio_goal": _str(h.get("cardio_goal"), 120), "safety_constraint": _str(h.get("safety_constraint"), 160),
              "training_status": _str(h.get("training_status"), 120),
              "confidence": _num(h.get("confidence")) or 0.6}
        if any([hf["height_in"], hf["weight_lbs"], hf["body_fat_pct"], hf["goal_type"]]):
            out["health"] = hf
    # FAMILY
    f = data.get("family") or {}
    if isinstance(f, dict) and f.get("should_sync") is not False:
        ff = {"relationship_status": _str(f.get("relationship_status"), 30),
              "wedding_timeline": _str(f.get("wedding_timeline"), 60),
              "home_goal": bool(f.get("home_goal")), "children_goal": bool(f.get("children_goal")),
              "family_goals": _strlist(f.get("family_goals")),
              "planning_priorities": _strlist(f.get("planning_priorities")),
              "confidence": _num(f.get("confidence")) or 0.6}
        if any([ff["relationship_status"], ff["wedding_timeline"], ff["home_goal"], ff["children_goal"],
                ff["family_goals"]]):
            out["family"] = ff
    # FINANCE PLANNING (targets only)
    fp = data.get("finance_planning") or {}
    if isinstance(fp, dict) and fp.get("should_sync") is not False:
        lo, hi = _num(fp.get("home_price_min")), _num(fp.get("home_price_max"))
        targets = []
        for t in (fp.get("targets") or []):
            if isinstance(t, dict) and _str(t.get("goal_type"), 40):
                targets.append({"goal_type": _str(t.get("goal_type"), 40),
                                "label": _str(t.get("label"), 80), "amount": _num(t.get("amount"))})
        pf = {"priority": _str(fp.get("priority")), "home_price_min": lo, "home_price_max": hi,
              "targets": targets[:10], "linked_domains": _strlist(fp.get("linked_domains"), 6),
              "confidence": _num(fp.get("confidence")) or 0.6}
        if any([pf["priority"], lo, hi, targets]):
            out["finance_planning"] = pf
    return out or None


# --------------------------------------------------------------------------- CAREER
async def sync_career(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                      source: str = "advisor_chat:career") -> dict[str, Any]:
    confidence = float(facts.get("confidence") or 0.85)
    res = _result("career", "public.career_profiles", source=source, confidence=confidence)
    if confidence < _MIN_CONFIDENCE:
        res["needs_review"].append("low_confidence")
        return res
    try:
        existing = await sb.select("career_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="public", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}"); existing = []
    cur = existing[0] if existing else {}
    row: dict[str, Any] = dict(cur)
    row["user_id"] = ctx.user_id
    row["id"] = cur.get("id") or _det_id(ctx.user_id, "career_profiles")
    changed = False

    def fill(col: str, val: Any) -> None:
        nonlocal changed
        if not val:
            return
        if cur.get(col) and str(cur.get(col)).strip():
            res["fields_skipped"].append(col); return
        row[col] = val; res["fields_updated"].append(col); changed = True

    fill("current_title", facts.get("current_role"))
    fill("current_company", facts.get("company"))
    if facts.get("skills"):
        ex = list(cur.get("skills") or [])
        merged = list(dict.fromkeys([*ex, *facts["skills"]]))
        if merged != ex:
            row["skills"] = merged; res["fields_updated"].append("skills"); changed = True
    if facts.get("focus") and not (cur.get("summary") or "").strip():
        row["summary"] = f"Focus: {facts['focus']}"; res["fields_updated"].append("focus"); changed = True
    if changed:
        try:
            await sb.upsert("career_profiles", row, schema="public", on_conflict="user_id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    if facts.get("target_role"):
        try:
            await sb.upsert("career_goals", {
                "id": _det_id(ctx.user_id, "career_goal:promotion"), "user_id": ctx.user_id,
                "tenant_id": ctx.user_id, "title": f"Advance to {facts['target_role']}",
                "goal_type": "promotion", "target_role": facts["target_role"], "status": "active",
                "metadata": {"source": source, "confidence": confidence}}, schema="career", on_conflict="id")
            res["fields_updated"].append("target_role")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"goal:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- EDUCATION
async def sync_education(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                         source: str = "advisor_chat:education") -> dict[str, Any]:
    confidence = float(facts.get("confidence") or 0.85)
    res = _result("education", "education.education_profiles", source=source, confidence=confidence)
    if not (facts.get("highest_level") or facts.get("school")) or confidence < _MIN_CONFIDENCE:
        return res
    try:
        existing = await sb.select("education_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="education", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}"); existing = []
    cur = existing[0] if existing else {}
    row: dict[str, Any] = dict(cur)
    row.update({"user_id": ctx.user_id, "tenant_id": cur.get("tenant_id") or ctx.user_id,
                "id": cur.get("id") or _det_id(ctx.user_id, "education_profile")})
    creds = list(cur.get("existing_credentials") or [])
    cred = {k: facts[k] for k in ("highest_level", "field", "school") if facts.get(k)}
    sig = (cred.get("highest_level"), cred.get("school"))
    changed = False
    if cred and sig not in {(c.get("highest_level"), c.get("school")) for c in creds}:
        creds.append({**cred, "source": source, "confidence": confidence})
        row["existing_credentials"] = creds; res["fields_updated"].append("existing_credentials"); changed = True
    if facts.get("highest_level") and not (cur.get("highest_level") or "").strip():
        row["highest_level"] = facts["highest_level"]; res["fields_updated"].append("highest_level"); changed = True
    if changed:
        row["source"], row["confidence"] = source, confidence
        try:
            await sb.upsert("education_profiles", row, schema="education", on_conflict="id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- HEALTH (needs is_health_enabled())
async def sync_health(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                      source: str = "advisor_chat:health") -> dict[str, Any]:
    confidence = float(facts.get("confidence") or 0.85)
    res = _result("health", "health.health_profiles", source=source, confidence=confidence)
    if confidence < _MIN_CONFIDENCE:
        res["needs_review"].append("low_confidence"); return res
    height_cm = round(facts["height_in"] * 2.54, 1) if facts.get("height_in") else None
    weight_lbs, bf = facts.get("weight_lbs"), facts.get("body_fat_pct")
    weight_kg = round(weight_lbs * 0.453592, 2) if weight_lbs else None
    # PROFILE (real cols: height_cm, baseline_notes; no unique(user_id) → deterministic id) — fill-missing
    try:
        existing = await sb.select("health_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="health", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}"); existing = []
    cur = existing[0] if existing else {}
    row: dict[str, Any] = dict(cur)
    row.update({"user_id": ctx.user_id, "id": cur.get("id") or _det_id(ctx.user_id, "health_profile")})
    changed = False
    if height_cm and not cur.get("height_cm"):
        row["height_cm"] = height_cm; res["fields_updated"].append("height_cm"); changed = True
    note_bits = [b for b in (facts.get("goal_detail"), facts.get("safety_constraint"),
                             facts.get("training_status")) if b]
    if note_bits and not (cur.get("baseline_notes") or "").strip():
        row["baseline_notes"] = " · ".join(note_bits)[:400]; res["fields_updated"].append("baseline_notes"); changed = True
    if changed:
        try:
            await sb.upsert("health_profiles", row, schema="health", on_conflict="id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    # BODY METRICS (real cols: weight_kg, body_fat_pct, waist_cm; fat/lean mass derived at render time)
    if weight_kg or bf:
        metric = {"id": _det_id(ctx.user_id, "body_metric:latest"), "user_id": ctx.user_id}
        if weight_kg:
            metric["weight_kg"] = weight_kg
        if bf:
            metric["body_fat_pct"] = bf
        try:
            await sb.upsert("body_metrics", metric, schema="health", on_conflict="id")
            res["fields_updated"] += [k for k in ("weight_kg", "body_fat_pct") if k in metric]
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"metric:{str(e)[:100]}")
    # GOAL (recomposition / cardio)
    if facts.get("goal_type"):
        try:
            await sb.upsert("health_goals", {
                "id": _det_id(ctx.user_id, "health_goal:primary"), "user_id": ctx.user_id,
                "title": facts.get("goal_detail") or facts["goal_type"], "goal_type": facts["goal_type"],
                "status": "active"}, schema="health", on_conflict="id")
            res["fields_updated"].append("goal_type")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"goal:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- FAMILY (needs family.family_profiles)
async def sync_family(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                      source: str = "advisor_chat:family") -> dict[str, Any]:
    confidence = float(facts.get("confidence") or 0.85)
    res = _result("family", "family.family_profiles", source=source, confidence=confidence)
    if confidence < _MIN_CONFIDENCE:
        res["needs_review"].append("low_confidence"); return res
    try:
        existing = await sb.select("family_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="family", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}"); existing = []
    cur = existing[0] if existing else {}
    # The deployed table has columns: id, user_id, marital_status, household_size, num_dependents, metadata.
    # Write the relationship to marital_status (real column); keep the planning facts (wedding_timeline,
    # home_goal, children_goal, family_goals, planning_priorities) in the metadata JSONB — NO migration needed.
    meta: dict[str, Any] = dict(cur.get("metadata") or {})
    row: dict[str, Any] = {"user_id": ctx.user_id,
                           "id": cur.get("id") or _det_id(ctx.user_id, "family_profile")}
    changed = False
    rel = facts.get("relationship_status")
    if rel and not str(cur.get("marital_status") or "").strip():
        row["marital_status"] = rel; res["fields_updated"].append("marital_status"); changed = True
    if facts.get("wedding_timeline") and not meta.get("wedding_timeline"):
        meta["wedding_timeline"] = _str(facts.get("wedding_timeline"), 60)
        res["fields_updated"].append("wedding_timeline"); changed = True
    for key in ("home_goal", "children_goal"):
        if facts.get(key) and not meta.get(key):
            meta[key] = True; res["fields_updated"].append(key); changed = True
    for key in ("family_goals", "planning_priorities"):
        if facts.get(key):
            ex = list(meta.get(key) or [])
            merged = list(dict.fromkeys([*ex, *facts[key]]))
            if merged != ex:
                meta[key] = merged; res["fields_updated"].append(key); changed = True
    if changed:
        meta["source"] = source; meta["confidence"] = confidence
        row["metadata"] = meta
        try:  # on_conflict=id (PK → always unique); deterministic id reuses the existing row.
            await sb.upsert("family_profiles", row, schema="family", on_conflict="id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- FINANCE PLANNING (targets ONLY)
async def sync_finance_planning(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                                source: str = "advisor_chat:finance") -> dict[str, Any]:
    """Planning goals/targets ONLY — NEVER accounts/assets/liabilities/holdings/balances."""
    confidence = float(facts.get("confidence") or 0.85)
    res = _result("finance", "finance.financial_planning_goals", source=source, confidence=confidence)
    if confidence < _MIN_CONFIDENCE:
        res["needs_review"].append("low_confidence"); return res
    goals: list[dict[str, Any]] = []
    linked = facts.get("linked_domains") or []
    if facts.get("priority"):
        goals.append({"goal_type": "financial_foundation", "label": facts["priority"], "priority": "primary"})
    if facts.get("home_price_min") or facts.get("home_price_max"):
        goals.append({"goal_type": "home_price_range", "label": "First home price range",
                      "amount_min": facts.get("home_price_min"), "amount_max": facts.get("home_price_max")})
    for t in (facts.get("targets") or []):
        goals.append({"goal_type": t.get("goal_type"), "label": t.get("label"), "target_amount": t.get("amount")})
    for g in goals:
        gid = _det_id(ctx.user_id, f"finplan:{g['goal_type']}")
        row = {"id": gid, "user_id": ctx.user_id, "status": "active", "source": source,
               "confidence": confidence, "linked_domains": linked, **g}
        try:
            await sb.upsert("financial_planning_goals", row, schema="finance", on_conflict="id")
            res["fields_updated"].append(g["goal_type"])
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"{g.get('goal_type')}:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- orchestration
_SYNCERS = {"career": sync_career, "education": sync_education, "health": sync_health,
            "family": sync_family, "finance_planning": sync_finance_planning}
_DOMAIN_ALIAS = {"finance": "finance_planning"}


async def sync_from_message(sb: Any, gemini: Any, ctx: UserContext, message: str, *,
                            domains: Optional[set[str]] = None,
                            source: str = "advisor_chat") -> list[dict[str, Any]]:
    """LLM-extract durable facts from a message and sync each domain. Fail-soft (never raises).

    `domains` optionally restricts which domains sync (scoped to the answering agent). When None, all extracted
    domains sync. Provenance stays in life.facts; this writes the normalized current state.
    """
    results: list[dict[str, Any]] = []
    try:
        facts = await extract_domain_facts(gemini, message)
        if not facts:
            return results
        allow = None
        if domains:
            allow = {_DOMAIN_ALIAS.get(d, d) for d in domains} | set(domains)
        for dom_key, dom_facts in facts.items():
            if allow is not None and dom_key not in allow:
                continue
            syncer = _SYNCERS.get(dom_key)
            if syncer:
                results.append(await syncer(sb, ctx, dom_facts, source=f"{source}:{dom_key}"))
    except Exception as e:  # noqa: BLE001
        log.warning("fact_domain_sync failed: %s", str(e)[:160])
    for r in results:
        log.info("fact_domain_sync %s: updated=%s skipped=%s needs_review=%s errors=%s",
                 r["domain"], r["fields_updated"], r["fields_skipped"], r["needs_review"], r["errors"])
    return results
