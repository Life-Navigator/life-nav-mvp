"""FinanceService — the reference DomainService (F1 scaffold).

F1 goal: a real Supabase-backed *minimal* view-model when the tables are
reachable, and a typed placeholder otherwise. It NEVER returns a fake number:
when data is absent the tiles are explicitly ``None`` and ``confidence.basis``
reflects it, so the frontend renders a premium "connect your accounts" prompt
rather than a misleading ``$0``.

Elite finance (snapshots, budgeting, debt optimizer, full rec library) is
specified in FINANCE_DOMAIN_COMPLETION_REPORT.md and built in Phase 1 proper.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..clients.supabase import SupabaseClient
from ..models.common import (
    Confidence,
    DomainChatContext,
    DomainViewModel,
    Freshness,
    Recommendation,
    SourceRef,
    UserContext,
)
from .base import DomainService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FinanceService(DomainService):
    domain = "finance"
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

    async def summary(self, ctx: UserContext) -> DomainViewModel:
        accounts = await self._supabase.select(
            "financial_accounts",
            columns="id,name,institution_name,account_type,current_balance,currency",
            filters={"user_id": f"eq.{ctx.user_id}"},
            limit=50,
        )

        if not accounts:
            # No data (or Supabase unreachable) → honest empty view-model.
            return DomainViewModel(
                domain=self.domain,
                user_id=ctx.user_id,
                generated_at=_now_iso(),
                freshness=Freshness(as_of=_now_iso(), stale=True),
                confidence=Confidence(score=0.0, basis="missing", missing_fields=["accounts"]),
                data={
                    "net_worth": None,
                    "cash": None,
                    "debt": None,
                    "accounts": [],
                },
                recommendations=[],
                missing=["plaid_link"],
            )

        cash = sum(
            float(a.get("current_balance") or 0)
            for a in accounts
            if (a.get("account_type") or "").lower() in {"depository", "checking", "savings", "cash"}
        )
        net_worth = sum(float(a.get("current_balance") or 0) for a in accounts)

        return DomainViewModel(
            domain=self.domain,
            user_id=ctx.user_id,
            generated_at=_now_iso(),
            freshness=Freshness(
                as_of=_now_iso(),
                stale=False,
                sources=[SourceRef(system="supabase", table="finance.financial_accounts", as_of=_now_iso())],
            ),
            confidence=Confidence(score=0.6, basis="partial", missing_fields=["snapshots", "budgets"]),
            data={
                "net_worth": {"amount": net_worth, "currency": "USD"},
                "cash": {"amount": cash, "currency": "USD"},
                "debt": None,  # populated when liabilities/debts land (Phase 1)
                "accounts": [
                    {
                        "id": a.get("id"),
                        "name": a.get("name"),
                        "institution": a.get("institution_name"),
                        "type": a.get("account_type"),
                        "balance": {"amount": float(a.get("current_balance") or 0), "currency": a.get("currency") or "USD"},
                    }
                    for a in accounts
                ],
            },
            recommendations=[],
            missing=["cash_flow_snapshots", "net_worth_snapshots"],
        )

    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        vm = await self.summary(ctx)
        nw = vm.data.get("net_worth")
        facts: list[dict] = []
        if nw:
            facts.append(
                {"fact": "net_worth", "value": nw, "source": {"system": "supabase", "table": "finance.financial_accounts"}}
            )
        return DomainChatContext(
            domain=self.domain,
            authoritative_facts=facts,
            missing_facts=[] if facts else ["accounts", "net_worth"],
            relevant_goals=[],
            risks=[],
            recommendations=[],
            graph_evidence=[],  # Qdrant/Neo4j fusion lands in F2
            freshness=vm.freshness,
            confidence=vm.confidence,
        )

    async def recommendations(self, ctx: UserContext) -> list[Recommendation]:
        # F1: no recommendation engine yet (Phase 1 builds the gated library).
        return []
