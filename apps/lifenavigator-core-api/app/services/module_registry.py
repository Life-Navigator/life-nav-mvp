"""Centralized module registry + visibility resolver (Elite Sprint 22).

The single source of truth for what each user may see. No module self-determines visibility;
the resolver is the only authority and the Core API enforces it server-side (the UI merely
reflects it). Maturity states drive badges. Military is gated by profile flag OR uploaded
military document; admin-only modules require the admin role.
"""
from __future__ import annotations

from typing import Any

PRODUCTION, BETA, EXPERIMENTAL, HIDDEN = "production", "beta", "experimental", "hidden"
BADGE = {PRODUCTION: None, BETA: "BETA", EXPERIMENTAL: "EXPERIMENTAL", HIDDEN: None}

# A user is "military" for gating if their status is any affiliation OR they uploaded a mil doc.
MILITARY_STATUSES = {"veteran", "active_duty", "guard_reserve", "spouse_dependent", "military_affiliated"}
MILITARY_DOC_TYPES = {"dd214", "les", "va_award_letter", "military_retirement_statement", "orders", "gi_bill"}


class Module:
    def __init__(self, mid: str, label: str, status: str, *, required_roles: list[str] | None = None,
                 required_profile_flags: list[str] | None = None, required_documents: list[str] | None = None,
                 enabled: bool = True) -> None:
        self.id = mid
        self.label = label
        self.status = status
        self.required_roles = required_roles or []
        self.required_profile_flags = required_profile_flags or []
        self.required_documents = required_documents or []
        self.enabled = enabled


# Registry. Maturity reflects the pre-beta audit: the spine is production; the newest
# intelligence layers are beta; multi-scenario is experimental (hidden by default).
MODULES: list[Module] = [
    Module("readiness", "Life Readiness", PRODUCTION),
    Module("chat", "Chat", PRODUCTION),
    Module("decision", "Life Decisions", PRODUCTION),
    Module("documents", "Documents", PRODUCTION),
    Module("finance", "Finance", PRODUCTION),
    Module("family", "Family", PRODUCTION),
    Module("reports", "Reports", PRODUCTION),
    Module("sharing", "Advisor Sharing", PRODUCTION),
    Module("career", "Career", PRODUCTION),
    Module("decision_graph", "Decision Graph", BETA),
    Module("comp_benefits", "Comp & Benefits", BETA),
    Module("financial_plan", "Financial Plan", BETA),
    Module("family_office", "Family Office", BETA),
    Module("health_intelligence", "Health Intelligence", BETA),
    Module("education", "Education", BETA),
    Module("scenarios", "Multi-Scenario", EXPERIMENTAL),
    Module("military", "Military / VA", BETA,
           required_profile_flags=["military"], required_documents=sorted(MILITARY_DOC_TYPES)),
    Module("metrics", "Executive Dashboard", PRODUCTION, required_roles=["admin"]),
]
_BY_ID = {m.id: m for m in MODULES}


def is_military(military_status: str, has_military_doc: bool) -> bool:
    return military_status in MILITARY_STATUSES or has_military_doc


def module_visible(m: Module, *, military_status: str, has_military_doc: bool, is_admin: bool) -> bool:
    if not m.enabled or m.status == HIDDEN:
        return False
    if "admin" in m.required_roles and not is_admin:
        return False
    if "military" in m.required_profile_flags and not is_military(military_status, has_military_doc):
        return False
    if m.status == EXPERIMENTAL and not m.required_profile_flags:
        return False  # experimental hidden by default unless explicitly gated/enabled per user
    return True


def resolve(*, military_status: str = "unknown", has_military_doc: bool = False, is_admin: bool = False) -> dict[str, Any]:
    """Return the visibility + maturity of every module for this user."""
    out = {}
    for m in MODULES:
        vis = module_visible(m, military_status=military_status, has_military_doc=has_military_doc, is_admin=is_admin)
        out[m.id] = {"id": m.id, "label": m.label, "visible": vis, "status": m.status, "badge": BADGE[m.status]}
    return {"modules": out, "is_military": is_military(military_status, has_military_doc), "is_admin": is_admin,
            "military_status": military_status}


def module(mid: str) -> Module | None:
    return _BY_ID.get(mid)
