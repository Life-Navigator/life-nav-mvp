"""Advanced Financial Planning Engine (Sprint 16).

Quantitative retirement + goal planning built on the user's real data (documents, comp/benefits,
finance): retirement readiness, a seeded Monte Carlo projection (reproducible — same inputs give
the same distribution), goal funding probability, Social Security estimate + claim-age choice,
insurance optimization, and withdrawal planning. Inputs come from data where available; every
default is a flagged assumption, and with no income/assets the engine returns a prompt rather
than fabricating a plan. Planning estimates, not investment/tax advice.
"""
from __future__ import annotations

import hashlib
import random
import statistics
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext
from . import assumptions as _assume
from . import confidence as _conf

DOCS = "documents"
FINANCE = "finance"
_SIMS = 1000

# Defaults (flagged as assumptions when used).
DEF_RETIRE_AGE = 67
DEF_LIFE_EXP = 92
DEF_RETURN = 0.06
DEF_VOL = 0.12
DEF_INFLATION = 0.025
DEF_REPLACEMENT = 0.80          # need 80% of pre-retirement income
SAFE_WITHDRAWAL = 0.04          # 4% rule


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _seed(user_id: str, *parts: Any) -> int:
    return int(hashlib.sha256(f"{user_id}:{':'.join(map(str, parts))}".encode()).hexdigest()[:12], 16)


class FinancialPlanningEngine:
    def __init__(self, supabase: SupabaseClient, comp_benefits: Any) -> None:
        self._sb = supabase
        self._comp = comp_benefits

    async def _facts(self, ctx: UserContext) -> dict[str, dict[str, Any]]:
        rows = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, order="uploaded_at.desc", schema=DOCS)
        out: dict[str, dict[str, Any]] = {}
        for r in rows:
            dt = r.get("doc_type")
            if dt and dt not in out:
                out[dt] = r.get("extracted_json") or {}
        return out

    async def plan(self, ctx: UserContext, *, current_age: int = 40, retirement_age: int = DEF_RETIRE_AGE,
                   expected_return: float = DEF_RETURN, volatility: float = DEF_VOL,
                   replacement_ratio: float = DEF_REPLACEMENT, monthly_contribution: Optional[float] = None) -> dict[str, Any]:
        f = await self._facts(ctx)
        analysis = await self._comp.analyze(ctx)
        assumptions: list[dict[str, Any]] = [{"assumption_text": "Current age 40 (default — set yours)", "confidence": 0.3}] if current_age == 40 else []

        income = _f(analysis["total_compensation"].get("base")) or 0.0
        # current retirement assets
        assets = 0.0
        for dt in ("401k_statement", "retirement_statement", "hsa"):
            d = f.get(dt) or {}
            assets += _f(d.get("total_balance")) or _f(d.get("vested_balance")) or _f(d.get("balance")) or 0.0
        for r in await self._sb.select("retirement_plans", filters={"user_id": f"eq.{ctx.user_id}"}, limit=100, schema=FINANCE):
            assets += _f(r.get("balance")) or _f(r.get("current_balance")) or 0.0

        # annual contribution from comp benefits retirement impact (employee + match) or override
        ri = analysis.get("retirement_impact", {})
        annual_contribution = (monthly_contribution * 12) if monthly_contribution is not None else (_f(ri.get("annual_total")) or 0.0)

        if income <= 0 and assets <= 0 and annual_contribution <= 0:
            return {"available": False, "prompt": "Add your income (offer letter) and a 401(k)/retirement statement to build a financial plan.",
                    "boundary": self._boundary()}

        years = max(1, retirement_age - current_age)
        social_security = self._social_security(f, income)
        ss_annual = (social_security["recommended_monthly"] or 0) * 12
        need_annual = max(0.0, income * replacement_ratio - ss_annual)
        target_nest_egg = round(need_annual / SAFE_WITHDRAWAL, 0) if need_annual else 0.0

        mc = self._monte_carlo(ctx, assets, annual_contribution, years, expected_return, volatility, target_nest_egg)
        median_at_retirement = mc["p50"]
        readiness_ratio = round(median_at_retirement / target_nest_egg, 2) if target_nest_egg else None
        retirement_status = self._status(readiness_ratio)
        success = mc["success_probability_vs_target"]

        goals = await self._goal_funding(ctx, expected_return, volatility)
        insurance = self._insurance_optimization(analysis, income)
        withdrawal = self._withdrawal(median_at_retirement, need_annual, retirement_age)

        assumptions += [
            {"assumption_text": f"{expected_return:.0%} expected return, {volatility:.0%} volatility", "confidence": 0.4},
            {"assumption_text": f"Retire at {retirement_age}, {replacement_ratio:.0%} income replacement", "confidence": 0.5},
            {"assumption_text": "4% safe withdrawal; target nest egg = need / 4%", "confidence": 0.5},
        ]
        return {
            "available": True,
            "inputs": {"current_age": current_age, "retirement_age": retirement_age, "years_to_retirement": years,
                       "income": income, "current_retirement_assets": round(assets, 2), "annual_contribution": round(annual_contribution, 2),
                       "expected_return": expected_return, "volatility": volatility},
            "retirement_readiness": {"target_nest_egg": target_nest_egg, "projected_median": median_at_retirement,
                                     "readiness_ratio": readiness_ratio, "status": retirement_status,
                                     "annual_need": round(need_annual, 0), "on_track": bool(readiness_ratio and readiness_ratio >= 0.9)},
            "monte_carlo": mc,
            "goal_funding": goals,
            "social_security": social_security,
            "insurance_optimization": insurance,
            "withdrawal_planning": withdrawal,
            "readiness_inputs": {"retirement_readiness_ratio": readiness_ratio, "retirement_success_probability": success,
                                 "goal_funding_avg": round(statistics.mean([g["probability"] for g in goals]), 2) if goals else None,
                                 "insurance_adequate": insurance.get("life", {}).get("status") == "adequate"},
            "evidence": analysis.get("evidence", []),
            "assumptions": assumptions,
            "assumptions_used": [_assume.cite("investment_return"), _assume.cite("return_volatility"), _assume.cite("inflation"),
                                 _assume.cite("withdrawal_rate"), _assume.cite("retirement_replacement"), _assume.cite("life_expectancy")],
            "confidence": _conf.build(
                document_coverage=(sum(1 for d in ("401k_statement", "retirement_statement", "social_security_estimate") if d in f) / 3),
                reference_quality=0.85 if income else 0.5,
                missing_inputs=len([d for d in ("401k_statement", "retirement_statement", "social_security_estimate") if d not in f]),
                projection_years=years, volatility=volatility),
            "why_this_projection": {
                "evidence": ["Your current retirement assets (401k/retirement statements)", "Your income (offer letter / comp)", "Your contribution rate + employer match"],
                "assumptions": ["Investment return + volatility", "Inflation", "Retirement age + income replacement", "4% safe withdrawal"],
                "calculation": "We run 1,000 Monte-Carlo paths growing (assets + annual contribution) at a random return each year to retirement, then test what fraction reach the nest egg your income needs (need ÷ 4%).",
            },
            "boundary": self._boundary(),
        }

    def _monte_carlo(self, ctx: UserContext, assets: float, annual_contribution: float, years: int,
                     mean_return: float, vol: float, target: float) -> dict[str, Any]:
        rng = random.Random(_seed(ctx.user_id, assets, annual_contribution, years, mean_return, vol))  # reproducible
        ending = []
        for _ in range(_SIMS):
            bal = assets
            for _y in range(years):
                r = rng.gauss(mean_return, vol)
                bal = max(0.0, (bal + annual_contribution) * (1 + r))
            ending.append(bal)
        ending.sort()
        success = round(sum(1 for b in ending if b >= target) / len(ending), 2) if target else 1.0

        def pct(p: float) -> float:
            return round(ending[min(len(ending) - 1, int(p * len(ending)))], 0)
        return {"simulations": _SIMS, "p10": pct(0.10), "p50": pct(0.50), "p90": pct(0.90),
                "mean": round(statistics.mean(ending), 0), "success_probability_vs_target": success}

    def _goal_funding_prob(self, target: float, current: float, annual: float, years: int, mean_return: float, vol: float, seed: int) -> float:
        if target <= 0:
            return 1.0
        rng = random.Random(seed)
        wins = 0
        for _ in range(500):
            bal = current
            for _y in range(max(1, years)):
                bal = (bal + annual) * (1 + rng.gauss(mean_return, vol))
            if bal >= target:
                wins += 1
        return round(wins / 500, 2)

    async def _goal_funding(self, ctx: UserContext, mean_return: float, vol: float) -> list[dict[str, Any]]:
        goals = await self._sb.select("financial_goals", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=FINANCE)
        out = []
        for g in goals:
            target = _f(g.get("target_amount")) or 0.0
            current = _f(g.get("current_amount")) or _f(g.get("saved_amount")) or 0.0
            annual = _f(g.get("monthly_contribution")) or 0.0
            years = 5  # default horizon if no target date parsing
            prob = self._goal_funding_prob(target, current, annual * 12, years, mean_return, vol, _seed(ctx.user_id, g.get("id", "")))
            out.append({"goal": g.get("name") or g.get("title") or "Goal", "target": target, "current": current,
                        "probability": prob, "status": "on_track" if prob >= 0.7 else "at_risk"})
        return out

    @staticmethod
    def _social_security(f: dict, income: float) -> dict[str, Any]:
        doc = f.get("social_security_estimate") or {}
        at67 = _f(doc.get("monthly_benefit_at_67"))
        at62 = _f(doc.get("monthly_benefit_at_62"))
        at70 = _f(doc.get("monthly_benefit_at_70"))
        sourced = at67 is not None
        if at67 is None and income > 0:
            # rough estimate: ~30% replacement of income at FRA (flagged estimate)
            at67 = round(income * 0.30 / 12, 0)
            at62 = round(at67 * 0.70, 0)
            at70 = round(at67 * 1.24, 0)
        return {"monthly_at_62": at62, "monthly_at_67": at67, "monthly_at_70": at70,
                "recommended_monthly": at70 or at67, "optimal_claim_age": 70 if at70 else 67,
                "rationale": "Delaying to 70 maximizes the lifetime benefit for most healthy claimants.",
                "source": "social_security_estimate document" if sourced else "estimated (~30% replacement) — upload your SSA statement"}

    @staticmethod
    def _insurance_optimization(analysis: dict, income: float) -> dict[str, Any]:
        ins = analysis.get("insurance_impact", {})
        life = ins.get("life", {})
        out: dict[str, Any] = {}
        if "coverage" in life:
            recommended = round(income * 10, 0) if income else life.get("need_10x_income")
            out["life"] = {"current": life.get("coverage"), "recommended": recommended,
                           "gap": life.get("gap", 0), "status": life.get("status"),
                           "action": "Increase coverage to ~10× income" if life.get("status") == "gap" else "Adequate"}
        else:
            out["life"] = {"missing": "Upload a life policy to optimize coverage."}
        out["disability"] = ins.get("disability", {})
        out["note"] = "Term life is usually the cost-efficient choice for income replacement."
        return out

    @staticmethod
    def _withdrawal(nest_egg: float, need_annual: float, retirement_age: int) -> dict[str, Any]:
        sustainable = round(nest_egg * SAFE_WITHDRAWAL, 0)
        covers = sustainable >= need_annual if need_annual else None
        return {"sustainable_annual_withdrawal": sustainable, "withdrawal_rate": SAFE_WITHDRAWAL,
                "annual_need": round(need_annual, 0), "covers_need": covers,
                "shortfall": round(need_annual - sustainable, 0) if (need_annual and not covers) else 0,
                "strategy": "Start at 4% of the nest egg, adjust for inflation; flex spending in down-market years."}

    @staticmethod
    def _status(ratio: Optional[float]) -> str:
        if ratio is None:
            return "unknown"
        return "green" if ratio >= 0.9 else "yellow" if ratio >= 0.6 else "orange" if ratio >= 0.3 else "red"

    @staticmethod
    def _boundary() -> dict[str, Any]:
        return {"boundary_type": "financial_guidance",
                "disclaimer_text": "Planning estimates with stated assumptions — not investment, tax, or retirement advice. Markets are uncertain; results are probabilistic."}
