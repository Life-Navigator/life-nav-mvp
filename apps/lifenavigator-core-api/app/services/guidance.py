"""Guidance / Next-Best-Action engine (Elite Sprint 23).

Turns the platform's scattered intelligence into a single answer to three questions the dashboard
must answer instantly: What is my status? What should I do next? Why? It composes Life Readiness,
document readiness, decisions, and recommendations into one prioritized action — following the
intended first-10-minutes journey (documents → readiness → decision → report). Outcome language,
not feature language. Empty data becomes a useful prompt, never a dead end.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext

# Outcome-language labels for domains (Deliverable 5).
DOMAIN_OUTCOME = {
    "finance": "your financial footing", "family": "protecting your family", "career": "your career trajectory",
    "health": "your health foundation", "education": "your education ROI", "decision": "your decision confidence",
}
# Critical first documents and what each unlocks (empty-state framework, Deliverable 4).
DOC_UNLOCKS = [
    ("offer_letter", "Upload your offer letter", "Unlocks the true value of your job offer — base, bonus, equity, and total comp vs market."),
    ("medical_plan", "Add your benefits package", "Unlocks FSA/HSA tax optimization and the real value of your benefits."),
    ("401k_statement", "Add your 401(k) statement", "Unlocks retirement readiness and an honest Monte-Carlo projection."),
    ("life_insurance_policy", "Add your life insurance policy", "Unlocks survivor planning and your family protection gap."),
]


class GuidanceEngine:
    def __init__(self, readiness: Any, documents: Any, supabase: Any) -> None:
        self._readiness = readiness
        self._documents = documents
        self._sb = supabase

    async def dashboard(self, ctx: UserContext) -> dict[str, Any]:
        readiness = await self._readiness.assess(ctx)
        docs = await self._sb.select("documents", columns="doc_type", filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema="documents")
        have_doc_types = {d.get("doc_type") for d in docs}
        decisions = await self._sb.select("decisions", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="decision")
        reports = await self._sb.select("reports", columns="id", filters={"user_id": f"eq.{ctx.user_id}"}, limit=10, schema="reporting")

        idx = readiness["index"]
        domains_sorted = sorted(readiness["domains"], key=lambda d: d["progress"])
        top_gaps = [{"domain": d["domain"], "label": DOMAIN_OUTCOME.get(d["domain"], d["domain"]),
                     "status": d["status"], "gap": d["gap"], "href": _domain_href(d["domain"])}
                    for d in domains_sorted[:3] if d["status"] in ("red", "orange", "yellow")]
        missing_docs = [{"doc_type": dt, "title": title, "why": why}
                        for dt, title, why in DOC_UNLOCKS if dt not in have_doc_types]

        next_action = self._next_best_action(have_doc_types, top_gaps, len(decisions), len(reports), missing_docs)
        return {
            "status": {"index": idx["score"], "status": idx["status"], "headline": idx["headline"],
                       "summary": f"You're at {idx['score']}/100 readiness. Your weakest area is {DOMAIN_OUTCOME.get(idx.get('weakest_domain'), idx.get('weakest_domain') or 'unknown')}."},
            "next_best_action": next_action,
            "top_gaps": top_gaps,
            "missing_critical_documents": missing_docs[:3],
            "open_decisions": len(decisions),
            "reports_generated": len(reports),
            "documents_on_file": len(docs),
            "journey": {  # the 7-step first-10-minutes path + where the user is
                "documents": len(docs) > 0, "readiness": True, "gaps_identified": bool(top_gaps),
                "decision_analyzed": len(decisions) > 0, "report_generated": len(reports) > 0,
            },
        }

    @staticmethod
    def _next_best_action(have_docs: set, top_gaps: list, n_decisions: int, n_reports: int, missing_docs: list) -> dict[str, Any]:
        # Priority ladder == the intended journey. Each step explains WHY (no dead ends).
        if not have_docs:
            md = missing_docs[0] if missing_docs else {"title": "Upload a document", "why": "We ground every recommendation in your real documents."}
            return {"title": md["title"], "why": md["why"], "cta_label": "Upload a document", "href": "/dashboard/documents", "step": "documents"}
        if top_gaps and top_gaps[0]["status"] == "red":
            g = top_gaps[0]
            return {"title": f"Close your biggest gap: {g['gap']}", "why": f"This is dragging down {g['label']} the most — fixing it lifts your whole readiness.",
                    "cta_label": "Review this", "href": g["href"], "step": "gaps"}
        if n_decisions == 0:
            return {"title": "Analyze your first decision", "why": "See worst/expected/best outcomes and how each moves your readiness — grounded in your documents.",
                    "cta_label": "Analyze a decision", "href": "/dashboard/life-decisions/workspace", "step": "decision"}
        if n_reports == 0:
            return {"title": "Generate your first report", "why": "A branded, cited report you can download or share with an advisor — built from everything above.",
                    "cta_label": "Generate a report", "href": "/dashboard/reports", "step": "report"}
        if missing_docs:
            md = missing_docs[0]
            return {"title": md["title"], "why": md["why"], "cta_label": "Upload", "href": "/dashboard/documents", "step": "documents"}
        return {"title": "Share your report with an advisor", "why": "You've built a complete, cited picture — share a governed, redacted view.",
                "cta_label": "Share securely", "href": "/dashboard/reports", "step": "share"}


def _domain_href(domain: str) -> str:
    return {"finance": "/dashboard/finance", "family": "/dashboard/family", "career": "/dashboard/career",
            "health": "/dashboard/wellness", "education": "/dashboard/education",
            "decision": "/dashboard/life-decisions/workspace"}.get(domain, "/dashboard")
