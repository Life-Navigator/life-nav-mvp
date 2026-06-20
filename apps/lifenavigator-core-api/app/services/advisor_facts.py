"""Advisor fact packet — deterministic, provenance-carrying grounding for the advisor.

Reads the user's REAL career + education rows (service-role client + explicit user_id,
RLS-equivalent scoping) and emits a flat list of facts. Each fact carries full
provenance (domain, source table, record id, confidence, timestamp) so the advisor can
cite every claim and the validator can verify it. This is FACTS ONLY — it does not
re-implement readiness scoring or the Life Brief composer (those live in the web tier);
counts and dated derivations are facts, not scores.

A fact without provenance never enters the packet (Phase 8C/8D).
"""
from __future__ import annotations

import re
from typing import Any

from app.models.common import UserContext

# Bounded so the advisor context stays small + cheap.
_MAX_PER_CATEGORY = 6

_DEGREE_LABEL = {
    "high_school": "High school diploma",
    "associate": "Associate's degree",
    "bachelor": "Bachelor's degree",
    "master": "Master's degree",
    "doctorate": "Doctorate",
    "certificate": "Certificate",
    "bootcamp": "Bootcamp",
}


def _fact(domain: str, label: str, value: str, source: str, table: str,
          record_id: Any, updated_at: Any, confidence: float) -> dict[str, Any]:
    return {
        "id": f"{table}:{record_id or label}",
        "domain": domain,
        "label": label,
        "value": value,
        "source": source,
        "sourceTable": table,
        "recordId": str(record_id) if record_id is not None else None,
        "confidence": round(confidence, 2),
        "updatedAt": str(updated_at) if updated_at else None,
    }


def _years_since(dates: list[str]) -> float | None:
    from datetime import datetime, timezone
    ts: list[float] = []
    for d in dates:
        try:
            ts.append(datetime.fromisoformat(str(d)[:10]).replace(tzinfo=timezone.utc).timestamp())
        except (ValueError, TypeError):
            continue
    if not ts:
        return None
    earliest = min(ts)
    now = datetime.now(timezone.utc).timestamp()
    return max(0.0, round((now - earliest) / (365.25 * 86400) * 10) / 10)


async def _rows(sb: Any, ctx: UserContext, schema: str, table: str, columns: str) -> list[dict[str, Any]]:
    try:
        return await sb.select(table, columns=columns, filters={"user_id": f"eq.{ctx.user_id}"},
                               limit=50, schema=schema) or []
    except Exception:  # noqa: BLE001 — grounding must never break a turn
        return []


async def build_fact_packet(sb: Any, ctx: UserContext) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []

    # ---- Career ----
    experience = await _rows(sb, ctx, "career", "experience_records",
                             "id,title,employer,industry,start_date,end_date,is_current,updated_at")
    current = next((e for e in experience if e.get("is_current")), None)
    if current and current.get("title"):
        emp = current.get("employer")
        facts.append(_fact("career", "Current role",
                           f"{current['title']}" + (f" @ {emp}" if emp else ""),
                           "Career experience", "career.experience_records",
                           current.get("id"), current.get("updated_at"), 0.95))
    prev = [e for e in experience if not e.get("is_current") and e.get("title")]
    for e in prev[:_MAX_PER_CATEGORY]:
        emp = e.get("employer")
        facts.append(_fact("career", "Past role",
                           f"{e['title']}" + (f" @ {emp}" if emp else ""),
                           "Career experience", "career.experience_records",
                           e.get("id"), e.get("updated_at"), 0.9))
    yrs = _years_since([e.get("start_date") for e in experience if e.get("start_date")])
    if yrs is not None:
        facts.append(_fact("career", "Years of experience", f"~{yrs} years",
                           "Career experience (earliest start date)", "career.experience_records",
                           None, None, 0.8))

    volunteer = await _rows(sb, ctx, "career", "volunteer_records", "id,organization,role,is_current,updated_at")
    for v in volunteer[:_MAX_PER_CATEGORY]:
        org = v.get("organization") or "organization"
        role = v.get("role")
        facts.append(_fact("career", "Volunteer role",
                           (f"{role} at {org}" if role else org), "Volunteer record",
                           "career.volunteer_records", v.get("id"), v.get("updated_at"), 0.9))

    projects = await _rows(sb, ctx, "career", "side_projects", "id,name,role,project_type,updated_at")
    for p in projects[:_MAX_PER_CATEGORY]:
        if p.get("name"):
            facts.append(_fact("career", "Side project", str(p["name"]), "Side project",
                               "career.side_projects", p.get("id"), p.get("updated_at"), 0.85))

    goals = await _rows(sb, ctx, "career", "career_goals", "id,title,target_role,target_date,status,updated_at")
    for g in [g for g in goals if (g.get("status") or "active") == "active"][:_MAX_PER_CATEGORY]:
        if g.get("title"):
            extra = []
            if g.get("target_role"):
                extra.append(f"target {g['target_role']}")
            if g.get("target_date"):
                extra.append(f"by {str(g['target_date'])[:10]}")
            val = str(g["title"]) + (f" ({', '.join(extra)})" if extra else "")
            facts.append(_fact("career", "Career goal", val, "Career goal",
                               "career.career_goals", g.get("id"), g.get("updated_at"), 0.9))

    # ---- Education ----
    degrees = await _rows(sb, ctx, "public", "education_records",
                          "id,institution_name,degree_type,field_of_study,status,graduation_date,updated_at")
    for d in degrees[:_MAX_PER_CATEGORY]:
        label = _DEGREE_LABEL.get((d.get("degree_type") or "").lower(), "Degree")
        parts = [label]
        if d.get("field_of_study"):
            parts.append(f"in {d['field_of_study']}")
        if d.get("institution_name"):
            parts.append(f"from {d['institution_name']}")
        status = (d.get("status") or "").lower()
        suffix = " (in progress)" if status and status != "completed" else ""
        facts.append(_fact("education", "Degree", " ".join(parts) + suffix, "Education record",
                           "public.education_records", d.get("id"), d.get("updated_at"), 0.95))

    certs = await _rows(sb, ctx, "education", "certifications", "id,name,issuer,status,updated_at")
    for c in certs[:_MAX_PER_CATEGORY]:
        if c.get("name"):
            iss = c.get("issuer")
            facts.append(_fact("education", "Certification",
                               str(c["name"]) + (f" ({iss})" if iss else ""), "Certification",
                               "education.certifications", c.get("id"), c.get("updated_at"), 0.9))

    lics = await _rows(sb, ctx, "education", "licenses", "id,name,issuing_authority,state,status,updated_at")
    for l in lics[:_MAX_PER_CATEGORY]:
        if l.get("name"):
            auth = l.get("issuing_authority")
            facts.append(_fact("education", "License",
                               str(l["name"]) + (f" — {auth}" if auth else ""), "License",
                               "education.licenses", l.get("id"), l.get("updated_at"), 0.9))

    courses = await _rows(sb, ctx, "public", "courses", "id,course_name,provider,status,updated_at")
    named = [c for c in courses if c.get("course_name")]
    for c in named[:_MAX_PER_CATEGORY]:
        prov = c.get("provider")
        facts.append(_fact("education", "Course",
                           str(c["course_name"]) + (f" ({prov})" if prov else ""), "Course",
                           "public.courses", c.get("id"), c.get("updated_at"), 0.8))

    edu_goals = await _rows(sb, ctx, "education", "education_goals", "id,title,target_role,target_date,status,updated_at")
    for g in [g for g in edu_goals if (g.get("status") or "active") == "active"][:_MAX_PER_CATEGORY]:
        if g.get("title"):
            facts.append(_fact("education", "Education goal", str(g["title"]), "Education goal",
                               "education.education_goals", g.get("id"), g.get("updated_at"), 0.9))

    # ---- Finance ---- (Command Center: grounds the Finance / Scenario / Report agents)
    accounts = await _rows(sb, ctx, "finance", "financial_accounts",
                           "id,account_name,account_type,current_balance,interest_rate,credit_limit,is_active,updated_at")
    active_accounts = [a for a in accounts if a.get("is_active", True) and a.get("account_name")]
    for a in active_accounts[:_MAX_PER_CATEGORY]:
        atype = (a.get("account_type") or "account").replace("_", " ")
        bal = a.get("current_balance")
        rate = a.get("interest_rate")
        val = f"{a['account_name']} ({atype})"
        if bal is not None:
            val += f": ${bal}"
        if rate is not None:
            val += f" @ {rate}% APR"
        facts.append(_fact("finance", "Account", val, "Financial account",
                           "finance.financial_accounts", a.get("id"), a.get("updated_at"), 0.92))
    if active_accounts:
        facts.append(_fact("finance", "Accounts on file", f"{len(active_accounts)} active account(s)",
                           "Financial accounts", "finance.financial_accounts", None, None, 0.85))

    # ---- Family ---- (grounds the Family agent). Schema varies — select * and read defensively.
    dependents = await _rows(sb, ctx, "family", "dependents", "*")
    named_deps = [d for d in dependents if d.get("name") or d.get("full_name") or d.get("first_name")]
    if dependents:
        facts.append(_fact("family", "Dependents", f"{len(dependents)} dependent(s)",
                           "Family dependents", "family.dependents", None, None, 0.85))
    for d in named_deps[:_MAX_PER_CATEGORY]:
        nm = d.get("name") or d.get("full_name") or d.get("first_name")
        rel = d.get("relationship") or d.get("relation")
        facts.append(_fact("family", "Dependent", str(nm) + (f" ({rel})" if rel else ""),
                           "Family dependent", "family.dependents", d.get("id"), d.get("updated_at"), 0.85))

    # ---- Documents ---- (grounds the Document Intelligence agent)
    docs = await _rows(sb, ctx, "documents", "documents", "*")
    named_docs = [d for d in docs if d.get("title") or d.get("file_name") or d.get("document_type")]
    if docs:
        facts.append(_fact("documents", "Documents on file", f"{len(docs)} document(s)",
                           "Documents", "documents.documents", None, None, 0.85))
    for d in named_docs[:_MAX_PER_CATEGORY]:
        label = d.get("title") or d.get("file_name") or "Document"
        dtype = d.get("document_type") or d.get("type")
        facts.append(_fact("documents", "Document", str(label) + (f" — {dtype}" if dtype else ""),
                           "Document", "documents.documents", d.get("id"), d.get("updated_at"), 0.85))

    return facts


_NUM = re.compile(r"\d[\d,\.]*")


def numbers_in_facts(facts: list[dict[str, Any]]) -> set[str]:
    """Every numeric token appearing in a fact value — so the validator's number-gate
    accepts figures the advisor echoes from grounded, cited facts."""
    out: set[str] = set()
    for f in facts:
        for m in _NUM.findall(str(f.get("value") or "")):
            tok = m.strip(".,")
            if tok:
                out.add(tok)
    return out
