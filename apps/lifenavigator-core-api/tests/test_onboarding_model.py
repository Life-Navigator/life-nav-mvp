"""P0 Onboarding Model — the final review must reflect what the user actually said.

Candidate goals persist across turns (none lost, none collapsed), every stated domain shows coverage > 0,
no unstated domain (career) appears, the user's own language is preserved, and no section is blank.
"""
import pytest

from app.models.common import UserContext
from app.services.discovery_coverage import DiscoveryCoverageService
from app.services.life_bridge import LifeBridgeService
from app.services.life_discovery import LifeDiscoveryService, _goal_domain
from app.services.relationship_manager import RelationshipManager
from .conftest import FakeSupabase, FakeInterpreterGemini

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

INCIDENT = ("I am currently paying down credit cards in order to get a better travel rewards card for all "
            "spending and the current one will be for emergencies. Once I don't carry any revolving debt "
            "anymore I want to build a down payment for a larger house. My fiancée and I want to start "
            "building a family after the wedding next September.")


def _rm(sb):
    life = LifeDiscoveryService(sb)
    return RelationshipManager(sb, life, LifeBridgeService(sb, life), gemini=FakeInterpreterGemini())


# ── P0.3: domain classification (every goal carries a real domain, not "core") ──
def test_goal_domain_classifies_each_life_domain():
    assert _goal_domain("paying down credit cards") == "finance"
    assert _goal_domain("build a down payment for a larger house") == "finance"
    assert _goal_domain("start building a family after the wedding") == "family"
    assert _goal_domain("I want to get in better shape and improve my fitness") == "health"
    assert _goal_domain("considering going back to school in a few years") == "education"


def test_analyze_statement_tags_real_domains_not_core():
    s = LifeDiscoveryService(None)
    cands = s.analyze_statement(INCIDENT)
    domains = {c["domain"] for c in cands}
    assert "finance" in domains  # credit cards / down payment
    assert "family" in domains   # fiancée / wedding / family
    assert "core" not in domains or len(domains) > 1  # not everything collapsed to core
    assert "career" not in domains  # Rule 1: no invented career


# ── P0.3: coverage reflects stated goals — no domain the user named is 0% ──
@pytest.mark.asyncio
async def test_coverage_reflects_stated_goals_not_zero():
    sb = FakeSupabase({"candidate_goals": [
        {"user_id": CTX.user_id, "goal_text": "pay down credit cards", "domain": "finance"},
        {"user_id": CTX.user_id, "goal_text": "start a family after the wedding", "domain": "family"},
        {"user_id": CTX.user_id, "goal_text": "improve my fitness", "domain": "health"},
        {"user_id": CTX.user_id, "goal_text": "go back to school later", "domain": "education"},
    ]})
    cov = await DiscoveryCoverageService(LifeDiscoveryService(sb), sb).coverage(CTX)
    by = {d["domain"]: d["coverage_pct"] for d in cov["domains"]}
    assert by["finance"] > 0   # P0.3
    assert by["family"] > 0    # family mention → family coverage > 0 (was 0%)
    assert by["health"] > 0    # fitness → health > 0
    assert by["education"] > 0  # school → education > 0
    assert by["career"] == 0   # P0.10: career stays 0 — user never mentioned it


@pytest.mark.asyncio
async def test_coverage_career_zero_without_mention():
    sb = FakeSupabase({"candidate_goals": [
        {"user_id": CTX.user_id, "goal_text": "pay down credit cards", "domain": "finance"},
    ]})
    cov = await DiscoveryCoverageService(LifeDiscoveryService(sb), sb).coverage(CTX)
    by = {d["domain"]: d["coverage_pct"] for d in cov["domains"]}
    assert by["career"] == 0  # Rule 1 / P0.10


# ── P0.1 / P0.2: goals persist across turns and the panel renders them (not a stale label) ──
@pytest.mark.asyncio
async def test_candidate_goals_persist_and_panel_renders_them():
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.converse(CTX, INCIDENT, pending_key="primary_goal")
    # persisted (P0.1) — one row per distinct goal, never collapsed
    stored = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert len(stored) >= 3
    texts = " ".join(r["goal_text"].lower() for r in stored)
    assert "credit card" in texts and "house" in texts and "family" in texts
    assert "career" not in texts  # Rule 1
    # P0.2: the confirmation panel renders the user's own priorities, not a stale objective label
    turn = await rm.converse(CTX, "yes that is correct", pending_key=None)
    panel = turn["context_panel"]
    assert panel.get("priorities_i_heard")  # not blank
    assert any("credit card" in p.lower() or "house" in p.lower() for p in panel["priorities_i_heard"])


# ── P0.5: an open-ended final answer (school "a few years out") is processed, not ignored ──
@pytest.mark.asyncio
async def test_open_ended_school_answer_is_captured_as_future_goal():
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.converse(CTX, "I am also considering going back to school, maybe a few years in the future",
                      pending_key="primary_goal")
    rows = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    school = [r for r in rows if "school" in r["goal_text"].lower()]
    assert school, "school goal must be captured, not ignored (P0.5)"
    assert school[0]["domain"] == "education"
    assert school[0]["status"] == "future_goal"  # 'a few years' → future, not dropped


# ── P0.6 / P0.7: no blank advisor message, user language preserved ──
@pytest.mark.asyncio
async def test_no_blank_advisor_message_and_user_language_preserved():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, INCIDENT, pending_key="primary_goal")
    assert turn["assistant_message"].strip()  # P0.6: never blank
    # P0.7: the user's words survive verbatim in the candidate goals
    rows = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert any("credit card" in r["goal_text"].lower() for r in rows)  # not "financial independence"
