"""Fact → Domain Sync (advisor/onboarding capture → existing domain profile tables).

The advisor captures broad facts to life.facts / life.candidate_goals (provenance + discovery record).
This service normalizes durable facts into the EXISTING domain profile tables that the dashboard already
reads — so a fact the user gave in chat shows up on their card, with ONE durable source of truth per domain.

Conflict rule (no shadow stores, never corrupt higher-confidence data):
  manual form data > integration data > confirmed chat data > inferred chat data.
  → chat sync FILLS MISSING fields only; it never overwrites a non-empty existing value. List fields
    (skills) are UNIONed. Provenance lives in life.facts; the domain row is the normalized current state.

Domains:
  career    → public.career_profiles (UNIQUE user_id) + career.career_goals (target_role)   [LIVE]
  education → education.education_profiles (highest_level + existing_credentials JSONB)        [LIVE]
  health    → BLOCKED: health.* is feature-locked (migration 038 is_health_enabled()=false; RLS denies writes)
  family    → DEFERRED: no family profile row table (public.family_members is a list of members)
  finance   → DEFERRED by policy: accounts/assets are canonical (Plaid/manual); chat must not write them
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Optional

from ..models.common import UserContext

log = logging.getLogger("core.fact_domain_sync")

_NS = uuid.UUID("6f1a2b3c-4d5e-6f70-8190-a2b3c4d5e6f7")


def _det_id(user_id: str, key: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{key}"))


def _result(domain: str, table: str, *, source: str, confidence: float) -> dict[str, Any]:
    return {"domain": domain, "table": table, "fields_updated": [], "fields_skipped": [],
            "needs_review": [], "confidence": confidence, "source": source, "errors": []}


# --------------------------------------------------------------------------- CAREER
_CAREER_SKILLS = (
    "Python", "C++", "C#", "JavaScript", "TypeScript", "Java", "Go", "Rust", "Kotlin", "Swift", "Scala",
    "SQL", "PyTorch", "TensorFlow", "JAX", "Keras", "scikit-learn", "Pandas", "NumPy", "Spark", "Hadoop",
    "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure", "React", "Node.js", "Django", "FastAPI",
    "CUDA", "Embedded", "Linux", "Verilog", "VHDL", "MATLAB", "R",
)
_ROLE_AT = re.compile(
    r"\bI(?:'m| am)\s+(?:an?\s+|the\s+)?([A-Za-z][A-Za-z /&.\-]{2,40}?)\s+(?:at|for|with)\s+"
    r"([A-Z][A-Za-z0-9 /&.,'\-]{2,50})")
_TARGET = re.compile(
    r"(?:promotion is|promoted to|next (?:role|title|position) is|become|aiming (?:for|to be)|"
    r"want to be(?:come)?|target(?:ing)?)\s+(?:an?\s+|the\s+)?([A-Z][A-Za-z /&.\-]{2,40})")


def extract_career_facts(message: str) -> dict[str, Any]:
    """Structured career facts from a free-text message. Returns only what matched (never fabricates)."""
    m = message or ""
    out: dict[str, Any] = {}
    rm = _ROLE_AT.search(m)
    if rm:
        role = rm.group(1).strip()
        # drop a leading article the non-greedy capture may keep; title-case a lowercased role
        role = re.sub(r"^(?:an?|the)\s+", "", role, flags=re.I).strip()
        if role and not role.isupper():
            role = role.title()
        company = re.split(r"\s+\b(?:working|on|in|where|doing|and|building|developing)\b|[,.]",
                           rm.group(2))[0].strip()
        if 2 < len(role) <= 40:
            out["current_role"] = role
        if 2 < len(company) <= 50:
            out["company"] = company
    tm = _TARGET.search(m)
    if tm:
        target = re.split(r"[,.]|\s+\b(?:that|which|would|will|so|because)\b", tm.group(1))[0].strip()
        if 2 < len(target) <= 40:
            out["target_role"] = target
    skills = [s for s in _CAREER_SKILLS
              if re.search(r"(?<![\w+#])" + re.escape(s) + r"(?![\w+#])", m, re.I)]
    if skills:
        out["skills"] = skills
    return out


async def sync_career(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                      source: str = "career_advisor_chat", confidence: float = 0.85) -> dict[str, Any]:
    """Upsert public.career_profiles (fill-missing) + career.career_goals (promotion target)."""
    res = _result("career", "public.career_profiles", source=source, confidence=confidence)
    try:
        existing = await sb.select("career_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="public", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}")
        existing = []
    cur = existing[0] if existing else {}
    # Start from the full existing row so the upsert carries ALL columns forward (merge), not just the changed
    # ones — correct under both PostgREST on-conflict merge and a replace-style test double.
    row: dict[str, Any] = dict(cur)
    row["user_id"] = ctx.user_id
    row["id"] = cur.get("id") or _det_id(ctx.user_id, "career_profiles")
    changed = False

    def fill(col: str, val: Any) -> None:
        nonlocal changed
        if not val:
            return
        ex = cur.get(col)
        if ex and str(ex).strip():  # manual/earlier value present → never clobber with chat
            res["fields_skipped"].append(col)
            return
        row[col] = val
        res["fields_updated"].append(col)
        changed = True

    fill("current_title", facts.get("current_role"))
    fill("current_company", facts.get("company"))
    if facts.get("skills"):  # list field → union, never clobber
        ex = list(cur.get("skills") or [])
        merged = list(dict.fromkeys([*ex, *facts["skills"]]))
        if merged != ex:
            row["skills"] = merged
            res["fields_updated"].append("skills")
            changed = True
    if changed:
        try:
            await sb.upsert("career_profiles", row, schema="public", on_conflict="user_id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    if facts.get("target_role"):
        try:
            await sb.upsert("career_goals", {
                "id": _det_id(ctx.user_id, "career_goal:promotion"),
                "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                "title": f"Advance to {facts['target_role']}", "goal_type": "promotion",
                "target_role": facts["target_role"], "status": "active",
                "metadata": {"source": source, "confidence": confidence},
            }, schema="career", on_conflict="id")
            res["fields_updated"].append("target_role")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"goal:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- EDUCATION
_CREDENTIAL = re.compile(
    r"\b(BS|BA|BSc|B\.S\.|B\.A\.|MS|MA|MSc|M\.S\.|M\.A\.|MBA|PhD|Ph\.D\.|associate'?s?|bachelor'?s?|"
    r"master'?s?|doctorate)\b(?:\s+(?:degree\s+)?(?:in|of)\s+([A-Z][A-Za-z &]{2,40}))?", re.I)
_SCHOOL = re.compile(r"\bfrom\s+([A-Z][A-Za-z0-9 .&'\-]{2,50})")


def extract_education_facts(message: str) -> dict[str, Any]:
    m = message or ""
    out: dict[str, Any] = {}
    cm = _CREDENTIAL.search(m)
    if cm:
        out["highest_level"] = cm.group(1).upper().replace(".", "")
        if cm.group(2):
            field = re.split(r"\s+\b(?:from|at|and|so|but)\b", cm.group(2))[0].strip().rstrip(".")
            if 2 < len(field) <= 40:
                out["field"] = field
    sm = _SCHOOL.search(m)
    if sm:
        out["school"] = re.split(r"[,.]|\s+\b(?:and|so|but)\b", sm.group(1))[0].strip()
    if re.search(r"\b(sufficient|deprioritiz|not a priority|good for now|done with school)\b", m, re.I):
        out["priority"] = "sufficient"
    return out


async def sync_education(sb: Any, ctx: UserContext, facts: dict[str, Any], *,
                         source: str = "education_advisor_chat", confidence: float = 0.85) -> dict[str, Any]:
    """Upsert education.education_profiles: highest_level + the credential into existing_credentials JSONB."""
    res = _result("education", "education.education_profiles", source=source, confidence=confidence)
    if not (facts.get("highest_level") or facts.get("school")):
        return res
    try:
        existing = await sb.select("education_profiles", filters={"user_id": f"eq.{ctx.user_id}"},
                                   schema="education", limit=1)
    except Exception as e:  # noqa: BLE001
        res["errors"].append(f"read:{str(e)[:100]}")
        existing = []
    cur = existing[0] if existing else {}
    row: dict[str, Any] = dict(cur)
    row["user_id"] = ctx.user_id
    row["tenant_id"] = cur.get("tenant_id") or ctx.user_id
    row["id"] = cur.get("id") or _det_id(ctx.user_id, "education_profile")
    creds = list(cur.get("existing_credentials") or [])
    cred = {k: facts[k] for k in ("highest_level", "field", "school") if facts.get(k)}
    sig = (cred.get("highest_level"), cred.get("school"))  # de-dupe by (level, school)
    changed = False
    if cred and sig not in {(c.get("highest_level"), c.get("school")) for c in creds}:
        creds.append({**cred, "source": source, "confidence": confidence})
        row["existing_credentials"] = creds
        res["fields_updated"].append("existing_credentials")
        changed = True
    # highest_level: fill-missing only (don't downgrade a manually-set level)
    if facts.get("highest_level") and not (cur.get("highest_level") or "").strip():
        row["highest_level"] = facts["highest_level"]
        res["fields_updated"].append("highest_level")
        changed = True
    if changed:
        row["source"], row["confidence"] = source, confidence
        try:
            await sb.upsert("education_profiles", row, schema="education", on_conflict="id")
        except Exception as e:  # noqa: BLE001
            res["errors"].append(f"profile:{str(e)[:100]}")
    return res


# --------------------------------------------------------------------------- orchestration
async def sync_from_message(sb: Any, ctx: UserContext, message: str, *,
                            domains: Optional[set[str]] = None,
                            source: str = "advisor_chat") -> list[dict[str, Any]]:
    """Run the domain extractors on a message and sync whatever is found. Fail-soft (never raises).

    `domains` optionally restricts which extractors run (e.g. {'career'} for a career-advisor turn).
    Health is intentionally skipped (feature-locked); family/finance are not synced from chat yet.
    """
    results: list[dict[str, Any]] = []
    try:
        if (domains is None or "career" in domains):
            cf = extract_career_facts(message)
            if cf:
                results.append(await sync_career(sb, ctx, cf, source=f"{source}:career"))
        if (domains is None or "education" in domains):
            ef = extract_education_facts(message)
            if ef:
                results.append(await sync_education(sb, ctx, ef, source=f"{source}:education"))
    except Exception as e:  # noqa: BLE001
        log.warning("fact_domain_sync failed: %s", str(e)[:160])
    for r in results:
        log.info("fact_domain_sync %s: updated=%s skipped=%s errors=%s",
                 r["domain"], r["fields_updated"], r["fields_skipped"], r["errors"])
    return results
