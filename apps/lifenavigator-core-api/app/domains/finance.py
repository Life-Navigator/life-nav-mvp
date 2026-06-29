"""FinanceService — the reference DomainService.

Returns COMPLETE, frontend-ready view-models. Core rules:
  * user-scoped: every read/write is filtered/stamped with ctx.user_id (from the
    verified JWT, never the request body).
  * no fake zeroes: when data is absent the tiles are ``None`` / ``[]`` and the
    payload carries a ``missing`` list + ``confidence.basis`` so the frontend
    renders a premium "connect/add" prompt — never a misleading $0.
  * service-role writes only (goals / manual asset / manual liability).
  * recommendations follow the H contract (models.common.Recommendation).

Finance tables live in the ``finance`` Postgres schema (PostgREST Accept-Profile).
Snapshot/budget tables are a Phase-1 migration; endpoints that need them return
an honest missing-data state until then.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import (
    ActionStep,
    Confidence,
    DomainChatContext,
    DomainViewModel,
    Evidence,
    Freshness,
    GovernanceVerdict,
    Recommendation,
    SourceRef,
    UserContext,
    WriteResult,
)
from .base import DomainService

FINANCE = "finance"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _money(amount: float, currency: str = "USD") -> dict[str, Any]:
    return {"amount": round(float(amount), 2), "currency": currency}


def _src(table: str) -> SourceRef:
    return SourceRef(system="supabase", table=f"finance.{table}", as_of=_now())


# Stable namespace so a recommendation's row id is deterministic per (user, slug):
# repeated generation upserts the SAME row (idempotent) and keeps a stable graph
# node id, so the evidence subgraph MERGEs in place rather than duplicating.
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000001")


def _rec_id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_REC_NS, f"{user_id}:{slug}"))


class FinanceService(DomainService):
    domain = FINANCE
    entity_types = [
        "financial_account",
        "transaction_summary",
        "asset",
        "debt",
        "investment_holding",
        "retirement_plan",
        "financial_goal",
    ]

    def __init__(self, supabase: SupabaseClient) -> None:
        self._supabase = supabase

    # ----------------------------------------------------------------- reads
    async def _rows(self, table: str, ctx: UserContext, *, limit: int = 200, order: Optional[str] = None) -> list[dict]:
        return await self._supabase.select(
            table,
            columns="*",
            filters={"user_id": f"eq.{ctx.user_id}"},
            limit=limit,
            order=order,
            schema=FINANCE,
        )

    def _vm(
        self,
        ctx: UserContext,
        data: dict[str, Any],
        *,
        sources: list[SourceRef],
        missing: list[str],
        basis: str,
        recommendations: Optional[list[Recommendation]] = None,
    ) -> DomainViewModel:
        return DomainViewModel(
            domain=FINANCE,
            user_id=ctx.user_id,
            generated_at=_now(),
            freshness=Freshness(as_of=_now(), stale=(basis == "missing"), sources=sources),
            confidence=Confidence(
                score={"complete": 0.9, "partial": 0.6, "sparse": 0.3, "missing": 0.0}[basis],
                basis=basis,  # type: ignore[arg-type]
                missing_fields=missing,
            ),
            data=data,
            recommendations=recommendations or [],
            missing=missing,
        )

    @staticmethod
    def _bal(row: dict) -> float:
        for k in ("current_balance", "balance", "value", "market_value", "amount"):
            if row.get(k) is not None:
                try:
                    return float(row[k])
                except (TypeError, ValueError):
                    return 0.0
        return 0.0

    # Liability-type accounts carry POSITIVE balances in Plaid, so they must be
    # SUBTRACTED from net worth, never summed in as assets. This classification
    # MUST stay aligned with the canonical resolver (financial_resolver.summary).
    _LIABILITY_TYPES = {
        "credit_card", "credit", "loan", "mortgage", "student", "student_loan",
        "line_of_credit", "heloc", "auto", "auto_loan",
    }

    @staticmethod
    def _is_liability(row: dict) -> bool:
        return (row.get("account_type") or "").lower() in FinanceService._LIABILITY_TYPES

    async def summary(self, ctx: UserContext) -> DomainViewModel:
        accounts = await self._rows("financial_accounts", ctx)
        if not accounts:
            return self._vm(
                ctx,
                {"net_worth": None, "cash": None, "debt": None, "monthly_income": None,
                 "monthly_expenses": None, "savings_rate": None, "emergency_reserve_months": None,
                 "accounts": [], "top_opportunities": [], "top_risks": [], "next_best_action": None},
                sources=[], missing=["plaid_link"], basis="missing",
            )

        debts = await self._rows("asset_loans", ctx)
        txns = await self._rows("transactions", ctx, limit=500, order="transaction_date.desc")

        cash = sum(self._bal(a) for a in accounts if (a.get("account_type") or "").lower() in {"depository", "checking", "savings", "cash"})
        # Single source of truth: classify accounts into assets vs liabilities the
        # SAME way as the canonical resolver. Liability accounts are subtracted, not
        # added (the old `sum(all accounts)` inflated net worth by every debt balance).
        assets_total = sum(self._bal(a) for a in accounts if not self._is_liability(a))
        account_debt = sum(self._bal(a) for a in accounts if self._is_liability(a))
        debt_total = account_debt
        net_worth = assets_total - debt_total
        income, expense = self._income_expense(txns)
        savings_rate = None
        if income and income > 0:
            savings_rate = round(max(0.0, (income - expense)) / income, 3)
        reserve_months = round(cash / expense, 1) if expense and expense > 0 else None

        recs = await self.recommendations(ctx)
        opportunities = [r.title for r in recs if r.priority in {"high", "medium"}][:3]
        risks = [r.title for r in recs if ("risk" in r.title.lower() or "gap" in r.title.lower())][:3]

        return self._vm(
            ctx,
            {
                "net_worth": _money(net_worth),
                "cash": _money(cash),
                "debt": _money(debt_total) if debt_total else None,
                "monthly_income": _money(income) if income else None,
                "monthly_expenses": _money(expense) if expense else None,
                "savings_rate": savings_rate,
                "emergency_reserve_months": reserve_months,
                "accounts": [self._account_vm(a) for a in accounts],
                "top_opportunities": opportunities,
                "top_risks": risks or [r.title for r in recs][:3],
                "next_best_action": recs[0].title if recs else None,
            },
            sources=[_src("financial_accounts"), _src("transactions"), _src("asset_loans")],
            missing=([] if txns else ["transactions"]) + ([] if debts else []),
            basis="partial",
            recommendations=recs,
        )

    @staticmethod
    def _account_vm(a: dict) -> dict[str, Any]:
        return {
            "id": a.get("id"),
            "name": a.get("name"),
            "institution": a.get("institution_name") or a.get("institution"),
            "type": a.get("account_type"),
            "balance": _money(FinanceService._bal(a), a.get("currency") or "USD"),
        }

    async def accounts(self, ctx: UserContext) -> DomainViewModel:
        rows = await self._rows("financial_accounts", ctx)
        if not rows:
            return self._vm(ctx, {"accounts": []}, sources=[], missing=["plaid_link"], basis="missing")
        return self._vm(ctx, {"accounts": [self._account_vm(a) for a in rows]},
                        sources=[_src("financial_accounts")], missing=[], basis="complete")

    async def transactions(self, ctx: UserContext, *, limit: int = 100) -> DomainViewModel:
        rows = await self._rows("transactions", ctx, limit=limit, order="transaction_date.desc")
        if not rows:
            return self._vm(ctx, {"transactions": []}, sources=[], missing=["transactions"], basis="missing")
        txns = [
            {
                "id": t.get("id"),
                "date": t.get("transaction_date") or t.get("date"),
                "merchant": t.get("merchant") or "",
                "description": t.get("description") or "",
                "amount": _money(self._bal(t), t.get("currency") or "USD"),
                "category": t.get("category") or "Uncategorized",
                "type": t.get("type") or ("income" if self._bal(t) < 0 else "expense"),
            }
            for t in rows
        ]
        return self._vm(ctx, {"transactions": txns, "count": len(txns)},
                        sources=[_src("transactions")], missing=[], basis="complete")

    @staticmethod
    def _income_expense(txns: list[dict]) -> tuple[float, float]:
        # The source column is finance.transactions.transaction_type ('income' |
        # 'expense'); fall back to 'type' for legacy/synthetic rows.
        def _tt(t: dict) -> str:
            return (t.get("transaction_type") or t.get("type") or "").lower()

        income = sum(FinanceService._bal(t) for t in txns if _tt(t) == "income")
        expense = sum(FinanceService._bal(t) for t in txns if _tt(t) == "expense")
        return income, expense

    async def cash_flow(self, ctx: UserContext) -> DomainViewModel:
        txns = await self._rows("transactions", ctx, limit=1000, order="transaction_date.desc")
        if not txns:
            return self._vm(ctx, {"month_income": None, "month_expense": None, "net": None, "daily": []},
                            sources=[], missing=["transactions"], basis="missing")
        income, expense = self._income_expense(txns)
        return self._vm(
            ctx,
            {
                "month_income": _money(income),
                "month_expense": _money(expense),
                "net": _money(income - expense),
                "trend_available": False,  # needs cash_flow_snapshots (Phase 1)
            },
            sources=[_src("transactions")],
            missing=["cash_flow_snapshots"],
            basis="partial",
        )

    async def net_worth(self, ctx: UserContext) -> DomainViewModel:
        accounts = await self._rows("financial_accounts", ctx)
        assets = await self._rows("assets", ctx)
        if not accounts and not assets:
            return self._vm(ctx, {"net_worth": None, "assets_total": None, "liabilities_total": None, "trend": []},
                            sources=[], missing=["plaid_link"], basis="missing")
        # Asset-type accounts + standalone assets count as assets; liability-type
        # accounts (positive Plaid balances) are subtracted. Aligned with the
        # canonical resolver so this can never contradict the canonical summary.
        assets_total = (
            sum(self._bal(a) for a in accounts if not self._is_liability(a))
            + sum(self._bal(a) for a in assets)
        )
        liabilities_total = sum(self._bal(a) for a in accounts if self._is_liability(a))
        return self._vm(
            ctx,
            {
                "net_worth": _money(assets_total - liabilities_total),
                "assets_total": _money(assets_total),
                "liabilities_total": _money(liabilities_total),
                "trend": [],  # needs net_worth_snapshots (Phase 1)
            },
            sources=[_src("financial_accounts"), _src("assets")],
            missing=["net_worth_snapshots"],
            basis="partial",
        )

    async def debt(self, ctx: UserContext) -> DomainViewModel:
        debts = await self._rows("asset_loans", ctx)
        if not debts:
            return self._vm(ctx, {"debts": [], "total": None}, sources=[], missing=["debts"], basis="missing")
        ranked = sorted(debts, key=lambda d: float(d.get("interest_rate") or d.get("apr") or 0), reverse=True)
        return self._vm(
            ctx,
            {
                "total": _money(sum(self._bal(d) for d in debts)),
                "debts": [
                    {
                        "id": d.get("id"),
                        "name": d.get("name") or d.get("loan_name") or "Loan",
                        "balance": _money(self._bal(d)),
                        "apr": float(d.get("interest_rate") or d.get("apr") or 0),
                        "strategy_rank": i + 1,  # avalanche order
                    }
                    for i, d in enumerate(ranked)
                ],
            },
            sources=[_src("asset_loans")], missing=[], basis="complete",
        )

    # Real position only if it's linked to an account OR carries a real source. Persona-seed rows
    # (account_id NULL + empty metadata, identical across users) are synthetic and must NEVER render as a
    # real portfolio (the P0 fake-$1.33M-holdings regression).
    _REAL_HOLDING_SOURCES = {
        "plaid", "plaid_investment_holdings", "manual", "manual_holding",
        "uploaded_statement_extraction", "verified_brokerage", "connected_account",
    }

    @classmethod
    def _holding_has_provenance(cls, h: dict[str, Any]) -> bool:
        if h.get("account_id"):
            return True
        src = str(((h.get("metadata") or {}) if isinstance(h.get("metadata"), dict) else {}).get("source") or "").lower()
        return src in cls._REAL_HOLDING_SOURCES

    async def investments(self, ctx: UserContext) -> DomainViewModel:
        all_holdings = await self._rows("investment_holdings", ctx)
        holdings = [h for h in all_holdings if self._holding_has_provenance(h)]
        if not holdings:
            # Holding-level detail (investment_holdings) is rarely populated; the user's real money lives
            # in connected investment/brokerage ACCOUNTS (finance.financial_accounts). Surface those so the
            # page shows real balances instead of empty. (Root-cause fix: the data was here all along.)
            accts = [a for a in await self._rows("financial_accounts", ctx)
                     if any(t in (a.get("account_type") or "").lower() for t in ("invest", "brokerage"))
                     and a.get("is_active", True)]
            if not accts:
                return self._vm(ctx, {"holdings": [], "total": None}, sources=[], missing=["investments"], basis="missing")
            total = sum(self._bal(a) for a in accts)
            return self._vm(
                ctx,
                {"total": _money(total),
                 "holdings": [{"id": a.get("id"), "name": a.get("account_name") or a.get("name") or "Investment account",
                               "value": _money(self._bal(a)),
                               "share_pct": round(self._bal(a) / total * 100, 1) if total else None}
                              for a in accts]},
                sources=[_src("financial_accounts")], missing=[], basis="complete",
            )
        total = sum(self._bal(h) for h in holdings)
        return self._vm(
            ctx,
            {
                "total": _money(total),
                # REAL position-level holdings: pass through shares/cost_basis/symbol/price so the page can
                # render the full holdings table + analysis. Unknown fields stay None (rendered "Not
                # available") — NEVER coerced to 0. (The account-fallback path above carries no shares, so it
                # reads as account-balance-only.)
                "holdings": [
                    {"id": h.get("id"), "name": h.get("name") or h.get("symbol"),
                     "symbol": h.get("symbol"),
                     "value": _money(self._bal(h)),
                     "shares": h.get("quantity"),
                     "cost_basis": h.get("cost_basis"),
                     "current_price": h.get("current_price"),
                     "sector": h.get("sector"),
                     "share_pct": round(self._bal(h) / total * 100, 1) if total else None}
                    for h in holdings
                ],
            },
            sources=[_src("investment_holdings")], missing=[], basis="complete",
        )

    async def retirement(self, ctx: UserContext) -> DomainViewModel:
        plans = await self._rows("retirement_plans", ctx)
        if not plans:
            # Same root-cause fix as investments: retirement money lives in connected retirement/401k/IRA
            # ACCOUNTS (finance.financial_accounts), not the (empty) retirement_plans table. Surface them.
            accts = [a for a in await self._rows("financial_accounts", ctx)
                     if any(t in (a.get("account_type") or "").lower()
                            for t in ("retire", "401", "403b", "ira", "pension"))
                     and a.get("is_active", True)]
            if not accts:
                return self._vm(ctx, {"accounts": [], "total": None}, sources=[], missing=["retirement_plans"], basis="missing")
            return self._vm(
                ctx,
                {"total": _money(sum(self._bal(a) for a in accts)),
                 "accounts": [{"id": a.get("id"), "name": a.get("account_name") or a.get("name") or a.get("account_type"),
                               "balance": _money(self._bal(a))} for a in accts],
                 "projection_available": False},
                sources=[_src("financial_accounts")], missing=["contribution_rate"], basis="partial",
            )
        return self._vm(
            ctx,
            {
                "total": _money(sum(self._bal(p) for p in plans)),
                "accounts": [{"id": p.get("id"), "name": p.get("name") or p.get("plan_type"),
                              "balance": _money(self._bal(p))} for p in plans],
                "projection_available": False,  # needs contribution modeling (Phase 1)
            },
            sources=[_src("retirement_plans")], missing=["contribution_rate"], basis="partial",
        )

    async def recommendations_view(self, ctx: UserContext) -> DomainViewModel:
        recs = await self.recommendations(ctx)
        return self._vm(
            ctx, {"count": len(recs)},
            sources=[_src("financial_accounts"), _src("asset_loans"), _src("transactions")],
            missing=[] if recs else ["insufficient_data"],
            basis="partial" if recs else "missing",
            recommendations=recs,
        )

    # ------------------------------------------------------- recommendations
    async def recommendations(self, ctx: UserContext) -> list[Recommendation]:
        accounts = await self._rows("financial_accounts", ctx)
        if not accounts:
            return []  # no data → no fabricated advice
        debts = await self._rows("asset_loans", ctx)
        txns = await self._rows("transactions", ctx, limit=1000)
        cash = sum(self._bal(a) for a in accounts if (a.get("account_type") or "").lower() in {"depository", "checking", "savings", "cash"})
        _, expense = self._income_expense(txns)
        revisit = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()

        recs: list[Recommendation] = []

        # 1. Highest-APR debt payoff (avalanche)
        apr_debts = [d for d in debts if float(d.get("interest_rate") or d.get("apr") or 0) > 0]
        if apr_debts:
            top = max(apr_debts, key=lambda d: float(d.get("interest_rate") or d.get("apr") or 0))
            apr = float(top.get("interest_rate") or top.get("apr") or 0)
            recs.append(Recommendation(
                id=f"debt-payoff-{top.get('id')}",
                title="Pay down your highest-interest debt first",
                why_it_matters=f"Your highest-APR balance ({apr:.1f}%) costs the most in interest; clearing it first (avalanche) minimizes total interest paid.",
                evidence=[Evidence(statement=f"{top.get('name') or 'Loan'}: balance ${self._bal(top):,.0f} @ {apr:.1f}% APR", source=_src("asset_loans"))],
                source_tables=["finance.asset_loans"],
                source_graph_nodes=[{"label": "Debt", "entity_id": str(top.get("id"))}],
                assumptions=["APR is fixed", "no prepayment penalty"],
                confidence=Confidence(score=0.8, basis="partial", missing_fields=["minimum_payment"]),
                priority="high",
                affected_domains=["finance"],
                action_steps=[ActionStep(step="Direct extra payments to this balance until cleared", effort="low", impact="high")],
                risks=["Reducing liquidity if you overpay vs. your emergency reserve"],
                revisit_date=revisit,
                generated_by="finance.agent",
                governance_verdict=GovernanceVerdict(passed=True),
            ))

        # 2. Emergency fund gap (needs an expense estimate)
        if expense and expense > 0:
            months = cash / expense
            if months < 3:
                recs.append(Recommendation(
                    id="emergency-fund-gap",
                    title="Close your emergency fund gap",
                    why_it_matters=f"Your liquid reserve covers ~{months:.1f} months of expenses; the planning baseline is 3 months.",
                    evidence=[
                        Evidence(statement=f"Liquid cash ≈ ${cash:,.0f}", source=_src("financial_accounts")),
                        Evidence(statement=f"Monthly expenses ≈ ${expense:,.0f}", source=_src("transactions")),
                    ],
                    source_tables=["finance.financial_accounts", "finance.transactions"],
                    source_graph_nodes=[{"label": "CashFlowSnapshot", "entity_id": "derived"}],
                    assumptions=["recent transactions represent a typical month"],
                    confidence=Confidence(score=0.7, basis="partial", missing_fields=["income_stability"]),
                    priority="high",
                    affected_domains=["finance", "risk"],
                    action_steps=[ActionStep(step=f"Automate savings until reserve ≥ ${expense * 3:,.0f}", effort="low", impact="high")],
                    risks=["Building cash slowly if income is variable"],
                    revisit_date=revisit,
                    generated_by="finance.agent",
                    governance_verdict=GovernanceVerdict(passed=True),
                ))
        return recs

    # -------------------------------------------------- persisted recommendations
    def _rec_row(
        self,
        ctx: UserContext,
        *,
        slug: str,
        rtype: str,
        title: str,
        description: str,
        priority: str,
        confidence: float,
        evidence: list[dict[str, Any]],
        assumptions: list[dict[str, Any]],
        tradeoffs: list[dict[str, Any]],
        governance: dict[str, Any],
        source_tables: list[str],
    ) -> dict[str, Any]:
        """Map a computed recommendation to a finance.financial_recommendations row.

        ``id`` is deterministic (uuid5 of user+slug) so upserts dedup; ``user_id`` /
        ``tenant_id`` come from the verified JWT, never the request body.
        """
        return {
            "id": _rec_id(ctx.user_id, slug),
            "user_id": ctx.user_id,
            "tenant_id": ctx.user_id,
            "title": title,
            "description": description,
            "recommendation_type": rtype,
            "priority": priority,
            "confidence": confidence,
            "governance_verdict": governance,
            "status": "active",
            "evidence_json": evidence,
            "assumptions_json": assumptions,
            "tradeoffs_json": tradeoffs,
            "source_tables": source_tables,
            "source_graph_nodes": [],
            "derived_by": "finance-recommendation-engine",
        }

    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Compute, govern, and idempotently persist recommendation rows with full
        structured evidence/assumptions. Never fabricates: no accounts -> nothing; a
        recommendation is only persisted when it has evidence and required inputs.
        Repeated calls upsert the same deterministic ids (no duplicates)."""
        accounts = await self._rows("financial_accounts", ctx)
        if not accounts:
            return []  # missing inputs -> no recommendation (the view returns a prompt)
        debts = await self._rows("asset_loans", ctx)
        txns = await self._rows("transactions", ctx, limit=1000)
        cash = sum(
            self._bal(a)
            for a in accounts
            if (a.get("account_type") or "").lower()
            in {"depository", "checking", "savings", "cash"}
        )
        _, expense = self._income_expense(txns)
        observed = _now()
        disclaimer = {
            "boundary_type": "financial_planning",
            "disclaimer_text": "General financial planning guidance, not individualized investment advice.",
            "requires_human_review": False,
            "escalation_path": "licensed_advisor",
        }
        rows: list[dict[str, Any]] = []

        # Emergency fund gap — requires a monthly expense estimate.
        if expense and expense > 0:
            months = cash / expense
            target = 3.0
            if months < target:
                gap = expense * target - cash
                rows.append(
                    self._rec_row(
                        ctx,
                        slug="emergency-fund-gap",
                        rtype="emergency_fund",
                        title="Close your emergency fund gap",
                        description=(
                            f"Your liquid reserve covers ~{months:.1f} months of expenses; "
                            f"the planning baseline is {target:.0f} months (gap ≈ ${gap:,.0f})."
                        ),
                        priority="high",
                        confidence=0.7,
                        evidence=[
                            {"metric_name": "cash", "metric_value": round(cash, 2), "source_table": "finance.financial_accounts", "observed_at": observed, "confidence": 1.0, "explanation": "current liquid cash across deposit accounts"},
                            {"metric_name": "monthly_expenses", "metric_value": round(expense, 2), "source_table": "finance.transactions", "observed_at": observed, "confidence": 0.7, "explanation": "recent monthly expense estimate"},
                            {"metric_name": "emergency_reserve_months", "metric_value": round(months, 1), "source_table": "derived", "observed_at": observed, "confidence": 0.7, "explanation": "cash divided by monthly expenses"},
                            {"metric_name": "target_reserve_months", "metric_value": target, "source_table": "policy", "observed_at": observed, "confidence": 1.0, "explanation": "planning baseline of 3 months"},
                            {"metric_name": "gap", "metric_value": round(gap, 2), "source_table": "derived", "observed_at": observed, "confidence": 0.7, "explanation": "target reserve minus current cash"},
                        ],
                        assumptions=[
                            {"assumption_text": "monthly expense estimate remains stable", "confidence": 0.7, "expires_at": None, "user_confirmed": False, "source": "model"},
                            {"assumption_text": "account balances are current as of the latest sync", "confidence": 0.9, "expires_at": None, "user_confirmed": False, "source": "model"},
                            {"assumption_text": "no major upcoming liquidity need unless stated", "confidence": 0.6, "expires_at": None, "user_confirmed": False, "source": "model"},
                        ],
                        tradeoffs=[{"option_a": "build cash reserve first", "option_b": "invest surplus", "benefit": "liquidity and downside protection", "cost": "lower expected return on reserved cash", "affected_domains": ["finance", "risk"]}],
                        governance={"passed": True, **disclaimer},
                        source_tables=["finance.financial_accounts", "finance.transactions"],
                    )
                )

        # Debt avalanche — only when debt data with an APR exists.
        apr_debts = [d for d in debts if float(d.get("interest_rate") or d.get("apr") or 0) > 0]
        if apr_debts:
            top = max(apr_debts, key=lambda d: float(d.get("interest_rate") or d.get("apr") or 0))
            apr = float(top.get("interest_rate") or top.get("apr") or 0)
            bal = self._bal(top)
            rows.append(
                self._rec_row(
                    ctx,
                    slug=f"debt-payoff-{top.get('id')}",
                    rtype="debt_optimization",
                    title="Pay down your highest-interest debt first",
                    description=(
                        f"Your highest-APR balance ({apr:.1f}%) costs the most in interest; "
                        "clearing it first (avalanche) minimizes total interest paid."
                    ),
                    priority="high",
                    confidence=0.8,
                    evidence=[
                        {"metric_name": "apr", "metric_value": round(apr, 2), "source_table": "finance.asset_loans", "source_entity_id": str(top.get("id")), "observed_at": observed, "confidence": 1.0, "explanation": "highest-APR balance"},
                        {"metric_name": "balance", "metric_value": round(bal, 2), "source_table": "finance.asset_loans", "source_entity_id": str(top.get("id")), "observed_at": observed, "confidence": 1.0, "explanation": "outstanding balance"},
                    ],
                    assumptions=[
                        {"assumption_text": "APR is fixed", "confidence": 0.8, "expires_at": None, "user_confirmed": False, "source": "model"},
                        {"assumption_text": "no prepayment penalty", "confidence": 0.7, "expires_at": None, "user_confirmed": False, "source": "model"},
                    ],
                    tradeoffs=[{"option_a": "avalanche (highest APR first)", "option_b": "snowball (smallest balance first)", "benefit": "minimizes total interest paid", "cost": "fewer early psychological wins", "affected_domains": ["finance"]}],
                    governance={"passed": True, **disclaimer},
                    source_tables=["finance.asset_loans"],
                )
            )

        persisted: list[dict[str, Any]] = []
        for row in rows:
            if not row["evidence_json"]:
                continue  # never persist a recommendation without evidence
            res = await self._supabase.upsert("financial_recommendations", row, schema=FINANCE)
            if res:
                persisted.append(res[0])
        return persisted

    # ---------------------------------------------------------------- writes
    async def create_goal(self, ctx: UserContext, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k != "user_id"}
        row["user_id"] = ctx.user_id  # identity from JWT, never the body
        inserted = await self._supabase.insert("financial_goals", row, schema=FINANCE)
        if not inserted:
            return WriteResult(ok=False, detail="write failed or not configured")
        return WriteResult(ok=True, entity_id=str(inserted[0].get("id")) if inserted else None)

    async def manual_asset(self, ctx: UserContext, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k != "user_id"}
        row["user_id"] = ctx.user_id
        inserted = await self._supabase.insert("assets", row, schema=FINANCE)
        if not inserted:
            return WriteResult(ok=False, detail="write failed or not configured")
        return WriteResult(ok=True, entity_id=str(inserted[0].get("id")) if inserted else None)

    async def manual_liability(self, ctx: UserContext, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k != "user_id"}
        row["user_id"] = ctx.user_id
        inserted = await self._supabase.insert("asset_loans", row, schema=FINANCE)
        if not inserted:
            return WriteResult(ok=False, detail="write failed or not configured")
        return WriteResult(ok=True, entity_id=str(inserted[0].get("id")) if inserted else None)

    async def refresh(self, ctx: UserContext) -> WriteResult:
        # F-scaffold: Plaid re-pull is owned by the connector layer; this signals
        # intent and returns a status. Real wiring re-pulls + regenerates snapshots.
        return WriteResult(ok=True, detail="refresh requested")

    # ------------------------------------------------------------ chat (G)
    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        vm = await self.summary(ctx)
        facts: list[dict] = []
        nw = vm.data.get("net_worth")
        if nw:
            facts.append({"fact": "net_worth", "value": nw, "source": {"system": "supabase", "table": "finance.financial_accounts"}})
        cash = vm.data.get("cash")
        if cash:
            facts.append({"fact": "cash", "value": cash, "source": {"system": "supabase", "table": "finance.financial_accounts"}})
        return DomainChatContext(
            domain=FINANCE,
            authoritative_facts=facts,
            missing_facts=[] if facts else ["accounts", "net_worth"],
            relevant_goals=[],
            risks=[],
            recommendations=vm.recommendations,
            graph_evidence=[],
            freshness=vm.freshness,
            confidence=vm.confidence,
        )
