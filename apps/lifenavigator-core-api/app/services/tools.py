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
from typing import Any, Callable

from ..models.common import UserContext
from . import assumptions as A

TOOLS_SCHEMA = "tools"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000e")


def _f(v: Any, default: float = 0.0) -> float:
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "")) if v not in (None, "") else default
    except (TypeError, ValueError):
        return default


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
    exp = _f(i.get("monthly_expenses"))
    cash = _f(i.get("current_cash"))
    months = _f(i.get("target_months"), 6)
    target = round(exp * months, 2)
    covered = round(cash / exp, 1) if exp else 0.0
    status = "green" if covered >= months else "yellow" if covered >= 3 else "red"
    return _result({"target": target, "current": cash, "gap": round(max(0.0, target - cash), 2),
                    "months_covered": covered, "status": status},
                   assumptions=[{"label": "Target months of expenses", "value": months}],
                   confidence=0.9 if exp else 0.3, limitations=["Uses stated monthly expenses; irregular costs not modeled."],
                   calculation=f"target = monthly expenses ${exp:,.0f} × {months:.0f} months = ${target:,.0f}")


@tool("savings_rate", "Savings Rate Engine", "finance", ["annual_income", "annual_savings"])
def savings_rate(i: dict) -> dict:
    inc = _f(i.get("annual_income"))
    sav = _f(i.get("annual_savings"))
    rate = round(sav / inc * 100, 1) if inc else 0.0
    status = "green" if rate >= 20 else "yellow" if rate >= 10 else "red"
    return _result({"savings_rate_pct": rate, "status": status, "target_pct": 20},
                   assumptions=[{"label": "Healthy savings-rate target", "value": "15-20%"}],
                   confidence=0.9 if inc else 0.3, limitations=["Pre-tax vs post-tax income not distinguished."],
                   calculation=f"rate = ${sav:,.0f} ÷ ${inc:,.0f} = {rate}%")


@tool("net_worth", "Net Worth Engine", "finance", ["assets", "liabilities"])
def net_worth(i: dict) -> dict:
    a, li = _f(i.get("assets")), _f(i.get("liabilities"))
    return _result({"net_worth": round(a - li, 2), "assets": a, "liabilities": li},
                   assumptions=[], confidence=0.95 if (a or li) else 0.3,
                   limitations=["Only the assets/liabilities you provide are counted."],
                   calculation=f"net worth = ${a:,.0f} − ${li:,.0f} = ${a - li:,.0f}")


@tool("debt_payoff", "Debt Payoff Optimizer", "debt", ["debts", "extra_payment", "method"])
def debt_payoff(i: dict) -> dict:
    debts = [{"name": d.get("name", "debt"), "balance": _f(d.get("balance")), "apr": _f(d.get("apr")),
              "min_payment": _f(d.get("min_payment"))} for d in (i.get("debts") or [])]
    extra = _f(i.get("extra_payment"))
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
    age = _f(i.get("current_age"), 40)
    retire = _f(i.get("retirement_age"), 65)
    assets = _f(i.get("current_assets"))
    contrib = _f(i.get("annual_contribution"))
    income = _f(i.get("income"))
    r = A.value("investment_return")
    repl = A.value("retirement_replacement")
    wd = A.value("withdrawal_rate")
    years = max(0, int(retire - age))
    grown = assets * (1 + r) ** years
    contrib_fv = contrib * (((1 + r) ** years - 1) / r) if r else contrib * years
    projected = round(grown + contrib_fv, 0)
    target = round(income * repl / wd, 0) if income else 0.0
    gap = round(max(0.0, target - projected), 0)
    ratio = round(projected / target, 2) if target else None
    return _result({"projected_assets": projected, "target_nest_egg": target, "funding_gap": gap,
                    "readiness_ratio": ratio, "on_track": bool(ratio and ratio >= 0.9), "years_to_retirement": years},
                   assumptions=[A.cite("investment_return"), A.cite("retirement_replacement"), A.cite("withdrawal_rate")],
                   confidence=0.7 if income and (assets or contrib) else 0.4,
                   limitations=["Deterministic compound projection (not a full Monte Carlo); taxes + Social Security excluded here."],
                   calculation=f"projected = ${assets:,.0f}×(1+{r:.0%})^{years} + contributions FV = ${projected:,.0f}; target = income×{repl:.0%}÷{wd:.0%}")


@tool("k401_match", "401(k) Match Calculator", "finance", ["income", "current_rate", "employer_match_rate"])
def k401_match(i: dict) -> dict:
    income = _f(i.get("income"))
    cur = _f(i.get("current_rate"))
    match = _f(i.get("employer_match_rate"))
    uncaptured = round(income * max(0.0, match - cur) / 100, 2)
    return _result({"uncaptured_match_annual": uncaptured, "recommended_rate_pct": max(cur, match),
                    "full_match_annual": round(income * match / 100, 2), "capturing_full_match": cur >= match},
                   assumptions=[], confidence=0.9 if income and match else 0.4,
                   limitations=["Assumes a simple % match up to the stated cap."],
                   calculation=f"uncaptured = ${income:,.0f} × ({match:.0f}% − {cur:.0f}%) = ${uncaptured:,.0f}/yr")


# ── Home ─────────────────────────────────────────────────────────────────────
@tool("home_affordability", "Home Affordability Engine", "home", ["annual_income", "monthly_debts", "down_payment", "rate", "term_years"])
def home_affordability(i: dict) -> dict:
    income = _f(i.get("annual_income"))
    debts = _f(i.get("monthly_debts"))
    down = _f(i.get("down_payment"))
    rate = _f(i.get("rate"), A.value("mortgage_rate") * 100) / 100
    term = _f(i.get("term_years"), 30)
    monthly = income / 12
    front = monthly * 0.28               # housing ≤ 28% of gross
    back = monthly * 0.36 - debts        # total debt ≤ 36%
    max_payment = max(0.0, min(front, back))
    n = term * 12
    mr = rate / 12
    loan = (max_payment * (1 - (1 + mr) ** -n) / mr) if mr else max_payment * n
    price = round(loan + down, 0)
    return _result({"max_home_price": price, "max_loan": round(loan, 0), "max_monthly_payment": round(max_payment, 0),
                    "down_payment": down},
                   assumptions=[A.cite("mortgage_rate"), {"label": "DTI rule", "value": "28% front / 36% back"}],
                   confidence=0.8 if income else 0.3,
                   limitations=["Excludes property tax, insurance, HOA, PMI — payment is principal+interest only."],
                   calculation=f"max P&I = min(28% gross, 36%−debts) = ${max_payment:,.0f}/mo → loan ${loan:,.0f} + down ${down:,.0f}")


@tool("rent_vs_buy", "Rent vs Buy Comparison", "home", ["home_price", "monthly_rent", "down_payment", "rate", "years"])
def rent_vs_buy(i: dict) -> dict:
    price = _f(i.get("home_price"))
    rent = _f(i.get("monthly_rent"))
    down = _f(i.get("down_payment"), price * A.value("down_payment_pct"))
    rate = _f(i.get("rate"), A.value("mortgage_rate") * 100) / 100
    years = int(_f(i.get("years"), 7))
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
                   assumptions=[A.cite("mortgage_rate"), A.cite("home_appreciation"), A.cite("down_payment_pct")],
                   confidence=0.65 if price and rent else 0.3,
                   limitations=["Simplified: excludes tax deductions, maintenance, closing costs, opportunity cost of the down payment."],
                   calculation=f"buy (net of equity) ${net_buy:,.0f} vs rent ${rent_cost:,.0f} over {years}y")


# ── Career ───────────────────────────────────────────────────────────────────
@tool("offer_comparison", "Job Offer Comparison Tool", "career", ["offers"])
def offer_comparison(i: dict) -> dict:
    offers = i.get("offers") or []
    rows = []
    for o in offers:
        base = _f(o.get("base"))
        bonus = _f(o.get("bonus"))
        equity = _f(o.get("equity_per_year"))
        benefits = _f(o.get("benefits_value"))
        total = round(base + bonus + equity + benefits, 0)
        rows.append({"name": o.get("name", "offer"), "base": base, "total_comp": total})
    rows.sort(key=lambda r: r["total_comp"], reverse=True)
    return _result({"ranked": rows, "best": rows[0]["name"] if rows else None},
                   assumptions=[{"label": "Equity valued at stated annual amount", "value": "as provided"}],
                   confidence=0.85 if rows else 0.3,
                   limitations=["Equity valuation + COL differences are as provided; not risk-adjusted."],
                   calculation="total comp = base + bonus + annual equity + benefits value")


# ── Education ────────────────────────────────────────────────────────────────
@tool("degree_roi", "Degree ROI Engine", "education", ["tuition_total", "years_in_school", "salary_before", "salary_after"])
def degree_roi(i: dict) -> dict:
    tuition = _f(i.get("tuition_total"))
    yrs = _f(i.get("years_in_school"), 2)
    before = _f(i.get("salary_before"))
    after = _f(i.get("salary_after"))
    lost_wages = before * yrs
    cost = round(tuition + lost_wages, 0)
    annual_gain = after - before
    payback = round(cost / annual_gain, 1) if annual_gain > 0 else None
    lifetime = round(annual_gain * 25 - cost, 0)  # ~25 working years
    return _result({"total_cost": cost, "lost_wages": round(lost_wages, 0), "annual_salary_gain": round(annual_gain, 0),
                    "payback_years": payback, "lifetime_net_gain_25y": lifetime, "worth_it": bool(payback and payback < 10)},
                   assumptions=[A.cite("tuition_inflation"), {"label": "Working years horizon", "value": 25}],
                   confidence=0.7 if (tuition and after) else 0.35,
                   limitations=["Salary gain is the stated estimate; not discounted to present value."],
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
