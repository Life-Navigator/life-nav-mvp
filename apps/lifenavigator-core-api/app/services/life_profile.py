"""Life Profile aggregation — the cross-domain command center.

Iterates the live domain registry, collects each domain's complete summary, the
ranked cross-domain recommendations, premium missing-data prompts, and system
status. Unfinished domains are listed by name only (``missing_domains``) — never
fabricated. Extensible: a newly-registered domain appears with no code change here.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..agents.recommendation import RecommendationAgent
from ..domains.registry import DomainRegistry
from ..models.common import (
    Confidence,
    DomainCard,
    DomainViewModel,
    Freshness,
    LifeProfileViewModel,
    MissingDataPrompt,
    SystemStatus,
    UserContext,
)

# Premium copy for known missing fields. Fallback is generic but never a fake zero.
_PROMPT_COPY: dict[tuple[str, str], tuple[str, str, str]] = {
    ("finance", "plaid_link"): (
        "Connect your accounts",
        "Link your bank, cards, and investments to see your real net worth, cash flow, and spending.",
        "connect_accounts",
    ),
    ("finance", "transactions"): (
        "Add your spending",
        "Connect an account or import transactions to unlock cash flow and category insights.",
        "connect_accounts",
    ),
    ("finance", "net_worth_snapshots"): (
        "Net worth trend coming online",
        "Once we've tracked a few snapshots, you'll see how your net worth moves over time.",
        "none",
    ),
    ("finance", "cash_flow_snapshots"): (
        "Cash-flow trend coming online",
        "We'll chart your monthly income vs. expenses as snapshots accrue.",
        "none",
    ),
    ("finance", "debts"): (
        "Add your debts",
        "Add a loan or card balance to get a payoff strategy ranked by interest rate.",
        "add_liability",
    ),
    ("finance", "retirement_plans"): (
        "Add retirement accounts",
        "Add a 401(k)/IRA to project your retirement readiness.",
        "add_retirement",
    ),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LifeProfileService:
    def __init__(self, registry: DomainRegistry, recommendation_agent: RecommendationAgent) -> None:
        self._registry = registry
        self._rec = recommendation_agent

    async def build(self, ctx: UserContext, system_status: SystemStatus) -> LifeProfileViewModel:
        services = self._registry.live()
        summaries: dict[str, DomainViewModel] = {}
        domains: dict[str, DomainCard] = {}
        prompts: list[MissingDataPrompt] = []
        sources = []
        any_data = False

        for name, svc in services.items():
            vm = await svc.summary(ctx)
            summaries[name] = vm
            sources.extend(vm.freshness.sources)
            available = vm.confidence.basis != "missing"
            any_data = any_data or available
            domains[name] = DomainCard(
                domain=name,
                available=available,
                headline=self._headline(name, vm),
                score=vm.confidence.score,
                summary_ref=f"/v1/{name}/summary",
                missing=vm.missing,
            )
            for field in vm.missing:
                prompts.append(self._prompt(name, field))

        recommendations = await self._rec.collect(ctx, services)

        return LifeProfileViewModel(
            user_id=ctx.user_id,
            generated_at=_now(),
            domains=domains,
            summaries=summaries,
            recommendations=recommendations,
            missing_data_prompts=prompts,
            missing_domains=self._registry.unavailable(),
            freshness=Freshness(as_of=_now(), stale=not any_data, sources=sources),
            confidence=Confidence(
                score=0.6 if any_data else 0.0,
                basis="partial" if any_data else "missing",
                missing_fields=[],
            ),
            system_status=system_status,
        )

    @staticmethod
    def _headline(domain: str, vm: DomainViewModel) -> str:
        if domain == "finance":
            nw: Any = vm.data.get("net_worth")
            if nw and isinstance(nw, dict):
                return f"Net worth ${nw.get('amount', 0):,.0f}"
            return "Connect your finances to begin"
        return domain.capitalize()

    @staticmethod
    def _prompt(domain: str, field: str) -> MissingDataPrompt:
        title, body, cta = _PROMPT_COPY.get(
            (domain, field),
            (f"Complete your {domain} profile", f"Add your {field.replace('_', ' ')} to unlock insights.", "add_data"),
        )
        return MissingDataPrompt(domain=domain, field=field, title=title, body=body, cta=cta)
