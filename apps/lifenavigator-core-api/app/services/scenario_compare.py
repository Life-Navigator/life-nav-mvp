"""Scenario Intelligence & Future Comparison (Elite Sprint 37).

Moves the platform from "why did you recommend this?" to "what happens if I choose a different
path?". Given a set of competing futures (Buy now / Wait 12 months / Pay off debt first), it scores
each against the USER'S ACTIVE objectives, produces an explicit tradeoff matrix (improves / worsens
/ neutral), a confidence with its missing inputs, and the cited assumptions that drive the
difference. Impacts are a MODELED, directional strategy relationship — labeled as such, scaled to
the user's real objectives, with assumptions cited from the registry — never a fabricated precise
number. Where a real input is missing, the scenario says so and lowers its confidence.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext
from . import assumptions as A

# Competing-future sets. Each variant carries: objective influences (root -> signed magnitude),
# tradeoffs, the registry assumptions that drive it, and the inputs it needs (missing -> lower conf).
SCENARIO_SETS: dict[str, dict[str, Any]] = {
    "housing": {
        "question": "Should I buy a house now, wait 12 months, or pay off debt first?",
        "needs": ["home_price"],
        "variants": [
            {"id": "buy_now", "name": "Buy a house now",
             "objective_influence": {"family_stability": 12, "homeownership": 20, "financial_independence": -8},
             "improves": ["Family stability", "Housing security"], "worsens": ["Emergency fund", "Retirement readiness", "Liquidity risk"],
             "assumptions": ["down_payment_pct", "mortgage_rate"], "needs": ["home_price"]},
            {"id": "wait_12mo", "name": "Wait 12 months",
             "objective_influence": {"family_stability": 8, "homeownership": 8, "financial_independence": 9},
             "improves": ["Savings buffer", "Financial flexibility"], "worsens": ["Delayed housing stability", "Possible price appreciation"],
             "assumptions": ["home_appreciation", "inflation"], "needs": []},
            {"id": "pay_debt_first", "name": "Pay off debt first",
             "objective_influence": {"family_stability": 5, "homeownership": 4, "financial_independence": 15},
             "improves": ["Financial independence", "Savings rate", "Mortgage eligibility"], "worsens": ["Delayed home purchase"],
             "assumptions": ["mortgage_rate"], "needs": []},
        ]},
    "retirement_timing": {
        "question": "Should I retire at 55 or 65?",
        "needs": ["401k_statement"],
        "variants": [
            {"id": "retire_55", "name": "Retire at 55",
             "objective_influence": {"financial_independence": 6, "health_longevity": 10, "family_stability": 4},
             "improves": ["Time / freedom", "Health & longevity"], "worsens": ["Retirement funding gap", "Healthcare-before-Medicare cost", "Sequence-of-returns risk"],
             "assumptions": ["withdrawal_rate", "life_expectancy", "investment_return"], "needs": ["401k_statement"]},
            {"id": "retire_65", "name": "Retire at 65",
             "objective_influence": {"financial_independence": 16, "health_longevity": 4, "family_stability": 6},
             "improves": ["Retirement funding", "Social Security benefit", "Lower withdrawal rate"], "worsens": ["Fewer healthy retirement years"],
             "assumptions": ["withdrawal_rate", "ss_replacement", "investment_return"], "needs": []},
        ]},
    "education": {
        "question": "Should I get an MBA or invest the tuition?",
        "needs": ["program_details"],
        "variants": [
            {"id": "mba", "name": "Get an MBA",
             "objective_influence": {"career_growth": 16, "education_advancement": 20, "financial_independence": -10},
             "improves": ["Career options", "Earning ceiling"], "worsens": ["Near-term savings", "Opportunity cost", "Debt risk"],
             "assumptions": ["tuition_inflation", "salary_growth"], "needs": ["program_details", "financial_aid_letter"]},
            {"id": "invest_tuition", "name": "Invest the tuition instead",
             "objective_influence": {"career_growth": 2, "financial_independence": 14},
             "improves": ["Invested assets", "Financial independence"], "worsens": ["Slower career advancement"],
             "assumptions": ["investment_return"], "needs": []},
        ]},
    "debt_vs_invest": {
        "question": "Should I pay off debt or increase investments?",
        "needs": [],
        "variants": [
            {"id": "pay_debt", "name": "Pay off debt aggressively",
             "objective_influence": {"financial_independence": 12, "family_stability": 6},
             "improves": ["Guaranteed return (interest saved)", "Cash-flow risk"], "worsens": ["Forgone market upside"],
             "assumptions": ["mortgage_rate"], "needs": []},
            {"id": "invest", "name": "Increase investments",
             "objective_influence": {"financial_independence": 10},
             "improves": ["Long-run compounding", "Liquidity"], "worsens": ["Carrying debt interest", "Market risk"],
             "assumptions": ["investment_return", "return_volatility"], "needs": []},
        ]},
    "career": {
        "question": "Should I take the new job or stay?",
        "needs": ["offer_letter"],
        "variants": [
            {"id": "new_job", "name": "Take the new job",
             "objective_influence": {"career_growth": 14, "financial_independence": 8, "family_stability": -4},
             "improves": ["Compensation", "Career trajectory"], "worsens": ["Transition risk", "Possible relocation strain"],
             "assumptions": ["salary_growth"], "needs": ["offer_letter"]},
            {"id": "stay", "name": "Remain in current role",
             "objective_influence": {"career_growth": 2, "family_stability": 6},
             "improves": ["Stability", "Tenure / vesting"], "worsens": ["Slower comp growth"],
             "assumptions": [], "needs": []},
        ]},
}


class ScenarioComparisonEngine:
    def __init__(self, readiness: Any, life: Any, supabase: Any) -> None:
        self._readiness = readiness
        self._life = life
        self._sb = supabase

    @staticmethod
    def sets() -> list[dict[str, Any]]:
        return [{"key": k, "question": v["question"], "variants": [x["name"] for x in v["variants"]]} for k, v in SCENARIO_SETS.items()]

    async def _present_doc_types(self, ctx: UserContext) -> set[str]:
        try:
            rows = await self._sb.select("documents", columns="doc_type", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema="documents")
            return {r.get("doc_type") for r in rows}
        except Exception:  # noqa: BLE001
            return set()

    async def compare(self, ctx: UserContext, set_key: str) -> dict[str, Any]:
        spec = SCENARIO_SETS.get(set_key)
        if not spec:
            raise ValueError(f"unknown scenario set {set_key}")
        # the user's ACTIVE objectives (impact is measured against THESE — D5)
        try:
            life = await self._life.life_context(ctx)
            objs = await self._life._rows("life_objectives", ctx)  # noqa: SLF001
        except Exception:  # noqa: BLE001
            life, objs = {"has_discovery": False}, []
        active = [o for o in objs if o.get("status", "active") == "active"]
        obj_by_root = {o.get("root_objective_key"): o for o in active}
        primary_obj = max(active, key=lambda o: float(o.get("confidence") or 0)) if active else None
        primary_root = primary_obj.get("root_objective_key") if primary_obj else None
        present = await self._present_doc_types(ctx)

        scenarios = []
        for v in spec["variants"]:
            # objective impacts: only for the user's ACTIVE objectives (so it's about THEIR life)
            obj_impacts = []
            for root, score in v["objective_influence"].items():
                if root in obj_by_root or root == primary_root:
                    obj_impacts.append({"objective": obj_by_root.get(root, {}).get("title", root.replace("_", " ").title()),
                                        "root": root, "score": score, "is_primary": root == primary_root})
            # if discovery is thin, still show the modeled influence against the named roots
            if not obj_impacts:
                obj_impacts = [{"objective": root.replace("_", " ").title(), "root": root, "score": s, "is_primary": False}
                               for root, s in v["objective_influence"].items()]
            missing = [n for n in v.get("needs", []) if n not in present]
            confidence = round(max(0.4, 0.85 - 0.15 * len(missing)), 2)
            scenarios.append({
                "scenario_id": v["id"], "name": v["name"],
                "objective_impacts": sorted(obj_impacts, key=lambda x: abs(x["score"]), reverse=True),
                "tradeoffs": {"improves": v["improves"], "worsens": v["worsens"], "neutral": []},
                "confidence": confidence,
                "assumptions": [A.cite(a) for a in v.get("assumptions", [])],
                "missing_inputs": missing,
                "net_objective_score": sum(i["score"] for i in obj_impacts),
                "primary_objective_score": next((i["score"] for i in obj_impacts if i["is_primary"]), None),
            })

        # the comparison verdict ranks by impact on the PRIMARY objective, then net (transparent).
        def rank_key(s: dict) -> tuple:
            return (s["primary_objective_score"] if s["primary_objective_score"] is not None else -999, s["net_objective_score"])
        ranked = sorted(scenarios, key=rank_key, reverse=True)
        best = ranked[0] if ranked else None
        return {
            "set_key": set_key, "question": spec["question"],
            "primary_objective": (obj_by_root.get(primary_root or "", {}).get("title") if primary_root else None),
            "scenarios": scenarios,
            "best_for_primary_objective": best["name"] if best else None,
            "tradeoff_summary": ([f"{best['name']} best serves your primary objective" + (f" ({life.get('primary_objective', {}).get('title')})" if life.get("primary_objective") else "")
                                  + "; compare what each path worsens before choosing."] if best else []),
            "note": "Impacts are modeled, directional strategy relationships measured against your active objectives, with assumptions cited; they are not precise predictions. Missing inputs lower confidence.",
            "boundary": "A decision-comparison model, not advice — every difference traces to a stated assumption or your data.",
        }
