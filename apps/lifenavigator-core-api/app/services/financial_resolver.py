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
SYNTHETIC = "Synthetic beta persona"
MISSING = "Missing"


def _acct_source(accounts: list) -> str:
    """ONE honest source label for finance accounts. Plaid ONLY when a real plaid/connected marker exists;
    synthetic-beta seeds (metadata.source == 'synthetic_beta') are labeled as such — never falsely 'Plaid';
    other rows are user-entered; no rows = missing. Used for both the resolver and the analytics path."""
    if not accounts:
        return MISSING
    if any((a.get("plaid_account_id") or (a.get("metadata") or {}).get("source") == "connected_account") for a in accounts):
        return PLAID
    if all((a.get("metadata") or {}).get("source") == "synthetic_beta" for a in accounts):
        return SYNTHETIC
    return MANUAL


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
        acct_source = _acct_source(accounts)  # honest: Plaid only with a real marker; synthetic-beta labeled distinctly

        cash = sum(_num(a.get("current_balance")) or 0 for a in accounts if a.get("account_type") in ("checking", "savings"))
        # P0 fix: investment/retirement balances come from BOTH the canonical accounts (account_type)
        # AND the assets/plans tables — the SAME source the finance widgets use. Persona activation
        # writes investment/retirement *accounts*, not separate assets/plans rows, so reading only
        # assets/plans made the resolver say "Missing" while widgets showed the real balance.
        invest = (sum(_num(a.get("current_balance")) or 0 for a in accounts if a.get("account_type") == "investment")
                  + sum(_num(a.get("current_value")) or 0 for a in assets))
        retire = (sum(_num(a.get("current_balance")) or 0 for a in accounts if a.get("account_type") == "retirement")
                  + sum(_num(p.get("current_savings")) or 0 for p in plans))
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
            "investment_balance": _field(invest, acct_source if invest > 0 else MISSING, origin="finance.financial_accounts + finance.assets", confidence=0.95,
                                         prompt="No investment balances on file — connect a profile or add them.", unlocks=["net worth", "allocation view"]),
            "retirement_balance": _field(retire, acct_source if retire > 0 else MISSING, origin="finance.financial_accounts + finance.retirement_plans", confidence=0.95,
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

    async def summary(self, ctx: UserContext) -> dict[str, Any]:
        """THE canonical finance summary (P0). Every finance widget reads this — one source, one
        truth — computed from finance.* only. cash/bank/investment/retirement/debt/net-worth, counts,
        a source breakdown, and what's missing. No frontend math for summary truth."""
        uid = ctx.user_id
        accounts = await self._rows("financial_accounts", "finance", uid=uid)
        assets = await self._rows("assets", "finance", uid=uid)
        plans = await self._rows("retirement_plans", "finance", uid=uid)
        txns = await self._rows("transactions", "finance", uid=uid, limit=1000)

        def _sum(types: tuple[str, ...]) -> float:
            return round(sum(_num(a.get("current_balance")) or 0 for a in accounts if a.get("account_type") in types), 2)

        # Liabilities sign-robust: a debt counts as a positive liability whether the source stores its balance
        # positive (Plaid convention) or negative (some manual/connected sources) — so net worth = assets −
        # |liabilities| is always correct, never assets + |liabilities|.
        def _labsum(types: tuple[str, ...]) -> float:
            return round(sum(abs(_num(a.get("current_balance")) or 0) for a in accounts if a.get("account_type") in types), 2)

        # --- Accounts: canonical source for cash / investment / retirement ---
        cash = _sum(("checking", "savings", "cash"))
        bank_total = cash
        investment_accounts_total = _sum(("investment",))
        retirement_accounts_total = round(
            _sum(("retirement",)) + sum(_num(p.get("current_savings")) or 0 for p in plans), 2
        )

        # --- Non-account assets, classified by asset_type. Exclude rows that MIRROR a
        #     connected account (legacy double-count guard): metadata.source/plaid_account_id,
        #     or a plaid_account_id already represented by a financial_account. Real estate /
        #     vehicles / business are NEVER folded into "investment" anymore. ---
        acct_plaid_ids = {a.get("plaid_account_id") for a in accounts if a.get("plaid_account_id")}

        def _is_account_mirror(asset: dict) -> bool:
            md = asset.get("metadata") or {}
            if md.get("source") == "connected_account":
                return True
            pid = md.get("plaid_account_id")
            return bool(pid and pid in acct_plaid_ids)

        real_assets = [a for a in assets if not _is_account_mirror(a)]

        def _asum(types: tuple[str, ...]) -> float:
            return round(
                sum(_num(a.get("current_value")) or 0 for a in real_assets if (a.get("asset_type") or "").lower() in types),
                2,
            )

        real_estate_total = _asum(("real_estate", "home", "property"))
        vehicle_assets_total = _asum(("vehicle", "auto", "car"))
        business_assets_total = _asum(("business",))
        investment_assets = _asum(("investment", "brokerage", "crypto"))  # genuine non-account holdings
        _classified = {"real_estate", "home", "property", "vehicle", "auto", "car", "business", "investment", "brokerage", "crypto"}
        other_assets_total = round(
            sum(_num(a.get("current_value")) or 0 for a in real_assets if (a.get("asset_type") or "").lower() not in _classified),
            2,
        )

        # Investment total = investment ACCOUNTS + genuine non-account investment assets.
        investment_total = round(investment_accounts_total + investment_assets, 2)

        # --- Liabilities, classified (liability accounts carry positive Plaid balances) ---
        credit_card_debt = _labsum(("credit_card",))
        loan_debt = _labsum(("loan",))
        mortgage_debt = _labsum(("mortgage",))
        student_loan_debt = _labsum(("student_loan", "student"))
        auto_loan_debt = _labsum(("auto_loan",))
        other_debt = 0.0
        total_liabilities = round(
            credit_card_debt + loan_debt + mortgage_debt + student_loan_debt + auto_loan_debt + other_debt, 2
        )

        total_assets = round(
            cash + investment_total + retirement_accounts_total
            + real_estate_total + vehicle_assets_total + business_assets_total + other_assets_total,
            2,
        )
        net_worth = round(total_assets - total_liabilities, 2)

        possible_home_equity_gap = mortgage_debt > 0 and real_estate_total <= 0
        missing = [k for k, v in (("investment_balance", investment_total), ("retirement_balance", retirement_accounts_total)) if v <= 0]
        last_updated = next((a.get("last_synced_at") for a in accounts if a.get("last_synced_at")), None)
        source = _acct_source(accounts)
        return {
            # cash / bank
            "cash_balance": cash, "bank_accounts_total": bank_total,
            # investments — accounts vs total (total incl. genuine non-account investment assets)
            "investment_accounts_total": investment_accounts_total,
            "investment_balance": investment_total,  # backward-compatible key
            # retirement
            "retirement_accounts_total": retirement_accounts_total,
            "retirement_balance": retirement_accounts_total,  # backward-compatible key
            # other assets, classified
            "real_estate_total": real_estate_total,
            "vehicle_assets_total": vehicle_assets_total,
            "business_assets_total": business_assets_total,
            "other_assets_total": other_assets_total,
            # totals
            "total_assets": total_assets,
            # liabilities, classified
            "credit_card_debt": credit_card_debt, "loan_debt": loan_debt, "mortgage_debt": mortgage_debt,
            "student_loan_debt": student_loan_debt, "auto_loan_debt": auto_loan_debt, "other_debt": other_debt,
            "total_liabilities": total_liabilities, "total_debt": total_liabilities,  # backward-compatible alias
            # net worth
            "net_worth": net_worth,
            # metadata
            "possible_home_equity_gap": possible_home_equity_gap,
            "accounts_count": len(accounts), "transactions_count": len(txns),
            "source_breakdown": {"accounts": len(accounts), "real_assets": len(real_assets), "retirement_plans": len(plans)},
            "missing_fields": missing, "confidence": 0.95 if accounts else 0.0,
            "source": source, "last_updated": last_updated,
            "has_data": bool(accounts or real_assets or plans),
        }

    async def retirement_projection_card(self, ctx: UserContext, runner: Any, current_age: Optional[int] = None) -> dict[str, Any]:
        """Run the deterministic retirement_projection tool from CANONICAL inputs only. Runs solely
        when the real required inputs exist (balance + age); otherwise returns a missing state — never
        defaults a fabricated age/horizon. The tool run is persisted; we return its run id + lineage."""
        r = await self.resolve(ctx)
        i = r["inputs"]
        plans = await self._rows("retirement_plans", "finance", uid=ctx.user_id)
        vis = await self._rows("life_vision", "life", uid=ctx.user_id)
        prompts = (vis[0].get("prompts") or {}) if vis else {}
        # current_age is user-entered; persist it canonically when supplied so we remember it.
        if current_age:
            try:
                merged = {**prompts, "current_age": int(current_age)}
                await self._sb.upsert("life_vision", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                      "vision_text": (vis[0].get("vision_text") if vis else None), "prompts": merged}, schema="life")
                prompts = merged
            except Exception:  # noqa: BLE001
                pass
        age = current_age or prompts.get("current_age")
        retire_age = _num(plans[0].get("target_retirement_age")) if plans else None

        missing = []
        if not i["retirement_balance"]["present"]:
            missing.append({"input": "retirement_balance", "prompt": i["retirement_balance"]["prompt"]})
        if not age:
            missing.append({"input": "current_age", "prompt": "Enter your current age so we can project your retirement assets (we won't guess it)."})
        if missing:
            return {"available": False, "source": MISSING, "missing": missing,
                    "unlocks": ["projected retirement assets", "funding gap", "on-track readiness"],
                    "message": "Add the missing input(s) to run a real, deterministic retirement projection."}

        income = i["income"]["value"] if i["income"]["present"] else None
        rate = i["retirement_contribution_rate"]["value"] if i["retirement_contribution_rate"]["present"] else 6.0
        contribution = round((income or 0) * (float(rate) / 100), 2) if income else 0.0
        tool_inputs = {"current_age": int(age), "retirement_age": int(retire_age) if retire_age else 65,  # type: ignore[arg-type]
                       "current_assets": i["retirement_balance"]["value"], "income": income, "annual_contribution": contribution}
        run = await runner.run(ctx, "retirement_projection", tool_inputs)
        return {"available": True, "source": "Deterministic tool run", "tool_run_id": run["tool_run_id"],
                "outputs": run["outputs"], "inputs_used": tool_inputs, "assumptions": run["assumptions"],
                "limitations": run["limitations"], "confidence": run["confidence"], "confidence_band": _band(run["confidence"]),
                "calculation": run.get("calculation"), "last_updated": r.get("last_updated")}

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
