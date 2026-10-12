"""Deterministic Tool Platform (Elite Sprint 38).

Every important number comes from a tool here, never an LLM. Each tool is a PURE function: same
inputs → same outputs, with its assumptions (cited from the registry), a confidence, and stated
limitations. The ToolRunner persists each run as a first-class, auditable entity. These power
recommendations, scenarios, the Decision Brain, and reports.

This is a strong REPRESENTATIVE set (finance/home/debt/career/education), not the full 40-tool
catalog — the architecture + schema make adding the rest mechanical.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ..models.common import UserContext
from . import assumptions as A
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


REGISTRY: dict[str, dict[str, Any]] = {}


def tool(name: str, label: str, suite: str, inputs: list[str]) -> Callable:
    def deco(fn: Callable) -> Callable:
        REGISTRY[name] = {"fn": fn, "label": label, "suite": suite, "inputs": inputs}
        return fn
    return deco


# ── Finance ──────────────────────────────────────────────────────────────────
@tool("emergency_fund", "Emergency Fund Calculator", "finance", ["monthly_expenses", "current_cash", "target_months"])
def emergency_fund(i: dict) -> dict:
    exp = _req("monthly_expenses", i.get("monthly_expenses"), allow_zero=False)
    cash = _req("current_cash", i.get("current_cash"))
    months = _opt("target_months", i.get("target_months"), 6)
    target = round(exp * months, 2)
    covered = round(cash / exp, 1)
    status = "green" if covered >= months else "yellow" if covered >= 3 else "red"
    return _result({"target": target, "current": cash, "gap": round(max(0.0, target - cash), 2),
                    "months_covered": covered, "status": status},
                   assumptions=[{"label": "Target months of expenses", "value": months}],
                   confidence=0.9, limitations=["Uses stated monthly expenses; irregular costs not modeled."],
                   calculation=f"target = monthly expenses ${exp:,.0f} × {months:.0f} months = ${target:,.0f}")


@tool("savings_rate", "Savings Rate Engine", "finance", ["annual_income", "annual_savings"])
def savings_rate(i: dict) -> dict:
    inc = _req("annual_income", i.get("annual_income"), allow_zero=False)
    sav = _req("annual_savings", i.get("annual_savings"))
    rate = round(sav / inc * 100, 1)
    status = "green" if rate >= 20 else "yellow" if rate >= 10 else "red"
    return _result({"savings_rate_pct": rate, "status": status, "target_pct": 20},
                   assumptions=[{"label": "Healthy savings-rate target", "value": "15-20%"}],
                   confidence=0.9, limitations=["Pre-tax vs post-tax income not distinguished."],
                   calculation=f"rate = ${sav:,.0f} ÷ ${inc:,.0f} = {rate}%")


@tool("net_worth", "Net Worth Engine", "finance", ["assets", "liabilities"])
def net_worth(i: dict) -> dict:
    a = _req("assets", i.get("assets"))
    li = _req("liabilities", i.get("liabilities"))
    return _result({"net_worth": round(a - li, 2), "assets": a, "liabilities": li},
                   assumptions=[], confidence=0.95,
                   limitations=["Only the assets/liabilities you provide are counted."],
                   calculation=f"net worth = ${a:,.0f} − ${li:,.0f} = ${a - li:,.0f}")


@tool("debt_payoff", "Debt Payoff Optimizer", "debt", ["debts", "extra_payment", "method"])
def debt_payoff(i: dict) -> dict:
    debts = [{"name": d.get("name", "debt"),
               "balance": _req(f"debts[{k}].balance", d.get("balance"), allow_zero=False),
               "apr": _req(f"debts[{k}].apr", d.get("apr")),
               "min_payment": _req(f"debts[{k}].min_payment", d.get("min_payment"))}
             for k, d in enumerate(i.get("debts") or [])]
    extra = _opt("extra_payment", i.get("extra_payment"), 0.0)
    method = i.get("method", "avalanche")
    if not debts:
        return _result({"available": False}, assumptions=[], confidence=0.3,
                       limitations=["No debts provided."], calculation="n/a")
    order = sorted(range(len(debts)), key=lambda k: (-debts[k]["apr"]) if method == "avalanche" else debts[k]["balance"])
    bal = [d["balance"] for d in debts]
    total_interest, month = 0.0, 0
    while sum(bal) > 0.01 and month < 600:
        month += 1
        pool = extra
        for k in range(len(debts)):  # accrue + pay minimums
            if bal[k] <= 0:
                continue
            bal[k] += bal[k] * debts[k]["apr"] / 100 / 12
            pay = min(bal[k], debts[k]["min_payment"])
            bal[k] -= pay
        for k in order:  # apply the extra to the priority debt
            if bal[k] > 0 and pool > 0:
                pay = min(bal[k], pool)
                bal[k] -= pay
                pool -= pay
        total_interest += sum(b * debts[k]["apr"] / 100 / 12 for k, b in enumerate(bal) if b > 0)
    return _result({"method": method, "order": [debts[k]["name"] for k in order], "months_to_debt_free": month,
                    "years_to_debt_free": round(month / 12, 1)},
                   assumptions=[{"label": "Method", "value": method}, {"label": "Extra monthly payment", "value": extra}],
                   confidence=0.85, limitations=["Assumes fixed APRs + payments; promo rates not modeled."],
                   calculation=f"{method}: order {[debts[k]['name'] for k in order]}, debt-free in {month} months")


@tool("retirement_projection", "Retirement Projection Engine", "finance", ["current_age", "retirement_age", "current_assets", "annual_contribution", "income"])
def retirement_projection(i: dict) -> dict:
    # `current_age` is the user's own data — there is no defensible default for it, so it is
    # required rather than assumed to be 40.
    age = _req("current_age", i.get("current_age"), allow_zero=False)
    retire = _opt("retirement_age", i.get("retirement_age"), A.value("retirement_age"))
    assets = _req("current_assets", i.get("current_assets"))
    contrib = _req("annual_contribution", i.get("annual_contribution"))
    # OPTIONAL, deliberately. This tool answers two different questions: "what will my balance be?"
    # (needs assets, contributions, horizon) and "how much do I need?" (needs income, to apply the
    # replacement ratio). The resolver legitimately passes income=None when it has not been
    # captured. Requiring it would refuse a projection the user CAN have; defaulting it to 0 would
    # report a $0 nest-egg target and a 'fully funded' readiness ratio. So: project the balance, and
    # return the target as None with a limitation saying which input would unlock it.
    income = _parse("income", i.get("income"))
    r = A.value("investment_return")
    repl = A.value("retirement_replacement")
    wd = A.value("withdrawal_rate")
    years = max(0, int(retire - age))
    grown = assets * (1 + r) ** years
    contrib_fv = contrib * (((1 + r) ** years - 1) / r) if r else contrib * years
    projected = round(grown + contrib_fv, 0)
    target = round(income * repl / wd, 0) if income else None
    gap = round(max(0.0, target - projected), 0) if target else None
    ratio = round(projected / target, 2) if target else None
    limitations = ["Deterministic compound projection (not a full Monte Carlo); taxes + Social Security excluded here."]
    if target is None:
        limitations.append("Annual income was not provided, so the nest-egg target, funding gap and "
                           "readiness ratio are not computed — ask for income to unlock them.")
    return _result({"projected_assets": projected, "target_nest_egg": target, "funding_gap": gap,
                    "readiness_ratio": ratio,
                    "on_track": (ratio >= 0.9) if ratio is not None else None,
                    "years_to_retirement": years},
                   assumptions=[A.cite("investment_return"), A.cite("retirement_replacement"),
                                A.cite("withdrawal_rate"), A.cite("retirement_age")],
                   confidence=0.7 if income else 0.55,
                   limitations=limitations,
                   calculation=(f"projected = ${assets:,.0f}×(1+{r:.0%})^{years} + contributions FV = ${projected:,.0f}"
                                + (f"; target = income×{repl:.0%}÷{wd:.0%}" if income else "")))


@tool("k401_match", "401(k) Match Calculator", "finance", ["income", "current_rate", "employer_match_rate"])
def k401_match(i: dict) -> dict:
    # OPTIONAL, deliberately. This tool answers two different questions: "what will my balance be?"
    # (needs assets, contributions, horizon) and "how much do I need?" (needs income, to apply the
    # replacement ratio). The resolver legitimately passes income=None when it has not been
    # captured. Requiring it would refuse a projection the user CAN have; defaulting it to 0 would
    # report a $0 nest-egg target and a 'fully funded' readiness ratio. So: project the balance, and
    # return the target as None with a limitation saying which input would unlock it.
    income = _parse("income", i.get("income"))
    cur = _req("current_rate", i.get("current_rate"))
    match = _req("employer_match_rate", i.get("employer_match_rate"))
    uncaptured = round(income * max(0.0, match - cur) / 100, 2)
    return _result({"uncaptured_match_annual": uncaptured, "recommended_rate_pct": max(cur, match),
                    "full_match_annual": round(income * match / 100, 2), "capturing_full_match": cur >= match},
                   assumptions=[], confidence=0.9,
                   limitations=["Assumes a simple % match up to the stated cap."],
                   calculation=f"uncaptured = ${income:,.0f} × ({match:.0f}% − {cur:.0f}%) = ${uncaptured:,.0f}/yr")


# ── Home ─────────────────────────────────────────────────────────────────────
@tool("home_affordability", "Home Affordability Engine", "home", ["annual_income", "monthly_debts", "down_payment", "rate", "term_years"])
def home_affordability(i: dict) -> dict:
    income = _req("annual_income", i.get("annual_income"), allow_zero=False)
    debts = _req("monthly_debts", i.get("monthly_debts"))
    down = _req("down_payment", i.get("down_payment"))
    rate = _opt("rate", i.get("rate"), A.value("mortgage_rate") * 100) / 100
    term = _opt("term_years", i.get("term_years"), A.value("mortgage_term_months") / 12)
    monthly = income / 12
    front = monthly * A.value("dti_front_pct")          # housing ≤ front-end DTI
    back = monthly * A.value("dti_back_pct") - debts    # total debt ≤ back-end DTI
    max_payment = max(0.0, min(front, back))
    n = term * 12
    mr = rate / 12
    loan = (max_payment * (1 - (1 + mr) ** -n) / mr) if mr else max_payment * n
    price = round(loan + down, 0)
    return _result({"max_home_price": price, "max_loan": round(loan, 0), "max_monthly_payment": round(max_payment, 0),
                    "down_payment": down},
                   assumptions=[A.cite("mortgage_rate"), A.cite("mortgage_term_months"),
                                A.cite("dti_front_pct"), A.cite("dti_back_pct")],
                   confidence=0.8,
                   limitations=["Excludes property tax, insurance, HOA, PMI — payment is principal+interest only."],
                   calculation=f"max P&I = min(28% gross, 36%−debts) = ${max_payment:,.0f}/mo → loan ${loan:,.0f} + down ${down:,.0f}")


@tool("rent_vs_buy", "Rent vs Buy Comparison", "home", ["home_price", "monthly_rent", "down_payment", "rate", "years"])
def rent_vs_buy(i: dict) -> dict:
    price = _req("home_price", i.get("home_price"), allow_zero=False)
    rent = _req("monthly_rent", i.get("monthly_rent"), allow_zero=False)
    down = _opt("down_payment", i.get("down_payment"), price * A.value("down_payment_pct"))
    rate = _opt("rate", i.get("rate"), A.value("mortgage_rate") * 100) / 100
    years = int(_opt("years", i.get("years"), A.value("rent_vs_buy_horizon")))
    appr = A.value("home_appreciation")
    rent_growth = A.value("inflation")
    n, mr = 30 * 12, rate / 12
    loan = price - down
    pmt = (loan * mr / (1 - (1 + mr) ** -n)) if mr else loan / n
    buy_cost = down + pmt * 12 * years              # simplified: down + payments over horizon
    equity = price * (1 + appr) ** years - (loan)   # rough home value gain minus original loan
    net_buy = round(buy_cost - max(0.0, equity - down), 0)
    rent_cost = round(sum(rent * 12 * (1 + rent_growth) ** y for y in range(years)), 0)
    return _result({"net_buy_cost": net_buy, "total_rent_cost": rent_cost,
                    "favors": "buy" if net_buy < rent_cost else "rent", "horizon_years": years},
                   assumptions=[A.cite("mortgage_rate"), A.cite("home_appreciation"),
                                A.cite("down_payment_pct"), A.cite("rent_vs_buy_horizon"),
                                A.cite("inflation")],
                   confidence=0.65,
                   limitations=["Simplified: excludes tax deductions, maintenance, closing costs, opportunity cost of the down payment."],
                   calculation=f"buy (net of equity) ${net_buy:,.0f} vs rent ${rent_cost:,.0f} over {years}y")


# ── Career ───────────────────────────────────────────────────────────────────
@tool("offer_comparison", "Job Offer Comparison Tool", "career", ["offers"])
def offer_comparison(i: dict) -> dict:
    offers = i.get("offers") or []
    rows = []
    for o in offers:
        base = _req("offers[].base", o.get("base"), allow_zero=False)
        bonus = _opt("offers[].bonus", o.get("bonus"), 0.0)
        equity = _opt("offers[].equity_per_year", o.get("equity_per_year"), 0.0)
        benefits = _opt("offers[].benefits_value", o.get("benefits_value"), 0.0)
        total = round(base + bonus + equity + benefits, 0)
        rows.append({"name": o.get("name", "offer"), "base": base, "total_comp": total})
    rows.sort(key=lambda r: r["total_comp"], reverse=True)
    return _result({"ranked": rows, "best": rows[0]["name"] if rows else None},
                   assumptions=[{"label": "Equity valued at stated annual amount", "value": "as provided"}],
                   confidence=0.85 if rows else 0.3,
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
    lost_wages = before * yrs
    cost = round(tuition + lost_wages, 0)
    annual_gain = after - before
    payback = round(cost / annual_gain, 1) if annual_gain > 0 else None
    horizon = int(A.value("working_years_horizon"))
    lifetime = round(annual_gain * horizon - cost, 0)
    return _result({"total_cost": cost, "lost_wages": round(lost_wages, 0), "annual_salary_gain": round(annual_gain, 0),
                    "payback_years": payback, "lifetime_net_gain": lifetime, "horizon_years": horizon, "worth_it": bool(payback and payback < 10)},
                   assumptions=[A.cite("tuition_inflation"), A.cite("working_years_horizon")],
                   confidence=0.7,
                   limitations=["Salary gain is the stated estimate; not discounted to present value "
                                "— Phase H/J `college_comparison` replaces this with NPV and IRR."],
                   calculation=f"cost = tuition ${tuition:,.0f} + lost wages ${lost_wages:,.0f}; payback = cost ÷ ${annual_gain:,.0f}/yr")


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
