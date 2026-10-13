"""Financial Input Resolver (Elite Sprint 45).

The single canonical place every tool, scenario, and finance dashboard resolves its inputs from —
always Supabase, never a frontend default. Each input returns {value, present, source, confidence}
where source is one of: Plaid sandbox persona / Uploaded document / Advisor onboarding / User-entered
/ Deterministic tool / Missing. Missing inputs are named with a prompt so the UI can ask + persist
the answer before recalculating. Nothing is invented: an absent input is `present: false`, never a
silent default.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import Any, Optional

from ..models.common import UserContext
from . import assumptions as A

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


# The DB stores `married_filing_jointly`; the calculators and the web page both use
# `married_jointly`. `tax.ts` already carries a dbToPageFilingStatus converter for the same reason,
# so this is the THIRD vocabulary for one concept. Normalized here, at the resolver boundary, so
# every consumer downstream sees one spelling — an unnormalized value would be rejected by
# `tax._status()` deep inside a calculator, which reads as a bug rather than a data-shape mismatch.
_FILING_STATUS_ALIASES = {
    "single": "single",
    "married_filing_jointly": "married_jointly",
    "married_jointly": "married_jointly",
    "mfj": "married_jointly",
    "married_filing_separately": "married_separately",
    "married_separately": "married_separately",
    "mfs": "married_separately",
    "head_of_household": "head_of_household",
    "hoh": "head_of_household",
    "qualifying_widow": "married_jointly",
    "qualifying_surviving_spouse": "married_jointly",
}


def _filing_status(raw: Any) -> Optional[str]:
    """Canonical filing status, or None. Never guesses `single`.

    Defaulting to single would be the worst available choice: it halves every bracket threshold and
    the standard deduction, so it OVERSTATES tax for a married filer by thousands — a confident
    wrong number rather than a question.
    """
    if raw is None:
        return None
    return _FILING_STATUS_ALIASES.get(str(raw).strip().lower().replace("-", "_").replace(" ", "_"))


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


# ── Helpers for the tax- and planning-critical inputs ─────────────────────────────────────────────
#
# WHY A COLUMN-NAME FALLBACK IS NOT DEFENSIVE PROGRAMMING FOR ITS OWN SAKE
# ------------------------------------------------------------------------
# `finance.debts` is defined TWICE in the migrations with different column names: 062 uses
# (current_balance, interest_rate) and 117 — whose own comment says "finance.debts was defined in
# 062 but never applied to prod; define here" — uses (balance, apr). Both are CREATE TABLE IF NOT
# EXISTS, so which spelling production actually has depends on which migration ran first, and that
# is not knowable from the repo. Reading one spelling would return nothing and, because `_rows`
# swallows errors, would do so SILENTLY: a user with $40,000 of credit-card debt would look
# debt-free and be told they can afford a larger house. So each figure is read by trying the known
# spellings in order.
def _first(row: dict, *keys: str) -> Optional[float]:
    for k in keys:
        v = _num(row.get(k))
        if v is not None:
            return v
    return None


def _is_long_term(raw: Any) -> Optional[bool]:
    """True when a holding has been held more than a year, or None when the date is unusable.

    THE REASON THIS IS NOT A DETAIL. Long-term gain is taxed at 0/15/20%; short-term gain is taxed
    as ordinary income, up to 37%. Treating one as the other misstates the tax on a sale by more
    than half, so an unparseable date yields None and the holding is reported separately rather
    than assumed long-term — the assumption that happens to flatter the answer.
    """
    if not raw:
        return None
    text = str(raw).strip()[:10]
    try:
        bought = datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None
    return (date.today() - bought).days > 365



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
        # Fetched CONCURRENTLY. This was six sequential awaits and is now thirteen tables; run in
        # series the added tax and planning inputs would have roughly doubled the resolver's
        # latency on every advisor turn, for queries that do not depend on each other.
        (accounts, assets, plans, doc_rows, risk, vis,
         loan_rows, debt_rows, liability_rows, holdings, cashflows, profiles) = await asyncio.gather(
            self._rows("financial_accounts", "finance", uid=uid),
            self._rows("assets", "finance", uid=uid),
            self._rows("retirement_plans", "finance", uid=uid),
            self._rows("documents", "documents", uid=uid),
            self._rows("risk_profiles", "life", uid=uid),
            self._rows("life_vision", "life", uid=uid),
            self._rows("asset_loans", "finance", uid=uid),
            self._rows("debts", "finance", uid=uid),
            self._rows("liabilities", "finance", uid=uid),
            self._rows("investment_holdings", "finance", uid=uid),
            self._rows("cash_flow_snapshots", "finance", uid=uid),
            self._rows("user_financial_profile", "finance", uid=uid),
        )
        docs = {d.get("doc_type"): (d.get("extracted_json") or {}) for d in doc_rows}
        profile = profiles[0] if profiles else {}

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

        # Per-debt rows, so a payoff ORDER can be computed instead of only an aggregate. The
        # calculators need (label, balance, apr); `minimum_payment` is NOT a column on
        # finance.financial_accounts, which is why `debt.payoff_plan` and the DTI `monthly_debts`
        # input remain blocked — see advisor_calc_coverage.
        debt_list = [
            {"label": a.get("account_name") or a.get("account_type") or "debt",
             "balance": _num(a.get("current_balance")) or 0.0,
             "apr": _num(a.get("interest_rate")),
             "account_type": a.get("account_type")}
            for a in debt_accts
            if (_num(a.get("current_balance")) or 0.0) > 0
        ]

        # BALANCE-WEIGHTED average APR, not the first one found.
        #
        # This was `next((_num(a.get("interest_rate")) for a in debt_accts if ...), None)` — the
        # APR of whichever debt account happened to come back first. A user with a 22% credit card
        # and a 4% mortgage got one or the other depending on row order, and `debt.payoff_months`
        # then ran on it: pick the mortgage and the payoff looks years too fast, pick the card and
        # it looks far too slow. Weighting by balance is the only aggregate that means anything
        # when a single blended rate must stand in for several debts.
        _rated = [(d["balance"], d["apr"]) for d in debt_list if d["apr"] is not None]
        _rated_total = sum(b for b, _ in _rated)
        apr = (sum(b * r for b, r in _rated) / _rated_total) if _rated_total else None

        income = None
        if self._comp is not None:
            try:
                income = _num((await self._comp.analyze(ctx))["total_compensation"].get("base"))
            except Exception:  # noqa: BLE001
                income = None
        income_src = DOC if (income and "offer_letter" in docs) else (MISSING if not income else DOC)

        k = docs.get("401k_statement") or {}
        rate = _num(k.get("contribution_rate"))

        # A MATCH HAS TWO NUMBERS. `employer_match_limit_percent` is the share of pay matched UP TO
        # and `employer_match_percent` is the cents per dollar — both have existed in
        # finance.user_financial_profile since migration 062 and NOTHING ever read them. Only the
        # document's single ambiguous `employer_match` was resolved, which every consumer then
        # treated as a dollar-for-dollar cap: for anyone on the market's most common formula,
        # "50% up to 6%", every match figure was DOUBLE.
        match_cap = (_num(profile.get("employer_match_limit_percent"))
                     if profile.get("employer_match_limit_percent") is not None
                     else _num(k.get("employer_match")))
        match_share = _num(profile.get("employer_match_percent"))
        th = (vis[0].get("prompts") or {}).get("time_horizon") if vis else None

        # finance.tax_profiles — the single highest-impact canonical addition: `filing_status`
        # alone unblocks seven tax calculators (see advisor_calc_coverage.coverage_report()).
        tax_rows = await self._rows("tax_profiles", "finance", uid=ctx.user_id)
        tax_row = max(tax_rows, key=lambda r: _num(r.get("tax_year")) or 0) if tax_rows else {}
        filing_status = _filing_status(tax_row.get("filing_status"))
        dependents = _num(tax_row.get("dependents"))
        tax_state = (str(tax_row.get("state")).strip().upper() or None) if tax_row.get("state") else None

        # ── Monthly debt service, for DTI ────────────────────────────────────────────────────
        #
        # WHY AN INCOMPLETE FIGURE IS REPORTED AS MISSING RATHER THAN AS A SUM.
        # `monthly_debts` feeds `housing.max_home_price` and `housing.max_monthly_payment`, where
        # it is SUBTRACTED from the borrower's capacity. Understating it therefore OVERSTATES how
        # much house someone can afford — the single most expensive direction to be wrong in this
        # whole resolver. So a debt whose payment is unknown does not quietly contribute zero: it
        # makes the entire input absent, and the prompt names how many debts need a figure.
        debt_payments: list[dict[str, Any]] = []
        debts_missing_payment: list[str] = []
        for row, label_keys, pay_keys, bal_keys, apr_keys in (
            # Asset-backed loans (mortgage, auto, HELOC) live in their own canonical table, and
            # their `monthly_payment` is the full payment rather than a minimum.
            *[(r, ("loan_type",), ("monthly_payment",), ("current_balance",), ("interest_rate",))
              for r in loan_rows if r.get("is_active") is not False],
            *[(r, ("debt_name", "debt_type"), ("minimum_payment",),
               ("current_balance", "balance"), ("interest_rate", "apr"))
              for r in debt_rows if r.get("is_active") is not False],
            *[(r, ("name", "liability_type"), ("minimum_payment",), ("balance",),
               ("interest_rate",)) for r in liability_rows],
        ):
            label = next((str(row.get(k)) for k in label_keys if row.get(k)), "debt")
            balance = _first(row, *bal_keys) or 0.0
            if balance <= 0:
                continue                      # a cleared debt has no payment to make
            payment = _first(row, *pay_keys)
            if payment is None:
                debts_missing_payment.append(label)
                continue
            # `loan_type` travels with the row because deductibility is per-INSTRUMENT: a
            # mortgage, a HELOC and a card are three different statutory tests on the same dollar
            # of interest, and a flat debt list cannot tell them apart.
            debt_payments.append({"label": label, "balance": balance, "apr": _first(row, *apr_keys),
                                  "minimum_payment": payment,
                                  "loan_type": (row.get("loan_type") or row.get("debt_type")
                                                or row.get("liability_type") or "other")})

        have_debt_data = bool(loan_rows or debt_rows or liability_rows or debt_accts)
        monthly_debts_total = round(sum(d["minimum_payment"] for d in debt_payments), 2)
        # Zero is a REAL, knowable answer — a debt-free borrower — but `_field` treats 0 as absent,
        # so `present` is passed explicitly. Without this a debt-free user, who is in the BEST
        # position to buy, would have been told their debt figure was missing.
        monthly_debts_known = have_debt_data and not debts_missing_payment

        # ── Unrealized capital gain, for tax planning ────────────────────────────────────────────
        gain_long = gain_short = 0.0
        gain_unknown_term = 0.0
        holdings_missing_basis: list[str] = []
        for h in holdings:
            value = _num(h.get("current_value"))
            basis = _num(h.get("cost_basis"))
            symbol = str(h.get("symbol") or h.get("name") or "holding")
            if value is None or basis is None:
                holdings_missing_basis.append(symbol)
                continue
            gain = value - basis
            term = _is_long_term(h.get("purchase_date"))
            if term is True:
                gain_long += gain
            elif term is False:
                gain_short += gain
            else:
                gain_unknown_term += gain
        priced_holdings = [h for h in holdings
                           if _num(h.get("current_value")) is not None
                           and _num(h.get("cost_basis")) is not None]
        total_gain = round(gain_long + gain_short + gain_unknown_term, 2)

        # ── Savings, expenses, and the tax-advantaged account facts ──────────────────────────────
        # Most recent completed period wins; `net_cash_flow` is measured rather than self-reported,
        # so it is preferred over the onboarding figure.
        latest_cf = max(cashflows, key=lambda r: str(r.get("period_end") or ""), default=None) \
            if cashflows else None
        annual_savings = None
        savings_origin = ""
        if latest_cf is not None and _num(latest_cf.get("net_cash_flow")) is not None:
            annual_savings = round((_num(latest_cf.get("net_cash_flow")) or 0.0) * 12, 2)
            savings_origin = "finance.cash_flow_snapshots.net_cash_flow (x12)"
        elif _num(profile.get("monthly_discretionary_income")) is not None:
            annual_savings = round((_num(profile.get("monthly_discretionary_income")) or 0.0) * 12, 2)
            savings_origin = "finance.user_financial_profile.monthly_discretionary_income (x12)"

        monthly_expenses_val = _num(profile.get("monthly_expenses"))
        expenses_origin = "finance.user_financial_profile.monthly_expenses"
        if monthly_expenses_val is None and latest_cf is not None:
            monthly_expenses_val = _num(latest_cf.get("total_expenses"))
            expenses_origin = "finance.cash_flow_snapshots.total_expenses"

        # ── VA disability, already parsed and never carried forward ──────────────────────────────
        # `military.py` has read `disability_rating` off a parsed VA award letter since Sprint 20
        # and nothing ever carried it to the advisor — so the advisor could not state a veteran's
        # largest, most certain and entirely tax-free income line.
        # ── Itemized deduction components (migration 20261012000000) ────────────────────────────
        # Stored as amounts PAID, never pre-capped: the SALT cap, its MAGI phase-down and the 7.5%
        # medical floor are applied by `tax.itemized_deductions` on every run, so a change in the
        # law reaches the user's answer without touching their record.
        itemized_components = {
            "state_local_taxes": _num(tax_row.get("state_local_taxes_paid")),
            "mortgage_interest": _num(tax_row.get("mortgage_interest_paid")),
            "charitable_contributions": _num(tax_row.get("charitable_contributions")),
            "medical_expenses": _num(tax_row.get("medical_expenses_paid")),
            "other_itemized": _num(tax_row.get("other_itemized_deductions")),
        }
        stated_components = {k: v for k, v in itemized_components.items() if v is not None}
        agi = _num(tax_row.get("adjusted_gross_income"))
        magi_val = _num(tax_row.get("modified_agi"))
        qualifying_children = _num(tax_row.get("qualifying_children_under_17"))
        student_loan_interest = _num(tax_row.get("student_loan_interest_paid"))

        va_doc = docs.get("va_award_letter") or {}
        va_rating = _num(va_doc.get("disability_rating"))
        if va_rating is not None and 0 < va_rating <= 1:
            va_rating = va_rating * 100          # a rating stored as 0.70 rather than 70
        va_rating = round(va_rating) if va_rating is not None else None

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
            "debt_apr": _field(apr, acct_source if apr else MISSING,
                               origin="finance.financial_accounts.interest_rate (balance-weighted)",
                               confidence=0.8,
                               prompt="What APR are you paying on your debt?"),
            "debt_list": _field(debt_list or None, acct_source if debt_list else MISSING,
                                origin="finance.financial_accounts (per-debt)", confidence=0.9,
                                prompt="Add your individual debts so we can work out which to attack first.",
                                unlocks=["payoff order (avalanche)", "interest saved by reordering"]),
            "retirement_contribution_rate": _field(rate, DOC if rate is not None else MISSING, origin="documents:401k_statement", confidence=0.85,
                                                   prompt="Enter your 401(k) contribution rate to unlock retirement projections, 401(k) match optimization, and scenario planning.",
                                                   unlocks=["retirement projection", "401(k) match optimization", "scenario planning"]),
            "employer_match_rate": _field(
                match_cap, DOC if match_cap is not None else MISSING,
                origin=("finance.user_financial_profile.employer_match_limit_percent"
                        if profile.get("employer_match_limit_percent") is not None
                        else "documents:401k_statement"),
                confidence=0.85,
                prompt="What's your employer's 401(k) match? (e.g. 50% of the first 6% of pay)",
                unlocks=["match-gap analysis"]),
            "employer_match_percent": _field(
                match_share, ADVISOR, present=match_share is not None,
                origin="finance.user_financial_profile.employer_match_percent", confidence=0.9,
                prompt=("How much does your employer match per dollar — all of it, or half? "
                        "'50% up to 6%' pays half as much as 'up to 6%'."),
                unlocks=["accurate match value", "true return on contributing"]),
            "risk_profile": _field(risk[0].get("behavior") if risk else None, ADVISOR, origin="life.risk_profiles", confidence=0.8,
                                   prompt="Tell your advisor how you handle uncertainty.", unlocks=["projection volatility", "allocation guidance"]),
            "time_horizon": _field(th, ADVISOR, origin="life.life_vision", confidence=0.75,
                                   prompt="When do you hope to reach your goal?", unlocks=["strategy selection"]),
            "housing_target": _field(None, MISSING, origin="user-entered", prompt="What home price are you considering?",
                                     unlocks=["home affordability", "rent-vs-buy"]),  # only ever user-entered
            "filing_status": _field(filing_status, DOC if filing_status else MISSING,
                                    origin="finance.tax_profiles.filing_status", confidence=0.95,
                                    prompt="How do you file — single, married filing jointly, married filing separately, or head of household?",
                                    unlocks=["federal tax", "FICA", "marginal rate", "capital gains",
                                             "state tax", "credits", "standard vs itemized"]),
            "dependents": _field(dependents, DOC if dependents is not None else MISSING,
                                 origin="finance.tax_profiles.dependents", confidence=0.9,
                                 prompt="How many dependents do you claim?",
                                 unlocks=["child tax credit", "credit phase-outs"]),
            "tax_state": _field(tax_state, DOC if tax_state else MISSING,
                                origin="finance.tax_profiles.state", confidence=0.95,
                                prompt="Which state do you file in?", unlocks=["state income tax"]),

            # ── Added 2026-10-12: the tax and financial-planning inputs ─────────────────────────
            "monthly_debts": _field(
                monthly_debts_total, MANUAL, present=monthly_debts_known,
                origin="finance.asset_loans.monthly_payment + finance.debts.minimum_payment + "
                       "finance.liabilities.minimum_payment",
                confidence=0.9,
                prompt=(f"What are the minimum monthly payments on {len(debts_missing_payment)} of "
                        f"your debts ({', '.join(debts_missing_payment[:3])})? Without them we "
                        f"would understate your obligations and overstate what you can borrow."
                        if debts_missing_payment else
                        "Add your debts and their monthly payments to unlock home affordability."),
                unlocks=["home affordability", "max monthly payment", "debt-to-income"]),
            "debt_minimum_payments": _field(
                debt_payments or None, MANUAL, present=bool(debt_payments) and monthly_debts_known,
                origin="finance.debts + finance.liabilities + finance.asset_loans (per-debt)",
                confidence=0.9,
                prompt="Add the minimum payment on each debt so we can build a payoff plan.",
                unlocks=["payoff plan", "avalanche vs snowball", "interest saved"]),
            "capital_gain": _field(
                total_gain, MANUAL, present=bool(priced_holdings),
                origin="finance.investment_holdings (current_value - cost_basis)", confidence=0.85,
                prompt=("Add the cost basis for your holdings so we can work out the tax on a sale."
                        if holdings else
                        "Add your investment holdings to unlock capital-gains planning."),
                unlocks=["tax on a sale", "tax-gain harvesting", "bracket planning"]),
            "capital_gain_long_term": _field(
                round(gain_long, 2), MANUAL, present=bool(priced_holdings),
                origin="finance.investment_holdings held > 1 year", confidence=0.85,
                prompt="Add purchase dates so we can split long- from short-term gain.",
                unlocks=["0/15/20% long-term rates"]),
            "capital_gain_short_term": _field(
                round(gain_short, 2), MANUAL, present=bool(priced_holdings),
                origin="finance.investment_holdings held <= 1 year", confidence=0.85,
                prompt="Add purchase dates so we can split long- from short-term gain.",
                unlocks=["short-term gain taxed as ordinary income"]),
            "annual_savings": _field(
                annual_savings, MANUAL, present=annual_savings is not None,
                origin=savings_origin, confidence=0.85,
                prompt="How much are you saving each month?",
                unlocks=["savings rate", "goal funding"]),
            "monthly_expenses": _field(
                monthly_expenses_val, ADVISOR if monthly_expenses_val is not None else MISSING,
                present=monthly_expenses_val is not None, origin=expenses_origin, confidence=0.85,
                prompt="What do you spend in a typical month?",
                unlocks=["monthly surplus", "emergency-fund months", "savings rate"]),
            "va_disability_rating": _field(
                va_rating, DOC, present=va_rating is not None,
                origin="documents:va_award_letter.disability_rating", confidence=0.9,
                prompt="What is your VA combined disability rating?",
                unlocks=["VA compensation (tax-free)", "survivor income cliff"]),
            "hsa_eligible": _field(
                profile.get("hsa_eligible"), ADVISOR,
                present=profile.get("hsa_eligible") is not None,
                origin="finance.user_financial_profile.hsa_eligible", confidence=0.85,
                prompt="Are you covered by a high-deductible health plan (HSA-eligible)?",
                unlocks=["HSA triple-tax treatment", "HDHP vs PPO comparison"]),
            "hsa_balance": _field(
                _num(profile.get("hsa_current_balance")), ADVISOR,
                present=_num(profile.get("hsa_current_balance")) is not None,
                origin="finance.user_financial_profile.hsa_current_balance", confidence=0.85,
                prompt="What is your current HSA balance?", unlocks=["HSA as a retirement account"]),
            "itemized_components": _field(
                stated_components or None, DOC, present=bool(stated_components),
                origin="finance.tax_profiles (state_local_taxes_paid, mortgage_interest_paid, "
                       "charitable_contributions, medical_expenses_paid, other_itemized_deductions)",
                confidence=0.9,
                prompt=("What did you pay in state and local taxes, mortgage interest, charitable "
                        "gifts and unreimbursed medical costs? We apply the caps — you give the "
                        "amounts paid."),
                unlocks=["itemize vs standard deduction", "SALT cap and phase-down",
                         "medical-expense floor", "bunching strategy"]),
            "adjusted_gross_income": _field(
                agi, DOC, present=agi is not None,
                origin="finance.tax_profiles.adjusted_gross_income", confidence=0.95,
                prompt="What was your adjusted gross income? It sets the medical-expense floor.",
                unlocks=["medical-expense deduction", "itemize vs standard"]),
            "qualifying_children": _field(
                int(qualifying_children) if qualifying_children is not None else None, DOC,
                present=qualifying_children is not None,
                origin="finance.tax_profiles.qualifying_children_under_17", confidence=0.95,
                prompt=("How many of your dependents are children under 17? The child credit is "
                        "$2,200 and the other-dependent credit is $500, so the split changes the "
                        "number."),
                unlocks=["child tax credit", "other-dependent credit"]),
            "modified_agi": _field(
                magi_val, DOC, present=magi_val is not None,
                origin="finance.tax_profiles.modified_agi", confidence=0.95,
                prompt="What is your modified AGI? It drives the SALT phase-down above $505,000.",
                unlocks=["SALT phase-down"]),
            # ── Inputs the B2 treatment rules test against (migration 20261012010000) ──────────
            "health_coverage_tier": _field(
                profile.get("health_coverage_tier"), ADVISOR,
                present=bool(profile.get("health_coverage_tier")),
                origin="finance.user_financial_profile.health_coverage_tier", confidence=0.9,
                prompt="Is your health coverage self-only or family?",
                unlocks=["HDHP qualification", "HSA contribution limit"]),
            "hdhp_annual_deductible": _field(
                _num(profile.get("hdhp_annual_deductible")), ADVISOR,
                present=_num(profile.get("hdhp_annual_deductible")) is not None,
                origin="finance.user_financial_profile.hdhp_annual_deductible", confidence=0.9,
                prompt="What is your health plan's annual deductible?",
                unlocks=["HDHP qualification"]),
            "hdhp_out_of_pocket_max": _field(
                _num(profile.get("hdhp_out_of_pocket_max")), ADVISOR,
                present=_num(profile.get("hdhp_out_of_pocket_max")) is not None,
                origin="finance.user_financial_profile.hdhp_out_of_pocket_max", confidence=0.9,
                prompt="What is your plan's out-of-pocket maximum?",
                unlocks=["HDHP qualification"]),
            "hsa_annual_contribution": _field(
                _num(profile.get("hsa_annual_contribution")), ADVISOR,
                present=_num(profile.get("hsa_annual_contribution")) is not None,
                origin="finance.user_financial_profile.hsa_annual_contribution", confidence=0.9,
                prompt="How much are you putting into your HSA this year?",
                unlocks=["HSA triple-tax treatment", "excess-contribution warning"]),
            "hsa_through_payroll": _field(
                profile.get("hsa_through_payroll"), ADVISOR,
                present=profile.get("hsa_through_payroll") is not None,
                origin="finance.user_financial_profile.hsa_through_payroll", confidence=0.9,
                prompt=("Do your HSA contributions come out of payroll? Payroll contributions "
                        "escape FICA as well as income tax."),
                unlocks=["FICA saving on HSA contributions"]),
            "hsa_employer_contribution": _field(
                _num(profile.get("hsa_employer_contribution")), ADVISOR,
                present=_num(profile.get("hsa_employer_contribution")) is not None,
                origin="finance.user_financial_profile.hsa_employer_contribution", confidence=0.9,
                prompt="Does your employer contribute to your HSA, and how much?",
                unlocks=["room left under the HSA limit"]),
            "fsa_type": _field(
                profile.get("fsa_type"), ADVISOR, present=bool(profile.get("fsa_type")),
                origin="finance.user_financial_profile.fsa_type", confidence=0.9,
                prompt=("Is your FSA general-purpose or limited-purpose? A general-purpose FSA "
                        "disqualifies an HSA for the whole plan year."),
                unlocks=["HSA/FSA compatibility"]),
            "covered_by_workplace_plan": _field(
                profile.get("covered_by_workplace_plan"), ADVISOR,
                present=profile.get("covered_by_workplace_plan") is not None,
                origin="finance.user_financial_profile.covered_by_workplace_plan", confidence=0.9,
                prompt=("Are you covered by a retirement plan at work? It decides whether a "
                        "traditional IRA contribution is deductible at your income."),
                unlocks=["traditional IRA deductibility"]),
            "student_loan_interest": _field(
                student_loan_interest, DOC, present=student_loan_interest is not None,
                origin="finance.tax_profiles.student_loan_interest_paid", confidence=0.95,
                prompt="What student-loan interest did you pay? It is box 1 on Form 1098-E.",
                unlocks=["student-loan interest deduction"]),
            "fsa_election": _field(
                _num(profile.get("fsa_election_amount")), ADVISOR,
                present=_num(profile.get("fsa_election_amount")) is not None,
                origin="finance.user_financial_profile.fsa_election_amount", confidence=0.85,
                prompt="How much did you elect to your FSA this year?",
                unlocks=["limited-purpose FSA alongside an HSA", "use-it-or-lose-it timing"]),
        }
        # Provenance the calculators need but that is not itself an input: WHICH figures were
        # incomplete, so the advisor can say "this excludes two holdings with no cost basis" rather
        # than presenting a partial total as a complete one.
        caveats = {
            "debts_missing_payment": debts_missing_payment,
            "holdings_missing_cost_basis": holdings_missing_basis,
            "capital_gain_unknown_term": round(gain_unknown_term, 2),
            "capital_gain_is_unrealized": True,
            "itemized_components_stated": sorted(stated_components),
            "itemized_components_absent": sorted(set(itemized_components) - set(stated_components)),
        }
        missing = [{"input": k2, "prompt": v["prompt"], "unlocks": v["unlocks"]} for k2, v in inputs.items() if not v["present"]]
        return {"inputs": inputs, "present_count": sum(1 for v in inputs.values() if v["present"]),
                "total": len(inputs), "missing": missing, "last_updated": last_updated,
                "caveats": caveats,
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
        # Phase A (R2): was an inline `6.0`. A contribution rate the user never stated is an
        # assumption, and an assumption must be citable and visible.
        rate = (i["retirement_contribution_rate"]["value"] if i["retirement_contribution_rate"]["present"]
                else A.value("default_contribution_rate_pct"))
        contribution = round((income or 0) * (float(rate) / 100), 2) if income else 0.0
        tool_inputs = {"current_age": int(age),
                       "retirement_age": int(retire_age) if retire_age else int(A.value("retirement_age")),  # type: ignore[arg-type]
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
