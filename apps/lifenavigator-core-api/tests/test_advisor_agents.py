"""Command Center — agent registry, relevance routing, and per-agent grounding scope."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.advisor_agents import (
    AGENTS, RELATIONSHIP_MANAGER, agent_catalog, get_agent, route_domains, domains_for,
)
from app.services.advisor_context import AdvisorContextBuilder
from app.services.advisor_facts import build_fact_packet
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def test_catalog_has_full_roster_with_orchestrator():
    cat = agent_catalog()
    ids = {a["id"] for a in cat}
    assert RELATIONSHIP_MANAGER in ids
    for expected in ("finance_advisor", "career_advisor", "education_advisor", "health_advisor",
                     "family_advisor", "document_advisor", "scenario_planner", "report_advisor"):
        assert expected in ids
    rm = next(a for a in cat if a["id"] == RELATIONSHIP_MANAGER)
    assert rm["isOrchestrator"] is True and rm["mode"] == "relationship_manager"
    assert len(cat) == len(AGENTS) >= 9


def test_get_agent_defaults_to_relationship_manager():
    assert get_agent("career_advisor").id == "career_advisor"
    assert get_agent(None).id == RELATIONSHIP_MANAGER
    assert get_agent("does_not_exist").id == RELATIONSHIP_MANAGER


def test_route_domains_is_keyword_based_with_safe_default():
    assert "finance" in route_domains("Can I afford a $30,000 car?")
    assert "career" in route_domains("Am I ready for a promotion?")
    assert "education" in route_domains("Should I get an MBA?")
    # Nothing matched → ALL life domains (broad synthesis), never empty, never finance-biased.
    assert set(route_domains("hello there")) == {"finance", "career", "education", "health", "family"}


def test_domains_for_direct_vs_orchestrator():
    career = get_agent("career_advisor")
    rm = get_agent(RELATIONSHIP_MANAGER)
    assert domains_for(career, "anything") == ["career"]
    assert "finance" in domains_for(rm, "can I afford this?")


@pytest.mark.asyncio
async def test_fact_packet_grounds_finance_family_documents():
    sb = FakeSupabase({
        "financial_accounts": [
            {"id": "a1", "account_name": "Checking", "account_type": "checking",
             "current_balance": 5000, "is_active": True},
        ],
        "dependents": [{"id": "d1", "name": "Sam", "relationship": "child"}],
        "documents": [{"id": "doc1", "title": "Will", "document_type": "estate"}],
    })
    facts = await build_fact_packet(sb, CTX)
    domains = {f["domain"] for f in facts}
    assert {"finance", "family", "documents"}.issubset(domains)
    acct = next(f for f in facts if f["label"] == "Account")
    assert acct["sourceTable"] == "finance.financial_accounts" and acct["recordId"] == "a1"


def _base():
    return {"context_panel": {}, "pending_key": None, "complete": False}


@pytest.mark.asyncio
async def test_direct_agent_scopes_grounding_to_its_domain():
    sb = FakeSupabase({
        "experience_records": [{"id": "e1", "title": "Engineer", "is_current": True, "start_date": "2015-01-01"}],
        "financial_accounts": [{"id": "a1", "account_name": "Checking", "account_type": "checking",
                                "current_balance": 5000, "is_active": True}],
    })
    builder = AdvisorContextBuilder(sb)

    # Career agent sees ONLY career facts (not finance), and carries its persona.
    career_ctx = await builder.build(CTX, "Am I ready for a promotion?", _base(), [], agent=get_agent("career_advisor"))
    domains = {f["domain"] for f in career_ctx.domain_facts}
    assert domains == {"career"}
    assert career_ctx.active_agent and career_ctx.active_agent["id"] == "career_advisor"
    assert career_ctx.agent_domains == ["career"]

    # Relationship Manager keeps every domain's facts to synthesize across them.
    rm_ctx = await builder.build(CTX, "What should I do about money and work?", _base(), [], agent=get_agent(RELATIONSHIP_MANAGER))
    rm_domains = {f["domain"] for f in rm_ctx.domain_facts}
    assert {"career", "finance"}.issubset(rm_domains)
    assert rm_ctx.active_agent["isOrchestrator"] is True


@pytest.mark.asyncio
async def test_legacy_no_agent_keeps_all_facts_and_no_persona():
    sb = FakeSupabase({
        "experience_records": [{"id": "e1", "title": "Engineer", "is_current": True, "start_date": "2015-01-01"}],
    })
    ctx = await AdvisorContextBuilder(sb).build(CTX, "hi", _base(), [])
    assert ctx.active_agent is None and ctx.agent_domains == []


# P0 — Domain Routing Failure: health/family questions must NOT fall into the finance-biased fallback,
# and substring collisions (work→workout) must not mis-route. Whole-word routing.
def test_route_domains_p0_intent():
    from app.services.advisor_agents import route_domains
    health = ["build me a workout plan", "gym plan for the week", "let's talk about TRT", "a HIIT routine",
              "martial arts training", "swimming for cardio", "my shoulder injury", "knee arthritis"]
    for m in health:
        assert "health" in route_domains(m), m
    assert "career" in route_domains("I got a promotion")
    assert "career" in route_domains("I have a job offer")
    assert "finance" in route_domains("mortgage and down payment")
    assert "family" in route_domains("who is the guardian in my will and trust")
    assert "education" in route_domains("should I get a master's degree")
    # broad/unmatched → ALL domains, never finance-only-biased
    assert set(route_domains("hello")) >= {"health", "family", "finance", "career", "education"}
    # 'work' must not fire career on 'workout'
    assert route_domains("workout") == ["health"]


def test_route_domains_failed_conversation_replay():
    """The exact failed conversation: a multi-symptom training-plan request must stay in HEALTH,
    never leak to finance/career."""
    from app.services.advisor_agents import route_domains
    msg = ("Can you build me a weekly training plan? I have knee arthritis and a shoulder injury, "
           "I'm on TRT with my medical provider, and I do HIIT, martial arts, and swimming.")
    domains = route_domains(msg)
    assert "health" in domains
    assert "finance" not in domains  # the bug: this used to redirect to credit cards / down payments
