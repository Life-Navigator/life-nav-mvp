"""Deterministic Finance Scenario Engine.

The NUMBERS layer of the finance advisor: it computes every figure the LLM is allowed to cite — net worth,
cash flow, emergency-fund range, down-payment scenarios, debt-payoff timeline, savings targets, affordability
band — purely arithmetically from the canonical resolver summary (finance.* only). The LLM never invents a
number; it interprets THESE. Anything that can't be computed from real data is returned as a named gap
(`needs_*: true`, value `None`) — never a fabricated default (matches the "expense_history: missing,
needs_expense_budget: true" contract).

Design rules:
  * No advice. This engine produces figures + scenarios, not "you should…". Framing is the LLM's job (gated).
  * No fabrication. Missing input → None + a `needs_*` flag, never a guessed value.
  * Provenance. Every block carries the resolver source label so the UI/validator can attribute it.
  * allowed_numbers. The flat set of computed figures the validator may let the LLM echo (grounding, not gate).
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

# Rule-of-thumb constants (documented, not advice): emergency-fund months, down-payment tiers, the affordability
# income multiple band, and the PMI down-payment threshold. Tunable; surfaced with clear labels + disclaimers.
_EMERGENCY_MONTHS = (3, 6)
_DOWN_PAYMENT_TIERS = (5, 10, 20)
_PMI_THRESHOLD_PCT = 20
_AFFORDABILITY_INCOME_MULTIPLE = (3.0, 5.0)  # common lender rule-of-thumb band on ANNUAL income


def _round(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(float(v), 2)


def _forms(v: Optional[float]) -> set[str]:
    """Exact + common ROUNDED string forms of a GROUNDED figure, so the number-gate accepts natural roundings
    ("$1.24M" or "$200K" for 1,243,120 / 203,200) of REAL numbers without weakening the fabrication gate — a
    rounded real number is not a fabricated one. Emits: exact, k-rounded (203 / 203000), and M-rounded
    (1.24 / 1.2 / 1)."""
    out: set[str] = set()
    if v is None:
        return out
    n = float(v)
    out.add(str(int(n)) if n.is_integer() else str(n))
    out.add(str(int(round(n))))
    if abs(n) >= 1000:
        k = int(round(n / 1000))
        out.add(str(k))            # 203  (from 203,200)
        out.add(str(k * 1000))     # 203,000
    if abs(n) >= 100000:
        out.add(f"{n / 1_000_000:.2f}".rstrip("0").rstrip("."))  # 1.24
        out.add(f"{n / 1_000_000:.1f}".rstrip("0").rstrip("."))  # 1.2
        out.add(str(int(round(n / 1_000_000))))                  # 1
    return out


class FinanceScenarioEngine:
    def __init__(self, supabase: Any, resolver: Any) -> None:
        self._sb = supabase
        self._resolver = resolver  # FinancialInputResolver — canonical summary()

    async def compute(
        self,
        ctx: UserContext,
        *,
        home_price_goal: Optional[float] = None,
        monthly_expenses: Optional[float] = None,
        monthly_income: Optional[float] = None,
        monthly_debt_payment: Optional[float] = None,
        savings_goal_amount: Optional[float] = None,
        savings_goal_months: Optional[int] = None,
    ) -> dict[str, Any]:
        """Compute the deterministic scenario packet. All optional params are user/goal-supplied; when absent the
        relevant scenario is returned as a named gap rather than guessed."""
        try:
            s = await self._resolver.summary(ctx)
        except Exception:  # noqa: BLE001 — the engine must never break a turn; it degrades to "no data".
            s = {}
        source = s.get("source") or "Missing"
        cash = _round(s.get("cash_balance")) or 0.0
        invest = _round(s.get("investment_balance")) or 0.0
        retire = _round(s.get("retirement_accounts_total") or s.get("retirement_balance")) or 0.0
        total_assets = _round(s.get("total_assets"))
        total_debt = _round(s.get("total_liabilities") or s.get("total_debt")) or 0.0
        net_worth = _round(s.get("net_worth"))
        has_finance = bool(s.get("accounts_count"))

        allowed: set[str] = set()

        def _keep(*vals: Optional[float]) -> None:
            for v in vals:
                allowed.update(_forms(v))  # exact + rounded forms of each grounded figure

        _keep(cash, invest, retire, total_assets, total_debt, net_worth)

        # ── Net worth ────────────────────────────────────────────────────────────────────────────────────
        net_worth_block = {
            "value": net_worth,
            "total_assets": total_assets,
            "total_liabilities": total_debt,
            "cash": cash,
            "investments": invest,
            "retirement": retire,
            "available": has_finance,
            "source": source,
        }

        # ── Cash flow (needs both income and expenses; honest gap otherwise) ──────────────────────────────
        cash_flow = {
            "monthly_income": _round(monthly_income),
            "monthly_expenses": _round(monthly_expenses),
            "monthly_surplus": (
                _round(monthly_income - monthly_expenses)
                if (monthly_income is not None and monthly_expenses is not None)
                else None
            ),
            "needs_income": monthly_income is None,
            "needs_expense_budget": monthly_expenses is None,
        }
        _keep(cash_flow["monthly_income"], cash_flow["monthly_expenses"], cash_flow["monthly_surplus"])

        # ── Emergency fund (3–6 months of expenses; range None until expenses are known) ──────────────────
        lo, hi = _EMERGENCY_MONTHS
        ef_low = _round(monthly_expenses * lo) if monthly_expenses is not None else None
        ef_high = _round(monthly_expenses * hi) if monthly_expenses is not None else None
        months_covered = (
            _round(cash / monthly_expenses) if (monthly_expenses and monthly_expenses > 0) else None
        )
        emergency_fund = {
            "months_low": lo,
            "months_high": hi,
            "target_low": ef_low,
            "target_high": ef_high,
            "current_cash": cash,
            "months_covered": months_covered,
            "needs_expense_budget": monthly_expenses is None,
        }
        _keep(ef_low, ef_high, months_covered)

        # ── Down payment scenarios (5/10/20% of the stated home price goal) ───────────────────────────────
        down_payment: Optional[dict[str, Any]] = None
        if home_price_goal and home_price_goal > 0:
            tiers = {}
            for p in _DOWN_PAYMENT_TIERS:
                amt = _round(home_price_goal * p / 100.0)
                cash_after = _round(cash - (amt or 0))
                tiers[f"pct_{p}"] = {
                    "amount": amt,
                    "cash_remaining_after": cash_after,
                    "pmi_likely": p < _PMI_THRESHOLD_PCT,
                }
                _keep(amt, cash_after)
            down_payment = {
                "home_price_goal": _round(home_price_goal),
                "tiers": tiers,
                "pmi_threshold_pct": _PMI_THRESHOLD_PCT,
                "note": "PMI (private mortgage insurance) is generally required on conventional loans below "
                        f"{_PMI_THRESHOLD_PCT}% down.",
            }
            _keep(_round(home_price_goal))
        else:
            down_payment = {"needs_home_price_goal": True}

        # ── Debt payoff timeline (months at a given monthly payment; ignores interest → labeled) ───────────
        debt_payoff: dict[str, Any]
        if total_debt <= 0:
            debt_payoff = {"total_debt": 0.0, "months_to_payoff": 0, "note": "No debt on record."}
        elif monthly_debt_payment and monthly_debt_payment > 0:
            import math
            months = math.ceil(total_debt / monthly_debt_payment)
            debt_payoff = {
                "total_debt": total_debt,
                "monthly_payment": _round(monthly_debt_payment),
                "months_to_payoff": months,
                "note": "Simplified (excludes interest) — a precise payoff needs each debt's APR.",
            }
            _keep(months)
        else:
            debt_payoff = {"total_debt": total_debt, "needs_monthly_payment": True}

        # ── Savings target (monthly to reach a goal by a horizon) ─────────────────────────────────────────
        savings_target: dict[str, Any]
        if savings_goal_amount and savings_goal_months and savings_goal_months > 0:
            import math
            monthly = math.ceil(savings_goal_amount / savings_goal_months)
            savings_target = {
                "goal_amount": _round(savings_goal_amount),
                "months": savings_goal_months,
                "monthly_required": monthly,
            }
            _keep(monthly, _round(savings_goal_amount))
        else:
            savings_target = {"needs_goal_and_horizon": True}

        # ── Affordability band (lender rule-of-thumb multiple on annual income; NOT advice) ───────────────
        annual_income = (monthly_income * 12) if monthly_income is not None else None
        affordability_band: dict[str, Any]
        if annual_income:
            lo_m, hi_m = _AFFORDABILITY_INCOME_MULTIPLE
            affordability_band = {
                "annual_income": _round(annual_income),
                "band_low": _round(annual_income * lo_m),
                "band_high": _round(annual_income * hi_m),
                "multiple_low": lo_m,
                "multiple_high": hi_m,
                "note": "A rough lender rule-of-thumb band on income — NOT a personalized approval or advice. "
                        "Actual affordability depends on your full budget, rates, debts, and down payment.",
            }
            _keep(affordability_band["band_low"], affordability_band["band_high"], affordability_band["annual_income"])
        else:
            affordability_band = {"needs_income": True}

        return {
            "available": has_finance,
            "net_worth": net_worth_block,
            "cash_flow": cash_flow,
            "emergency_fund": emergency_fund,
            "down_payment": down_payment,
            "debt_payoff": debt_payoff,
            "savings_target": savings_target,
            "affordability_band": affordability_band,
            "source": source,
            # The flat set of computed figures the validator may allow the LLM to echo (grounding, not a gate).
            "allowed_numbers": sorted(allowed),
            # Hard constraints for the interpretation layer (LLM) — carried into the prompt/guardrails.
            "constraints": [
                "Do not provide tax, legal, or investment advice.",
                "Do not fabricate missing income or expenses — if a figure is marked needs_*, ask for it.",
                "Only cite the numbers in this packet; do not invent new personal figures.",
                "Recommend a licensed professional for tax/legal/estate/insurance decisions.",
                "Ask exactly one useful next question.",
            ],
        }
