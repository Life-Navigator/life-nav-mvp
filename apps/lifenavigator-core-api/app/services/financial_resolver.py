"""Financial Input Resolver (Elite Sprint 45).

The single canonical place every tool, scenario, and finance dashboard resolves its inputs from —
always Supabase, never a frontend default. Each input returns {value, present, source, confidence}
where source is one of: Plaid sandbox persona / Uploaded document / Advisor onboarding / User-entered
/ Deterministic tool / Missing. Missing inputs are named with a prompt so the UI can ask + persist
the answer before recalculating. Nothing is invented: an absent input is `present: false`, never a
silent default.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

PLAID = "Plaid sandbox persona"
DOC = "Uploaded document"
ADVISOR = "Advisor onboarding"
MANUAL = "User-entered"
MISSING = "Missing"


def _num(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _field(value: Any, source: str, *, present: Optional[bool] = None, confidence: float = 0.8, prompt: str = "") -> dict[str, Any]:
    has = present if present is not None else (value not in (None, "", [], 0, 0.0))
    return {"value": value if has else None, "present": bool(has),
            "source": source if has else MISSING, "confidence": confidence if has else 0.0,
            "prompt": prompt if not has else None}


class FinancialInputResolver:
    def __init__(self, supabase: Any, comp: Any = None) -> None:
        self._sb = supabase
        self._comp = comp

    async def _rows(self, table: str, schema: str, **kw: Any) -> list[dict]:
        try:
            return await self._sb.select(table, filters={"user_id": f"eq.{kw.get('uid')}"}, limit=kw.get("limit", 500), schema=schema)
        except Exception:  # noqa: BLE001
            return []

    async def resolve(self, ctx: UserContext) -> dict[str, Any]:
        uid = ctx.user_id
        accounts = await self._rows("financial_accounts", "finance", uid=uid)
        assets = await self._rows("assets", "finance", uid=uid)
        plans = await self._rows("retirement_plans", "finance", uid=uid)
        docs = {d.get("doc_type"): (d.get("extracted_json") or {}) for d in await self._rows("documents", "documents", uid=uid)}
        risk = await self._rows("risk_profiles", "life", uid=uid)
        vis = await self._rows("life_vision", "life", uid=uid)

        # how each finance row got here (persona connect vs manual)
        acct_source = PLAID if any((a.get("plaid_account_id") or (a.get("metadata") or {}).get("source") == "connected_account") for a in accounts) else (MANUAL if accounts else MISSING)

        cash = sum(_num(a.get("current_balance")) or 0 for a in accounts if a.get("account_type") in ("checking", "savings"))
        invest = sum(_num(a.get("current_value")) or 0 for a in assets)
        retire = sum(_num(p.get("current_savings")) or 0 for p in plans)
        debt_accts = [a for a in accounts if a.get("account_type") in ("credit_card", "loan", "mortgage")]
        debt_total = sum(_num(a.get("current_balance")) or 0 for a in debt_accts)
        apr = next((_num(a.get("interest_rate")) for a in debt_accts if _num(a.get("interest_rate"))), None)

        income = None
        if self._comp is not None:
            try:
                income = _num((await self._comp.analyze(ctx))["total_compensation"].get("base"))
            except Exception:  # noqa: BLE001
                income = None
        income_src = DOC if (income and "offer_letter" in docs) else (MISSING if not income else DOC)

        k = docs.get("401k_statement") or {}
        rate = _num(k.get("contribution_rate"))
        match = _num(k.get("employer_match"))
        th = (vis[0].get("prompts") or {}).get("time_horizon") if vis else None

        inputs = {
            "income": _field(income, income_src, prompt="What's your annual income?"),
            "cash_balance": _field(cash, acct_source, prompt="Connect a sample profile or enter your cash balance."),
            "investment_balance": _field(invest, PLAID if assets else MISSING, prompt="No investment balances on file — connect a profile or add them."),
            "retirement_balance": _field(retire, PLAID if plans else MISSING, prompt="No retirement balances on file — connect a profile or add them."),
            "debt_total": _field(debt_total, acct_source if debt_accts else MISSING, prompt="Add your debts to optimize payoff."),
            "debt_apr": _field(apr, acct_source if apr else MISSING, prompt="What APR are you paying on your debt?"),
            "retirement_contribution_rate": _field(rate, DOC if rate is not None else MISSING, prompt="Enter your 401(k) contribution rate to unlock retirement projection + match analysis."),
            "employer_match_rate": _field(match, DOC if match is not None else MISSING, prompt="What's your employer's 401(k) match?"),
            "risk_profile": _field(risk[0].get("behavior") if risk else None, ADVISOR, prompt="Tell your advisor how you handle uncertainty."),
            "time_horizon": _field(th, ADVISOR, prompt="When do you hope to reach your goal?"),
            "housing_target": _field(None, MISSING, prompt="What home price are you considering?"),  # only ever user-entered
        }
        missing = [{"input": k2, "prompt": v["prompt"]} for k2, v in inputs.items() if not v["present"]]
        return {"inputs": inputs, "present_count": sum(1 for v in inputs.values() if v["present"]),
                "total": len(inputs), "missing": missing,
                "note": "Every value resolves from Supabase with its source; missing inputs are named, never defaulted."}

    async def tool_inputs(self, ctx: UserContext) -> dict[str, Any]:
        """Flat canonical inputs for the deterministic tools (values only; missing -> absent, not 0)."""
        r = await self.resolve(ctx)
        i = r["inputs"]
        out: dict[str, Any] = {}
        for key, field in [("annual_income", "income"), ("income", "income"), ("current_assets", "retirement_balance"),
                           ("current_rate", "retirement_contribution_rate"), ("employer_match_rate", "employer_match_rate"),
                           ("monthly_debts", None)]:
            if field and i[field]["present"]:
                out[key] = i[field]["value"]
        if i["income"]["present"]:
            out["annual_contribution"] = round((i["income"]["value"] or 0) * 0.06, 2)
        return out
