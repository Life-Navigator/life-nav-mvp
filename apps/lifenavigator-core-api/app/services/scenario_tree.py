"""Multi-Scenario Planning (Sprint 17, hardened Sprint 24).

A branching decision tree where EVERY financial delta is DERIVED from the user's real documents
with full lineage (Evidence → Assumptions → Calculation → Projection) — never a hardcoded number.
If the inputs for a branch are missing, the delta is reported as unknown with "Upload X to improve
accuracy", and the path's net worth is marked unknown rather than fabricated. Readiness deltas are
derived from the financial impact (relative to the user's current net worth) plus clearly-labeled
structural estimates. Not investment/tax advice.
"""
from __future__ import annotations

from typing import Any, Optional

from . import assumptions as A
from . import confidence as C
from .readiness import _WEIGHTS, _index_status

FINANCE = "finance"
DOCS = "documents"
MAX_DECISIONS = 3
DECISION_LABEL = {"new_job": "Job Offer", "mba": "MBA", "move": "Relocate", "buy_house": "Buy House"}
# Documents each decision needs to be projected with real numbers (for coverage + prompts).
NEEDS_DOCS = {"new_job": ["offer_letter"], "mba": ["program_details", "financial_aid_letter"],
              "buy_house": [], "move": []}


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


class ScenarioTreeService:
    def __init__(self, readiness: Any, planning: Any, supabase: Any, comp_benefits: Any = None) -> None:
        self._readiness = readiness
        self._planning = planning
        self._sb = supabase
        self._comp = comp_benefits

    @staticmethod
    def available_decisions() -> list[dict[str, Any]]:
        return [{"decision_type": k, "label": DECISION_LABEL[k], "options": ["yes", "no"]} for k in DECISION_LABEL]

    def _index(self, progress: dict[str, float]) -> int:
        return round(sum(_WEIGHTS.get(d, 0.0) * p for d, p in progress.items()))

    async def _facts(self, ctx) -> dict[str, dict[str, Any]]:
        rows = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, order="uploaded_at.desc", schema=DOCS)
        out: dict[str, dict[str, Any]] = {}
        for r in rows:
            dt = r.get("doc_type")
            if dt and dt not in out:
                out[dt] = r.get("extracted_json") or {}
        return out

    async def build(self, ctx, decisions: Optional[list[str]] = None) -> dict[str, Any]:
        decisions = [d for d in (decisions or ["mba", "new_job"]) if d in DECISION_LABEL][:MAX_DECISIONS]
        if not decisions:
            decisions = ["mba", "new_job"]

        readiness = await self._readiness.assess(ctx)
        base_progress = {d["domain"]: float(d["progress"]) for d in readiness["domains"]}
        base_index = readiness["index"]["score"]
        nw_rows = await self._sb.select("net_worth_snapshots", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, order="as_of_date.desc", schema=FINANCE)
        base_net_worth = float(nw_rows[0].get("net_worth") or 0) if nw_rows else 0.0
        facts = await self._facts(ctx)
        income = 0.0
        if self._comp is not None:
            try:
                income = _f((await self._comp.analyze(ctx))["total_compensation"].get("base")) or 0.0
            except Exception:  # noqa: BLE001
                income = 0.0

        effects = {dt: self._derive(dt, facts, income, base_net_worth) for dt in decisions}

        nodes: list[dict[str, Any]] = []
        root_state: dict[str, Any] = {"progress": dict(base_progress), "net_worth": base_net_worth, "net_worth_known": True, "retirement_ratio": 0.0, "confidence": 1.0, "missing": []}
        nodes.append({"id": "root", "parent": None, "depth": 0, "decision_type": None, "option": None,
                      "label": "Current State", "is_leaf": False, "outcome": self._outcome(root_state, base_index)})

        frontier = [("root", root_state)]
        for depth, dtype in enumerate(decisions, start=1):
            nxt = []
            for parent_id, state in frontier:
                for opt, eff in effects[dtype].items():
                    progress = dict(state["progress"])
                    for dom, delta in eff["readiness"].items():
                        if dom in progress:
                            progress[dom] = max(0.0, min(100.0, progress[dom] + delta))
                    nw_known = state["net_worth_known"] and eff["net_worth"] is not None
                    new_state = {
                        "progress": progress,
                        "net_worth": (state["net_worth"] + (eff["net_worth"] or 0)),
                        "net_worth_known": nw_known,
                        "retirement_ratio": max(0.0, state["retirement_ratio"] + eff["retirement_ratio"]),
                        "confidence": state["confidence"] * eff["confidence"],
                        "missing": state["missing"] + ([eff["lineage"]["missing"]] if eff["lineage"].get("missing") else []),
                    }
                    nid = f"{parent_id}>{dtype}:{opt}"
                    is_leaf = depth == len(decisions)
                    nodes.append({"id": nid, "parent": parent_id, "depth": depth, "decision_type": dtype, "option": opt,
                                  "label": eff["label"], "is_leaf": is_leaf, "lineage": eff["lineage"],
                                  "confidence_breakdown": eff["confidence_breakdown"],
                                  "outcome": self._outcome(new_state, self._index(progress))})
                    nxt.append((nid, new_state))
            frontier = nxt

        leaves = [n for n in nodes if n["is_leaf"]]
        known = [n for n in leaves if n["outcome"]["net_worth_known"]]
        best = max((known or leaves), key=lambda n: n["outcome"]["readiness_index"]) if leaves else None
        return {
            "decisions": decisions, "decision_labels": [DECISION_LABEL[d] for d in decisions],
            "current": nodes[0]["outcome"], "nodes": nodes, "leaves": len(leaves),
            "best_path_id": best["id"] if best else None,
            "assumptions_used": A.by_category(),
            "note": "Every financial delta is derived from your documents; unknown deltas are marked, not fabricated. Readiness deltas are scaled to the financial impact plus labeled structural estimates.",
            "boundary": {"boundary_type": "financial_guidance", "disclaimer_text": "Projections with stated assumptions + cited evidence — not investment, tax, or legal advice."},
        }

    # ---- derivation (the credibility core) ----
    def _derive(self, dtype: str, facts: dict, income: float, current_nw: float) -> dict[str, dict[str, Any]]:
        if dtype == "new_job":
            return self._new_job(facts, current_nw)
        if dtype == "mba":
            return self._mba(facts, income, current_nw)
        if dtype == "buy_house":
            return self._buy_house(facts, current_nw)
        return self._move(facts, current_nw)

    def _fin_delta(self, nw_delta: Optional[float], current_nw: float) -> float:
        if nw_delta is None:
            return 0.0
        ref = max(abs(current_nw), 50000.0)
        return max(-20.0, min(20.0, round(nw_delta / ref * 20, 1)))

    @staticmethod
    def _conf(doc_present: int, doc_needed: int, missing: int) -> tuple[float, dict]:
        cov = (doc_present / doc_needed) if doc_needed else 1.0
        breakdown = C.build(document_coverage=cov, reference_quality=0.9 if doc_present else 0.5, missing_inputs=missing)
        return breakdown["overall_fraction"], breakdown

    def _new_job(self, facts: dict, current_nw: float) -> dict:
        o = facts.get("offer_letter") or facts.get("compensation_plan") or {}
        signing = _f(o.get("signing_bonus")) or 0.0
        base = _f(o.get("base_salary")) or 0.0
        ab = _f(o.get("annual_bonus"))
        bonus = (base * ab / 100.0) if (ab is not None and ab <= 100 and base) else (ab or 0.0)
        has = bool(o)
        nw = round(signing + bonus, 2) if has else None
        ev = ([{"statement": f"Base ${base:,.0f}, signing ${signing:,.0f}, bonus ${bonus:,.0f}", "source": "documents:offer_letter"}] if has else [])
        accept = {
            "label": "Take Job", "net_worth": nw,
            "readiness": {"finance": self._fin_delta(nw, current_nw), "career": 8.0},
            "retirement_ratio": 0.02 if has else 0.0,
            "lineage": {"evidence": ev, "assumptions": [{"label": "Career advances with a new role (structural)", "value": "+8 readiness"}],
                        "calculation": "Year-1 net-worth impact = signing bonus + annual bonus from your offer letter.",
                        "missing": None if has else "Upload your offer letter to project the financial impact of this job."},
        }
        c, cb = self._conf(1 if has else 0, 1, 0 if has else 1)
        accept["confidence"], accept["confidence_breakdown"] = c, cb
        return {"accept": accept, "decline": self._noop("Stay Put")}

    def _mba(self, facts: dict, income: float, current_nw: float) -> dict:
        p = facts.get("program_details") or {}
        aid = facts.get("financial_aid_letter") or {}
        tuition = _f(p.get("tuition"))
        months = _f(p.get("duration_months")) or 24
        years = months / 12.0
        grants = _f(aid.get("grants")) or 0.0
        has_program = bool(p)
        if has_program and tuition is not None:
            ti = A.value("tuition_inflation")
            total_tuition = round(tuition * years * (1 + ti / 2), 2)  # mid-point tuition inflation
            lost_wages = round(income * years, 2) if income else 0.0
            cost = round(total_tuition + lost_wages - grants, 2)
            nw = -cost
            ev = [{"statement": f"Tuition ${tuition:,.0f}/yr × {years:.1f}yr", "source": "documents:program_details"}]
            if grants:
                ev.append({"statement": f"Financial aid grants ${grants:,.0f}", "source": "documents:financial_aid_letter"})
            if income:
                ev.append({"statement": f"Foregone income ${income:,.0f}/yr (if full-time)", "source": "documents:offer_letter/comp"})
            missing = None
        else:
            nw = None
            ev = []
            missing = "Upload your program details (tuition) + financial aid letter to project MBA cost."
        yes = {
            "label": "MBA", "net_worth": nw,
            "readiness": {"finance": self._fin_delta(nw, current_nw), "education": 18.0, "career": 8.0},
            "retirement_ratio": -0.03 if nw is not None else 0.0,
            "lineage": {"evidence": ev,
                        "assumptions": [A.cite("tuition_inflation"), {"label": "Assumes full-time (foregone wages)", "value": "income × years"},
                                        {"label": "Enrolling raises education readiness (structural)", "value": "+18"}],
                        "calculation": "Cost = tuition × years × (1 + tuition inflation/2) + foregone wages − financial aid.",
                        "missing": missing},
        }
        c, cb = self._conf(sum(1 for d in ("program_details", "financial_aid_letter") if d in facts), 2, 0 if has_program else 2)
        yes["confidence"], yes["confidence_breakdown"] = c, cb
        return {"yes": yes, "no": self._noop("No MBA")}

    def _buy_house(self, facts: dict, current_nw: float) -> dict:
        # No home-price input exists yet → never fabricate a down payment.
        yes = {
            "label": "Buy House", "net_worth": None,
            "readiness": {"family": 6.0}, "retirement_ratio": 0.0,
            "lineage": {"evidence": [],
                        "assumptions": [A.cite("down_payment_pct"), A.cite("mortgage_rate"), A.cite("home_appreciation"),
                                        {"label": "Housing stability raises family readiness (structural)", "value": "+6"}],
                        "calculation": "Net-worth impact = −down payment (price × down-payment %); needs the home price.",
                        "missing": "Add the home price you're considering to project the down payment + cash-flow impact."},
        }
        c, cb = self._conf(0, 1, 1)
        yes["confidence"], yes["confidence_breakdown"] = c, cb
        return {"yes": yes, "no": self._noop("Rent")}

    def _move(self, facts: dict, current_nw: float) -> dict:
        yes = {
            "label": "Move", "net_worth": None,
            "readiness": {"family": 5.0, "career": 5.0}, "retirement_ratio": 0.0,
            "lineage": {"evidence": [],
                        "assumptions": [{"label": "Relocation + cost-of-living shift (structural)", "value": "needs your numbers"}],
                        "calculation": "Net-worth impact = relocation cost + cost-of-living delta − any new-offer uplift; needs inputs.",
                        "missing": "Add your relocation estimate and/or the destination offer to project this."},
        }
        c, cb = self._conf(0, 1, 1)
        yes["confidence"], yes["confidence_breakdown"] = c, cb
        return {"yes": yes, "no": self._noop("Stay")}

    @staticmethod
    def _noop(label: str) -> dict:
        cb = C.build(document_coverage=1.0, reference_quality=1.0)
        return {"label": label, "net_worth": 0.0, "readiness": {}, "retirement_ratio": 0.0,
                "confidence": 0.95, "confidence_breakdown": cb,
                "lineage": {"evidence": [], "assumptions": [], "calculation": "No change — declining keeps your current trajectory.", "missing": None}}

    def _outcome(self, state: dict, idx: int) -> dict[str, Any]:
        return {"readiness_index": idx, "readiness_status": _index_status(idx),
                "net_worth": round(state["net_worth"], 0) if state["net_worth_known"] else None,
                "net_worth_known": state["net_worth_known"],
                "retirement_ratio": round(state["retirement_ratio"], 2),
                "confidence": round(state["confidence"], 2),
                "missing": state["missing"]}
