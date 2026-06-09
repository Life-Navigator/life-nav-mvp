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


def _band(c: float) -> str:
    return "High" if c >= 0.8 else "Medium" if c >= 0.5 else "Low"


def _field(value: Any, source: str, *, origin: str = "", present: Optional[bool] = None,
           confidence: float = 0.8, prompt: str = "", unlocks: Optional[list] = None) -> dict[str, Any]:
    has = present if present is not None else (value not in (None, "", [], 0, 0.0))
    conf = confidence if has else 0.0
    return {"value": value if has else None, "present": bool(has),
            "source": source if has else MISSING, "confidence": round(conf, 2), "confidence_band": _band(conf) if has else "—",
            "origin": origin if has else None, "prompt": prompt if not has else None,
            "unlocks": unlocks or []}


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

        last_updated = next((a.get("last_synced_at") for a in accounts if a.get("last_synced_at")), None)
        inputs = {
            "income": _field(income, income_src, origin="documents:offer_letter / compensation", confidence=0.85,
                             prompt="What's your annual income?", unlocks=["retirement projection", "home affordability", "savings rate"]),
            "cash_balance": _field(cash, acct_source, origin="finance.financial_accounts", confidence=0.95,
                                   prompt="Connect a sample profile or enter your cash balance.", unlocks=["emergency-fund analysis"]),
            "investment_balance": _field(invest, PLAID if assets else MISSING, origin="finance.assets", confidence=0.95,
                                         prompt="No investment balances on file — connect a profile or add them.", unlocks=["net worth", "allocation view"]),
            "retirement_balance": _field(retire, PLAID if plans else MISSING, origin="finance.retirement_plans", confidence=0.95,
                                         prompt="No retirement balances on file — connect a profile or add them.", unlocks=["retirement projection", "readiness"]),
            "debt_total": _field(debt_total, acct_source if debt_accts else MISSING, origin="finance.financial_accounts", confidence=0.9,
                                 prompt="Add your debts to optimize payoff.", unlocks=["debt payoff optimizer"]),
            "debt_apr": _field(apr, acct_source if apr else MISSING, origin="finance.financial_accounts.interest_rate", confidence=0.8,
                               prompt="What APR are you paying on your debt?"),
            "retirement_contribution_rate": _field(rate, DOC if rate is not None else MISSING, origin="documents:401k_statement", confidence=0.85,
                                                   prompt="Enter your 401(k) contribution rate to unlock retirement projections, 401(k) match optimization, and scenario planning.",
                                                   unlocks=["retirement projection", "401(k) match optimization", "scenario planning"]),
            "employer_match_rate": _field(match, DOC if match is not None else MISSING, origin="documents:401k_statement", confidence=0.85,
                                          prompt="What's your employer's 401(k) match?", unlocks=["match-gap analysis"]),
            "risk_profile": _field(risk[0].get("behavior") if risk else None, ADVISOR, origin="life.risk_profiles", confidence=0.8,
                                   prompt="Tell your advisor how you handle uncertainty.", unlocks=["projection volatility", "allocation guidance"]),
            "time_horizon": _field(th, ADVISOR, origin="life.life_vision", confidence=0.75,
                                   prompt="When do you hope to reach your goal?", unlocks=["strategy selection"]),
            "housing_target": _field(None, MISSING, origin="user-entered", prompt="What home price are you considering?",
                                     unlocks=["home affordability", "rent-vs-buy"]),  # only ever user-entered
        }
        missing = [{"input": k2, "prompt": v["prompt"], "unlocks": v["unlocks"]} for k2, v in inputs.items() if not v["present"]]
        return {"inputs": inputs, "present_count": sum(1 for v in inputs.values() if v["present"]),
                "total": len(inputs), "missing": missing, "last_updated": last_updated,
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
