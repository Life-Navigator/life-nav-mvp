"""Deterministic Tool Platform — now an ADAPTER over `calculators/` (Phase A consolidation).

Every important number comes from a tool here, never an LLM. Each tool is a PURE function: same
inputs → same outputs, with its assumptions (cited from the registry), a confidence, and stated
limitations. The ToolRunner persists each run as a first-class, auditable entity. These power
recommendations, scenarios, the Decision Brain, and reports.

WHAT CHANGED, AND WHY
---------------------
This module used to carry its own arithmetic, which meant two engines computed the same quantities
by different code: `debt_payoff` vs `calculators.debt.payoff_months`, `retirement_projection` vs
`calculators.retirement.projected_balance`, `home_affordability`'s inverted amortization vs
`calculators.debt.amortized_payment`. Two implementations of compound growth eventually disagree,
and the user sees whichever path answered first.

So the math moved into `calculators/`, where it is tiered, registry-sourced and parity-tested, and
each tool here is a thin composition that recomposes the legacy response shape. The HTTP contract
(`/v1/tools/{name}/run`), the persisted `tools.tool_runs` rows and every existing caller
(`financial_resolver`, `scenario_compare`, `report_engine`, two routers) are unchanged.

ONE TOOL → SEVERAL CALCULATORS
------------------------------
A tool returns many outputs; a `CalcResult` carries ONE figure and ONE tier. That is not a mismatch
to paper over — the outputs genuinely differ in kind. In `emergency_fund`, `months_covered` is the
user's cash over their own expenses (STRICT) while `target` rests on an assumed six months
(SCENARIO). One tier per tool cannot express that, so the strict figures were hedged as estimates
and the assumed ones were not hedged at all. Per-figure tiering is what lets
`advisor_validator` treat each correctly.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ..models.common import UserContext
from . import assumptions as A
from .calculators import cash, career, debt, education, housing, retirement
from .calculators.base import CalculatorError

TOOLS_SCHEMA = "tools"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000e")


class ToolInputError(CalculatorError):
    """A required tool input is missing or unparseable.

    Subclasses `CalculatorError` (and therefore `ValueError`) so the existing calculator contract and
    the router both understand it. `routers/tools.py` maps it to 422, distinct from the 404 it
    returns for an unknown tool name.
    """


def _parse(name: str, v: Any) -> Optional[float]:
    """Parse a user-supplied money/rate string, or None when genuinely absent.

    Tolerates the decorations a UI sends ("$1,200", "6%") because those are real inputs, not errors.
    Raises on a value that is PRESENT but unparseable — "about 1200" is a question to ask the user,
    never a zero.
    """
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "").strip())
    except (TypeError, ValueError) as exc:
        raise ToolInputError(f"{name}={v!r} is not a number") from exc


def _req(name: str, v: Any, *, allow_zero: bool = True) -> float:
    """A REQUIRED input. Missing ⇒ raise.

    WHY THIS REPLACED `_f(v, default=0.0)`
    --------------------------------------
    Every input in this module used to fall back to 0.0 on absence or garbage. In a financial
    calculator that is the most dangerous possible default, because zero is a *plausible* number: it
    renders as a confident answer rather than an error. `emergency_fund` with no expenses reported a
    $0 target and "0.0 months covered"; `savings_rate` with no income reported a 0% savings rate and
    a red status; `net_worth` with nothing linked reported a net worth of exactly $0. All three read
    as findings about the user. All three were the absence of data.

    This is also the `no-mock-data-ever` rule applied to arithmetic: an honest empty state, never a
    fabricated figure. A calculator that cannot answer must say which input it needs, so the advisor
    can ask for it.
    """
    f = _parse(name, v)
    if f is None:
        raise ToolInputError(f"{name} is required")
    if f < 0:
        raise ToolInputError(f"{name} must not be negative, got {f}")
    if not allow_zero and f == 0:
        raise ToolInputError(f"{name} must be greater than zero")
    return f


def _opt(name: str, v: Any, default: float) -> float:
    """A genuinely OPTIONAL input with a stated default. Garbage still raises.

    `default` must be a registry value (`A.value(...)`) or a structural constant, never a number
    invented here — see the assumption registry's own rule. Phase A moved five such inline
    inventions (retirement age 65, a 25-year working horizon, a 7-year rent-vs-buy horizon, and the
    28/36 DTI pair) into the registry for exactly this reason.
    """
    f = _parse(name, v)
    return default if f is None else f


def _result(outputs: dict, *, assumptions: list, confidence: float, limitations: list, calculation: str) -> dict[str, Any]:
    return {"outputs": outputs, "assumptions": assumptions, "confidence": round(confidence, 2),
            "limitations": limitations, "calculation": calculation, "deterministic": True}


def _cited(*results: Any, extra: Optional[list] = None) -> list[dict[str, Any]]:
    """Registry assumptions from the composed CalcResults, deduped, in the legacy `A.cite()` shape.

    Deduped by key because a composition touches the same assumption more than once —
    `rent_vs_buy` pulls `mortgage_rate` through both the payment and the remaining-balance paths —
    and the same citation listed twice reads as two separate assumptions to anyone auditing it.
    """
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for res in results:
        for a in getattr(res, "assumptions", ()):
            if a.source == "registry" and a.key not in seen:
                seen.add(a.key)
                out.append(A.cite(a.key))
    for item in (extra or []):
        out.append(item)
    return out


def _tiers(*results: Any) -> dict[str, str]:
    """Per-figure tier map, carried into `outputs` so a consumer can tell which numbers are the
    user's own and which are estimates. The legacy shape had no room for this at all."""
    return {r.calculator.split(".", 1)[1]: r.tier for r in results}


REGISTRY: dict[str, dict[str, Any]] = {}


def tool(name: str, label: str, suite: str, inputs: list[str]) -> Callable:
    def deco(fn: Callable) -> Callable:
        REGISTRY[name] = {"fn": fn, "label": label, "suite": suite, "inputs": inputs}
        return fn
    return deco


# ── Finance ──────────────────────────────────────────────────────────────────
@tool("emergency_fund", "Emergency Fund Calculator", "finance", ["monthly_expenses", "current_cash", "target_months"])
def emergency_fund(i: dict) -> dict:
    covered = cash.months_covered(
        monthly_expenses=_req("monthly_expenses", i.get("monthly_expenses"), allow_zero=False),
        current_cash=_req("current_cash", i.get("current_cash")))
    gap = cash.emergency_fund_gap(
        monthly_expenses=covered.inputs_used["monthly_expenses"],
        current_cash=covered.inputs_used["current_cash"],
        target_months=_parse("target_months", i.get("target_months")))
    months = gap.inputs_used["target_months"]
    status = "green" if covered.value >= months else "yellow" if covered.value >= 3 else "red"
    return _result({"target": gap.detail["target"], "current": covered.inputs_used["current_cash"],
                    "gap": gap.value, "months_covered": covered.value, "status": status,
                    "funded": gap.detail["funded"], "surplus": gap.detail["surplus"],
                    "tiers": _tiers(covered, gap)},
                   assumptions=_cited(gap), confidence=0.9,
                   limitations=["Uses stated monthly expenses; irregular costs not modeled."],
                   calculation=f"target = monthly expenses ${covered.inputs_used['monthly_expenses']:,.0f} × {months:.0f} months = ${gap.detail['target']:,.0f}")


@tool("savings_rate", "Savings Rate Engine", "finance", ["annual_income", "annual_savings"])
def savings_rate(i: dict) -> dict:
    r = cash.savings_rate(annual_income=_req("annual_income", i.get("annual_income"), allow_zero=False),
                          annual_savings=_req("annual_savings", i.get("annual_savings")))
    pct = r.detail["pct"]
    status = "green" if pct >= 20 else "yellow" if pct >= 10 else "red"
    return _result({"savings_rate_pct": pct, "status": status,
                    "target_pct": r.detail["common_target_pct"], "tiers": _tiers(r)},
                   assumptions=_cited(r, extra=[{"label": "Healthy savings-rate target", "value": "15-20%"}]),
                   confidence=0.9, limitations=["Pre-tax vs post-tax income not distinguished."],
                   calculation=f"rate = ${r.inputs_used['annual_savings']:,.0f} ÷ ${r.inputs_used['annual_income']:,.0f} = {pct}%")


@tool("net_worth", "Net Worth Engine", "finance", ["assets", "liabilities"])
def net_worth(i: dict) -> dict:
    r = cash.net_worth(assets=_req("assets", i.get("assets")),
                       liabilities=_req("liabilities", i.get("liabilities")))
    return _result({"net_worth": r.value, "assets": r.inputs_used["assets"],
                    "liabilities": r.inputs_used["liabilities"],
                    "negative": r.detail["negative"], "tiers": _tiers(r)},
                   assumptions=_cited(r), confidence=0.95,
                   limitations=["Only the assets/liabilities you provide are counted."],
                   calculation=f"net worth = ${r.inputs_used['assets']:,.0f} − ${r.inputs_used['liabilities']:,.0f} = ${r.value:,.0f}")


@tool("debt_payoff", "Debt Payoff Optimizer", "debt", ["debts", "extra_payment", "method"])
def debt_payoff(i: dict) -> dict:
    rows = i.get("debts") or []
    if not rows:
        # A real answer about a real (empty) portfolio, not a missing input.
        return _result({"available": False}, assumptions=[], confidence=0.3,
                       limitations=["No debts provided."], calculation="n/a")
    method = i.get("method") or "avalanche"
    try:
        plan = debt.payoff_plan(
            debts=[{"label": d.get("name") or d.get("label"),
                    "balance": d.get("balance"),
                    # The legacy input convention is APR AS A PERCENT (22 for 22%), which the
                    # calculator rejects under R5. Converted here, in the adapter, so the boundary
                    # owns the conversion rather than either engine guessing.
                    "apr": (_req(f"debts[{k}].apr", d.get("apr")) / 100.0),
                    "min_payment": d.get("min_payment")} for k, d in enumerate(rows)],
            extra_payment=_opt("extra_payment", i.get("extra_payment"), 0.0),
            method=method)
    except CalculatorError as exc:
        # "Your minimums do not cover the interest" is the single most important thing the advisor
        # could say here, and the old tool reported a confident 600-month payoff instead.
        raise ToolInputError(str(exc)) from exc
    return _result({"method": plan.detail["method"], "order": plan.detail["order"],
                    "months_to_debt_free": int(plan.value),
                    "years_to_debt_free": plan.detail["years_to_debt_free"],
                    "total_interest_paid": plan.detail["total_interest_paid"],
                    "total_paid": plan.detail["total_paid"],
                    "cleared_month": plan.detail["cleared_month"],
                    "target": plan.detail["target"], "tiers": _tiers(plan)},
                   assumptions=_cited(plan, extra=[{"label": "Method", "value": plan.detail["method"]},
                                                   {"label": "Extra monthly payment", "value": plan.inputs_used["extra_payment"]}]),
                   confidence=0.85, limitations=["Assumes fixed APRs + payments; promo rates not modeled."],
                   calculation=f"{plan.detail['method']}: order {plan.detail['order']}, debt-free in {int(plan.value)} months, ${plan.detail['total_interest_paid']:,.0f} interest")


@tool("retirement_projection", "Retirement Projection Engine", "finance", ["current_age", "retirement_age", "current_assets", "annual_contribution", "income"])
def retirement_projection(i: dict) -> dict:
    age = int(_req("current_age", i.get("current_age"), allow_zero=False))
    retire = int(_opt("retirement_age", i.get("retirement_age"), A.value("retirement_age")))
    assets = _req("current_assets", i.get("current_assets"))
    contrib = _req("annual_contribution", i.get("annual_contribution"))
    # OPTIONAL. This tool answers two questions — "what will my balance be?" and "how much do I
    # need?" — and only the second needs income. The resolver legitimately has no income; requiring
    # it would refuse a projection the user CAN have, and defaulting it to 0 reported a $0 nest-egg
    # target with a 'fully funded' readiness ratio.
    income = _parse("income", i.get("income"))

    projected = retirement.projected_balance(
        current_balance=assets, current_age=age, target_age=retire,
        monthly_contribution=contrib / 12.0)

    needed = None
    extra_cites: list[dict[str, Any]] = []
    if not i.get("retirement_age"):
        extra_cites.append(A.cite("retirement_age"))
    if income:
        # The replacement ratio is applied HERE, in the adapter, so it must be cited here — the
        # composed `balance_needed` only sees the resulting dollar figure and cites the withdrawal
        # rate. An assumption applied at the boundary is still an assumption (R2).
        repl = A.value("retirement_replacement")
        extra_cites.append(A.cite("retirement_replacement"))
        needed = retirement.balance_needed(desired_annual_income=income * repl)

    target = needed.value if needed else None
    gap = round(max(0.0, target - projected.value), 0) if target else None
    ratio = round(projected.value / target, 2) if target else None
    limitations = ["Deterministic compound projection (not a full Monte Carlo); taxes + Social Security excluded here."]
    if target is None:
        limitations.append("Annual income was not provided, so the nest-egg target, funding gap and "
                           "readiness ratio are not computed — ask for income to unlock them.")
    results = (projected,) + ((needed,) if needed else ())
    return _result({"projected_assets": round(projected.value, 0), "target_nest_egg": target,
                    "funding_gap": gap, "readiness_ratio": ratio,
                    "on_track": (ratio >= 0.9) if ratio is not None else None,
                    "years_to_retirement": projected.inputs_used.get("years_to_target", retire - age),
                    "tiers": _tiers(*results)},
                   assumptions=_cited(*results, extra=extra_cites),
                   confidence=0.7 if income else 0.55, limitations=limitations,
                   calculation=(f"projected = ${assets:,.0f} + contributions, compounded to age {retire} = ${projected.value:,.0f}"
                                + (f"; target = income × {A.value('retirement_replacement'):.0%} ÷ {A.value('withdrawal_rate'):.0%}" if income else "")))


@tool("k401_match", "401(k) Match Calculator", "finance", ["income", "current_rate", "employer_match_rate"])
def k401_match(i: dict) -> dict:
    r = career.uncaptured_match(
        income=_req("income", i.get("income"), allow_zero=False),
        current_rate=_req("current_rate", i.get("current_rate")),
        employer_match_rate=_req("employer_match_rate", i.get("employer_match_rate")))
    return _result({"uncaptured_match_annual": r.value,
                    "recommended_rate_pct": r.detail["recommended_rate_pct"],
                    "full_match_annual": r.detail["full_match_annual"],
                    "capturing_full_match": r.detail["capturing_full_match"],
                    "tiers": _tiers(r)},
                   assumptions=_cited(r), confidence=0.9,
                   limitations=["Assumes a simple % match up to the stated cap.",
                                "Tiered match formulas, vesting and true-up are Phase I."],
                   calculation=f"uncaptured = ${r.inputs_used['income']:,.0f} × ({r.inputs_used['employer_match_rate_pct']:.0f}% − {r.inputs_used['current_rate_pct']:.0f}%) = ${r.value:,.0f}/yr")


# ── Home ─────────────────────────────────────────────────────────────────────
@tool("home_affordability", "Home Affordability Engine", "home", ["annual_income", "monthly_debts", "down_payment", "rate", "term_years"])
def home_affordability(i: dict) -> dict:
    rate = _parse("rate", i.get("rate"))
    term_years = _parse("term_years", i.get("term_years"))
    r = housing.max_home_price(
        annual_income=_req("annual_income", i.get("annual_income"), allow_zero=False),
        monthly_debts=_req("monthly_debts", i.get("monthly_debts")),
        down_payment=_req("down_payment", i.get("down_payment")),
        # Legacy input convention: `rate` is a PERCENT here. Converted at the boundary.
        apr=(rate / 100.0) if rate is not None else None,
        term_months=int(term_years * 12) if term_years is not None else None)
    return _result({"max_home_price": round(r.value, 0), "max_loan": round(r.detail["max_loan"], 0),
                    "max_monthly_payment": round(r.detail["max_monthly_payment"], 0),
                    "down_payment": r.inputs_used["down_payment"],
                    "binding_constraint": r.detail["binding_constraint"],
                    "tiers": _tiers(r)},
                   assumptions=_cited(r), confidence=0.8,
                   limitations=["Excludes property tax, insurance, HOA, PMI — payment is principal+interest only.",
                                f"The ceiling is set by your {r.detail['binding_constraint'].replace('_', ' ')}."],
                   calculation=f"max P&I = min(front-end, back-end DTI) = ${r.detail['max_monthly_payment']:,.0f}/mo → loan ${r.detail['max_loan']:,.0f} + down ${r.inputs_used['down_payment']:,.0f}")


@tool("rent_vs_buy", "Rent vs Buy Comparison", "home", ["home_price", "monthly_rent", "down_payment", "rate", "years"])
def rent_vs_buy(i: dict) -> dict:
    rate = _parse("rate", i.get("rate"))
    down = _parse("down_payment", i.get("down_payment"))
    years = _parse("years", i.get("years"))
    r = housing.rent_vs_buy(
        home_price=_req("home_price", i.get("home_price"), allow_zero=False),
        monthly_rent=_req("monthly_rent", i.get("monthly_rent"), allow_zero=False),
        years=int(years) if years is not None else None,
        down_payment=down,
        apr=(rate / 100.0) if rate is not None else None)
    return _result({"net_buy_cost": round(r.detail["net_buy_cost"], 0),
                    "total_rent_cost": round(r.detail["total_rent_cost"], 0),
                    "favors": r.detail["favors"], "horizon_years": r.inputs_used["years"],
                    "difference": round(r.value, 0),
                    "equity_recovered": round(r.detail["equity_recovered"], 0),
                    "monthly_payment": round(r.detail["monthly_payment"], 0),
                    "tiers": _tiers(r)},
                   assumptions=_cited(r), confidence=0.65,
                   limitations=["Simplified: excludes tax deductions, maintenance, closing costs, opportunity cost of the down payment."],
                   calculation=f"buy (net of equity) ${r.detail['net_buy_cost']:,.0f} vs rent ${r.detail['total_rent_cost']:,.0f} over {r.inputs_used['years']}y")


# ── Career ───────────────────────────────────────────────────────────────────
@tool("offer_comparison", "Job Offer Comparison Tool", "career", ["offers"])
def offer_comparison(i: dict) -> dict:
    offers = i.get("offers") or []
    if not offers:
        return _result({"ranked": [], "best": None}, assumptions=[], confidence=0.3,
                       limitations=["No offers provided."], calculation="n/a")
    r = career.offer_total_comp(offers=offers)
    return _result({"ranked": r.detail["ranked"], "best": r.detail["best"],
                    "spread": r.value, "tiers": _tiers(r)},
                   assumptions=_cited(r, extra=[{"label": "Equity valued at stated annual amount", "value": "as provided"}]),
                   confidence=0.85,
                   limitations=["Equity valuation + COL differences are as provided; not risk-adjusted.",
                                "Compares gross comp only — no tax, COL or benefit modelling. "
                                "Phase I/J `offer_impact` supersedes this."],
                   calculation="total comp = base + bonus + annual equity + benefits value")


# ── Education ────────────────────────────────────────────────────────────────
@tool("degree_roi", "Degree ROI Engine", "education", ["tuition_total", "years_in_school", "salary_before", "salary_after"])
def degree_roi(i: dict) -> dict:
    tuition = _req("tuition_total", i.get("tuition_total"))
    yrs = _req("years_in_school", i.get("years_in_school"), allow_zero=False)
    before = _req("salary_before", i.get("salary_before"))
    after = _req("salary_after", i.get("salary_after"), allow_zero=False)

    cost = education.degree_total_cost(tuition_total=tuition, years_in_school=yrs,
                                       salary_before=before)
    pv = education.degree_lifetime_value(tuition_total=tuition, years_in_school=yrs,
                                         salary_before=before, salary_after=after)
    try:
        payback = education.degree_payback_years(tuition_total=tuition, years_in_school=yrs,
                                                 salary_before=before, salary_after=after)
        payback_years: Optional[float] = payback.value
        results = (cost, payback, pv)
    except CalculatorError:
        # No uplift ⇒ no payback period. None, not a sentinel: the old tool returned None here too,
        # and callers already treat it as "does not pay back".
        payback_years, results = None, (cost, pv)
    return _result({"total_cost": round(cost.value, 0),
                    "lost_wages": round(cost.detail["foregone_earnings"], 0),
                    "annual_salary_gain": round(pv.detail["annual_uplift"], 0),
                    "payback_years": payback_years,
                    "lifetime_net_gain": round(pv.detail["undiscounted_net_gain"], 0),
                    "present_value": round(pv.value, 0),
                    "horizon_years": pv.inputs_used["horizon_years"],
                    "worth_it": pv.detail["worth_it"], "tiers": _tiers(*results)},
                   assumptions=_cited(*results), confidence=0.7,
                   limitations=["`present_value` discounts the uplift stream; `lifetime_net_gain` does not "
                                "— the gap between them is the cost of discounting.",
                                "Salary gain is the stated estimate. Phase H/J `college_comparison` adds "
                                "aid, 529 drawdown, loan burden and completion risk."],
                   calculation=f"cost = tuition ${tuition:,.0f} + lost wages ${cost.detail['foregone_earnings']:,.0f}; PV of uplift over {pv.inputs_used['horizon_years']}y = ${pv.value:,.0f}")


class ToolRunner:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    @staticmethod
    def catalog() -> list[dict[str, Any]]:
        return [{"name": n, "label": t["label"], "suite": t["suite"], "inputs": t["inputs"]} for n, t in sorted(REGISTRY.items())]

    async def run(self, ctx: UserContext, name: str, inputs: dict, *, scenario_id: str = "", objective_id: str = "") -> dict[str, Any]:
        if name not in REGISTRY:
            raise ValueError(f"unknown tool {name}")
        res = REGISTRY[name]["fn"](inputs)
        run_id = str(uuid.uuid4())
        row = {"tool_run_id": run_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "tool": name,
               "scenario_id": scenario_id or None, "objective_id": objective_id or None,
               "inputs": inputs, "outputs": res["outputs"], "assumptions": res["assumptions"],
               "confidence": res["confidence"], "limitations": res["limitations"],
               "created_at": datetime.now(timezone.utc).isoformat()}
        try:
            await self._sb.insert("tool_runs", row, schema=TOOLS_SCHEMA)
        except Exception:  # noqa: BLE001 — a persistence failure never blocks the calculation
            pass
        return {"tool_run_id": run_id, "tool": name, "label": REGISTRY[name]["label"], **res}
