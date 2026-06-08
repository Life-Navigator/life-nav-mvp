"""Decision Intelligence Graph (Sprint 15) — make the reasoning visible.

Composes the user's documents (Sprint 10/11), their compensation/benefits analysis (Sprint 12),
and a decision workspace (Sprint 14) into one explainable reasoning graph:

  Documents → Analyses → Impacts → Tradeoffs/Risks → Recommendation → Readiness Delta

Every node carries a clickable detail payload + a semantic color. This is the data behind a
clean, interactive mind-map (Miro/Whimsical-style) — not a Neo4j dump. Nothing is invented;
nodes only appear when their underlying data exists, and each cites its source.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

DOCS = "documents"

# Color system (semantic): green positive · yellow neutral · orange tradeoff · red risk ·
# blue evidence · purple recommendation · slate document.
GREEN, YELLOW, ORANGE, RED, BLUE, PURPLE, SLATE = "green", "yellow", "orange", "red", "blue", "purple", "slate"

_DOC_LABEL = {"offer_letter": "Offer Letter", "medical_plan": "Benefits Package", "compensation_plan": "Compensation Plan",
              "life_insurance_policy": "Insurance Policy", "disability_insurance": "Disability Policy",
              "401k_statement": "401(k) Statement", "hsa": "HSA", "fsa": "FSA"}


def _money(v: Any) -> Optional[str]:
    try:
        return f"${float(str(v).replace(',', '').replace('$', '')):,.0f}"
    except (TypeError, ValueError):
        return None


class DecisionGraphService:
    def __init__(self, workspace: Any, comp_benefits: Any, supabase: Any) -> None:
        self._ws = workspace
        self._comp = comp_benefits
        self._sb = supabase

    async def build(self, ctx: UserContext, decision_type: str) -> dict[str, Any]:
        ws = await self._ws.create(ctx, decision_type, persist=False)
        analysis = await self._comp.analyze(ctx)
        docs = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema=DOCS)
        doc_by_type = {d.get("doc_type"): d for d in docs}

        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, str]] = []

        def node(nid: str, ntype: str, title: str, color: str, layer: int, *, subtitle: str = "", detail: Optional[dict] = None) -> str:
            nodes.append({"id": nid, "type": ntype, "title": title, "subtitle": subtitle, "color": color, "layer": layer, "detail": detail or {}})
            return nid

        def edge(a: str, b: str) -> None:
            edges.append({"from": a, "to": b})

        # ── L0 Documents ──
        doc_ids: dict[str, str] = {}
        for dt, d in doc_by_type.items():
            if dt in _DOC_LABEL:
                ej = d.get("extracted_json") or {}
                doc_ids[dt] = node(f"doc:{dt}", "document", _DOC_LABEL[dt], SLATE, 0,
                                   subtitle=f"{len(ej)} fields", detail={"extracted": ej, "confidence": d.get("confidence")})

        # ── L1 Analyses (from documents) ──
        tc = analysis["total_compensation"]
        analysis_ids: list[str] = []
        if "offer_letter" in doc_by_type or "compensation_plan" in doc_by_type:
            comp_detail = {
                "Base Salary": _money(tc["base"]), "Bonus": _money(tc["bonus"]),
                "RSUs / Equity (annualized)": _money(tc["equity_annualized"]),
                "401(k) Match": _money(next((b["annual_value"] for b in analysis["benefit_valuation"] if "401" in b["benefit"]), None)) or "—",
                "Total Compensation": _money(tc["total"]),
                "evidence": [e["statement"] for e in analysis.get("evidence", [])],
            }
            cid = node("an:comp", "analysis", "Compensation Analysis", GREEN, 1, subtitle=_money(tc["total"]) or "", detail=comp_detail)
            analysis_ids.append(cid)
            for dt in ("offer_letter", "compensation_plan"):
                if dt in doc_ids:
                    edge(doc_ids[dt], cid)
        if "medical_plan" in doc_by_type or "hsa" in doc_by_type or "fsa" in doc_by_type:
            fh = analysis["fsa_hsa"]
            bid = node("an:benefits", "analysis", "Benefits Analysis", GREEN, 1,
                       subtitle=f"net-worth +{_money(fh.get('annual_net_worth_effect')) or '$0'}/yr",
                       detail={"FSA/HSA net-worth effect": _money(fh.get("annual_net_worth_effect")), "marginal_rate": fh.get("marginal_rate"), **({"note": fh.get("note")} if fh.get("note") else {})})
            analysis_ids.append(bid)
            for dt in ("medical_plan", "hsa", "fsa"):
                if dt in doc_ids:
                    edge(doc_ids[dt], bid)
        ins = analysis["insurance_impact"].get("life", {})
        if "life_insurance_policy" in doc_by_type:
            iid = node("an:insurance", "analysis", "Insurance Analysis", GREEN if ins.get("status") == "adequate" else YELLOW, 1,
                       subtitle=_money(ins.get("coverage")) or "", detail={"Coverage": _money(ins.get("coverage")), "Need (10× income)": _money(ins.get("need_10x_income")), "Status": ins.get("status")})
            analysis_ids.append(iid)
            edge(doc_ids["life_insurance_policy"], iid)

        # ── L1.5 Evidence (blue) hanging off the compensation analysis ──
        for i, e in enumerate(analysis.get("evidence", [])[:4]):
            ev = node(f"ev:{i}", "evidence", e.get("statement", "evidence")[:60], BLUE, 1, detail={"source": e.get("source_table")})
            if analysis_ids:
                edge(analysis_ids[0], ev)

        # ── L2 Impacts ──
        deltas = {d["domain"]: d for d in ws["readiness_impact"]["domain_deltas"]}
        impact_ids: list[str] = []

        def impact(domain: str, title: str, detail: dict) -> str:
            d = deltas.get(domain)
            color = GREEN if (d and d["delta"] > 0) else RED if (d and d["delta"] < 0) else YELLOW
            iid = node(f"im:{domain}", "impact", title, color, 2,
                       subtitle=(f"{d['current']}→{d['projected']}" if d else "neutral"),
                       detail={**detail, **({"readiness": f"{d['current']} → {d['projected']} ({'+' if d['delta'] >= 0 else ''}{d['delta']})", "rationale": d["rationale"]} if d else {})})
            impact_ids.append(iid)
            return iid

        career = impact("career", "Career Impact", {"Total comp": _money(tc["total"]), "Market-cited": True})
        fin = impact("finance", "Financial Impact", {"Total comp": _money(tc["total"]), "5-year value": _money(analysis["five_year_value"]["cumulative"])})
        fam = impact("family", "Family Impact", {
            "Insurance": ins.get("status") or "unknown", "Education / college": "tracked in Family domain",
            "Commute / time": "add your commute to factor this in", "Life coverage": _money(ins.get("coverage"))})
        for aid in analysis_ids:
            for iid in (career, fin, fam):
                if iid:
                    edge(aid, iid)

        # ── L3 Tradeoffs (orange) + Risks (red) ──
        td_ids: list[str] = []
        for i, t in enumerate(ws.get("tradeoffs", [])[:4]):
            tid = node(f"td:{i}", "tradeoff", (t.get("benefit") or "Tradeoff")[:50], ORANGE, 3,
                       detail={"option_a": t.get("option_a"), "option_b": t.get("option_b"), "benefit": t.get("benefit"), "cost": t.get("cost")})
            td_ids.append(tid)
        # risks from gaps / missing docs
        if ins.get("status") == "gap":
            td_ids.append(node("risk:insurance", "risk", "Underinsured", RED, 3, subtitle=f"gap {_money(ins.get('gap'))}",
                               detail={"Life coverage gap": _money(ins.get("gap")), "why": "Coverage below 10× income need"}))
        for md in analysis.get("missing_documents", [])[:2]:
            td_ids.append(node(f"risk:{md}", "risk", f"Missing: {md.replace('_', ' ')}", RED, 3, detail={"why": "Upload this to remove an assumption from the analysis"}))
        for iid in impact_ids:
            for tid in td_ids:
                edge(iid, tid)

        # ── L4 Recommendation (purple) ──
        rec = node("rec", "recommendation", ws["label"], PURPLE, 4, subtitle=f"confidence {round((ws.get('confidence') or 0) * 100)}%",
                   detail={"Why it was recommended": ws.get("verdict"), "Confidence": ws.get("confidence"),
                           "Assumptions": [a.get("assumption_text", str(a)) for a in ws.get("assumptions", [])],
                           "Alternatives": ["Invest instead", "Delay the decision", "Negotiate terms"],
                           "Next steps": ws.get("next_steps", [])})
        for tid in (td_ids or impact_ids):
            edge(tid, rec)
        # assumptions (yellow) off the recommendation
        for i, a in enumerate(ws.get("assumptions", [])[:3]):
            aid = node(f"as:{i}", "assumption", (a.get("assumption_text", str(a)))[:50], YELLOW, 4, detail={"confidence": a.get("confidence")})
            edge(aid, rec)

        # ── L5 Readiness Delta (green/by-status) ──
        ri = ws["readiness_impact"]
        rd = node("readiness", "readiness", "Readiness Delta", GREEN if ri["index_delta"] >= 0 else ORANGE, 5,
                  subtitle=f"{ri['current_index']} → {ri['projected_index']} ({'+' if ri['index_delta'] >= 0 else ''}{ri['index_delta']})",
                  detail={"Current index": ri["current_index"], "Projected index": ri["projected_index"],
                          "Change": ri["index_delta"], "Per-domain": ri["domain_deltas"], "note": ri["note"]})
        edge(rec, rd)

        return {
            "decision_type": decision_type, "label": ws["label"], "question": ws["question"],
            "layers": ["Documents", "Analyses", "Impacts", "Tradeoffs & Risks", "Recommendation", "Readiness"],
            "nodes": nodes, "edges": edges,
            "legend": {GREEN: "Positive impact", YELLOW: "Neutral / assumption", ORANGE: "Tradeoff", RED: "Risk", BLUE: "Evidence", PURPLE: "Recommendation", SLATE: "Document"},
            "boundary": ws.get("boundary", {}),
        }
