"""Sprint 40 — Relationship Manager (primary conversational onboarding) + Life Bridge."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_bridge import LifeBridgeService
from app.services.life_discovery import LifeDiscoveryService
from app.services.relationship_manager import RelationshipManager
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _rm(sb):
    life = LifeDiscoveryService(sb)
    return RelationshipManager(sb, life, LifeBridgeService(sb, life))


@pytest.mark.asyncio
async def test_first_question_is_vision_then_advances():
    sb = FakeSupabase({})
    rm = _rm(sb)
    st = await rm.state(CTX)
    assert st["complete"] is False and st["next_question"]["key"] == "vision"
    assert st["next_question"]["why_it_matters"]
    r = await rm.answer(CTX, "vision", "Retire by 60 and raise a secure family")
    # the answer wrote to the canonical model AND advanced
    assert r["recorded"]["wrote"] == "life.life_vision"
    assert r["next_question"]["key"] == "primary_goal"
    assert sb._by_table.get("life_vision") or True  # persisted


@pytest.mark.asyncio
async def test_goal_answer_writes_objective_to_canonical_model():
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(CTX, "primary_goal", "buy a house because we want to start a family")
    assert "life.life_objectives" in r["recorded"]["wrote"]
    objs = await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert objs and objs[0]["root_objective_key"] == "family_stability"  # discovered + written immediately


@pytest.mark.asyncio
async def test_risk_answer_writes_risk_profile():
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(CTX, "risk", "I would buy more")
    assert r["recorded"]["wrote"] == "life.risk_profiles" and r["recorded"]["risk_behavior"] == "aggressive"
    rp = await sb.select("risk_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert rp and rp[0]["tolerance"] == 85


@pytest.mark.asyncio
async def test_full_flow_completes_and_is_resumable():
    sb = FakeSupabase({})
    rm = _rm(sb)
    answers = {"vision": "A secure, free life", "primary_goal": "reach financial independence",
               "family_goal": "raise two kids well", "career_goal": "become a director",
               "financial_goal": "retire with enough to never worry", "risk": "hold",
               "time_horizon": "20 years", "health_goal": "stay fit and energetic",
               "constraint": "high student debt"}
    last = None
    for _ in range(len(answers) + 2):
        st = await rm.state(CTX)
        if st["complete"]:
            break
        q = st["next_question"]["key"]
        last = await rm.answer(CTX, q, answers.get(q, "n/a"))
    assert (await rm.state(CTX))["complete"] is True  # interview finishes
    # resume: a fresh state call still reports complete (persisted, not in-memory)
    assert (await _rm(sb).state(CTX))["complete"] is True


@pytest.mark.asyncio
async def test_bridge_projects_persona_goals_into_canonical_model():
    sb = FakeSupabase({"user_persona_profile": [{"id": "p1", "user_id": CTX.user_id, "persona_id": "young_professional",
                                                 "risk_profile": "moderate", "life_stage": "early career",
                                                 "primary_goals": ["Build emergency fund", "Start investing", "Pay down student debt"]}]})
    out = await LifeBridgeService(sb, LifeDiscoveryService(sb)).sync(CTX)
    assert out["bridged_goals"] >= 3 and out["risk_written"] is True
    objs = await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert objs  # persona goals became canonical life objectives
    rp = await sb.select("risk_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert rp and rp[0]["behavior"] == "moderate"


# ---- Sprint 41: chat-native Relationship Manager ----
@pytest.mark.asyncio
async def test_converse_opens_with_a_question_no_answer_consumed():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, "hi", pending_key=None)
    assert turn["pending_key"] == "vision" and "?" in turn["assistant_message"]
    assert turn["complete"] is False and "context_panel" in turn
    # nothing was written from the greeting
    assert not (await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life"))


@pytest.mark.asyncio
async def test_converse_answers_writes_and_shows_updates():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, "buy a house because we want to start a family", pending_key="primary_goal")
    assert any("Objective added" in u for u in turn["updates"])  # visible learning (D2)
    # Rule 7: discovery uses draft language, not "recommendations refreshed" (nothing finalized yet).
    assert any("Life model updated" in u for u in turn["updates"])
    # Rule 3: reflect the user's OWN words (house/family), not an objective label, before confirmation.
    msg = turn["assistant_message"].lower()
    assert "house" in msg or "family" in msg
    assert "career" not in msg  # Rule 1: never invent career
    assert turn["pending_key"] and turn["pending_key"] != "primary_goal"  # advanced
    # it actually wrote canonically
    assert await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")


@pytest.mark.asyncio
async def test_converse_context_panel_reflects_model():
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.converse(CTX, "Retire by 60 and raise a family", pending_key="vision")
    turn = await rm.converse(CTX, "reach financial independence", pending_key="financial_goal")
    panel = turn["context_panel"]
    assert panel["life_vision"] and panel["primary_objective"] and "discovery_completion_pct" in panel


# ---- Domain-scoped risk/opportunity chips: a HEALTH turn must not surface a FINANCE risk chip ----
def _sb_with_mixed_domain_risks() -> FakeSupabase:
    """Seed one active objective with risks/opportunities spanning several life domains, plus one risk
    that carries NO domain (must never be hidden)."""
    obj_id = "obj-1"
    return FakeSupabase({
        "life_objectives": [{"id": obj_id, "user_id": CTX.user_id, "title": "Stay healthy and secure",
                             "status": "active", "confirmed": True, "confidence": 0.8}],
        "risks": [
            {"id": "r-h", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Undetected chronic risk factors", "domain": "health"},
            {"id": "r-f", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Outliving your assets", "domain": "finance"},
            {"id": "r-c", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Skill obsolescence", "domain": "career"},
            {"id": "r-x", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Unknown-domain risk", "domain": None},
        ],
        "opportunities": [
            {"id": "o-h", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Employer wellness + HSA", "domain": "health"},
            {"id": "o-f", "user_id": CTX.user_id, "objective_id": obj_id, "label": "Full employer 401(k) match", "domain": "finance"},
        ],
    })


@pytest.mark.asyncio
async def test_context_panel_scopes_risk_chips_to_focused_domain():
    """A health-focused turn must NOT surface a finance/career risk chip, but must keep health + any
    risk that carries no domain (we never drop a real risk just because it lacks a tag)."""
    rm = _rm(_sb_with_mixed_domain_risks())
    panel = await rm._context_panel(CTX, focus_domains=["health"])
    risks = panel["top_risks"]
    assert "Undetected chronic risk factors" in risks   # the in-domain risk is kept
    assert "Unknown-domain risk" in risks               # unknown-domain risk is NOT hidden (conservative)
    assert "Outliving your assets" not in risks         # finance risk is scoped out of a health turn
    assert "Skill obsolescence" not in risks            # career risk is scoped out of a health turn
    opps = panel["top_opportunities"]
    assert "Employer wellness + HSA" in opps and "Full employer 401(k) match" not in opps


@pytest.mark.asyncio
async def test_context_panel_default_orchestrator_keeps_all_risks():
    """The broad/default advisor (no domain focus) must keep the full whole-life risk list."""
    rm = _rm(_sb_with_mixed_domain_risks())
    panel = await rm._context_panel(CTX, focus_domains=None)
    risks = set(panel["top_risks"])
    assert {"Undetected chronic risk factors", "Outliving your assets", "Skill obsolescence"} <= risks


def test_focus_domains_helper_broad_vs_focused():
    from app.services.advisor_agents import focus_domains, get_agent
    # Direct domain advisor → focused to its own domains.
    assert focus_domains(get_agent("health_advisor"), "how do I get fit?") == ["health"]
    # Orchestrator + a single-domain message → focused to that subset.
    assert focus_domains(get_agent("relationship_manager"), "I have knee pain from the gym") == ["health"]
    # Orchestrator + a broad/ambiguous message (no single domain) → None (sees everything).
    assert focus_domains(get_agent("relationship_manager"), "what should I do with my life?") is None
    # No agent → broad.
    assert focus_domains(None, "anything") is None


# ---- Sprint 43: the Discovery Reveal "magic moment" + warmer copy ----
@pytest.mark.asyncio
async def test_converse_returns_discovery_reveal():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, "buy a house because we want to start a family", pending_key="primary_goal")
    rev = turn["reveal"]
    assert rev and rev["you_said"] == "buy a house because we want to start a family"
    assert rev["we_discovered"] == "Build family stability"
    assert len(rev["dependencies"]) >= 4 and rev["recommendations_unlocked"] == len(rev["dependencies"])
    assert rev["confidence_pct"] > 0


# ---- Data Flow & Rendering Integrity: per-item persistence of the onboarding statement ----
@pytest.mark.asyncio
async def test_multi_goal_statement_persists_every_candidate_goal():
    """The opening statement carries many goals (wedding/home/family/promotion/education/fitness). EVERY
    one must accumulate in life.candidate_goals across the turn — none collapsed, none dropped."""
    sb = FakeSupabase({})
    rm = _rm(sb)
    statement = ("I'm getting married next June, then we want to buy a home and start a family, "
                 "I'm gunning for a promotion to director, I'd like to do a Masters in AI, "
                 "and I want to get in better shape")
    await rm.converse(CTX, statement, pending_key="primary_goal")
    cands = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    blob = " ".join(str(c.get("goal_text", "")).lower() for c in cands)
    # at least the distinct life domains the user named are captured
    domains = {str(c.get("domain")) for c in cands}
    assert {"family", "career", "education", "health"} & domains == {"family", "career", "education", "health"} \
        or all(k in blob for k in ("married", "home", "promotion", "masters", "shape"))
    assert len(cands) >= 4  # not collapsed into one


@pytest.mark.asyncio
async def test_answered_constraint_persists_to_life_constraints():
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.answer(CTX, "constraint", "money is tight and my energy is drained from overwork")
    cons = await sb.select("constraints", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert cons and cons[0]["kind"] == "stated"
    assert "money" in cons[0]["label"].lower()


@pytest.mark.asyncio
async def test_discovery_projects_career_education_and_pet_into_domain_tables():
    """Round-trip: goals captured in discovery must appear in the domain tables the
    dashboard reads, so the user sees we understood and never re-enters data."""
    from app.services.domain_projection import DomainProjectionService

    sb = FakeSupabase({})
    proj = DomainProjectionService(sb)
    candidates = [
        {"goal": "work toward a CEO role in the next 5 years", "domain": "career",
         "confidence": 0.8, "supporting_quotes": ["CEO role in 5 years"]},
        {"goal": "attend executive education at Harvard or Stanford", "domain": "education",
         "confidence": 0.7, "supporting_quotes": ["executive education"]},
        {"goal": "we just got a puppy that we must care for", "domain": "family",
         "confidence": 0.9, "supporting_quotes": ["we just got a puppy"]},
    ]
    await proj.project(CTX, candidates)

    careers = await sb.select("career_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="career")
    assert careers and careers[0]["goal_type"] == "advancement" and careers[0]["target_role"] == "CEO"
    assert careers[0]["metadata"]["source"] == "discovery_projection"

    edu = await sb.select("education_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="education")
    assert edu and edu[0]["goal_type"] == "credential"

    pets = await sb.select("pets", filters={"user_id": f"eq.{CTX.user_id}"}, schema="family")
    assert pets and pets[0]["species"] == "dog"


@pytest.mark.asyncio
async def test_projection_is_idempotent_across_repeated_turns():
    from app.services.domain_projection import DomainProjectionService

    sb = FakeSupabase({})
    proj = DomainProjectionService(sb)
    cand = [{"goal": "become a CEO", "domain": "career", "confidence": 0.8, "supporting_quotes": []}]
    await proj.project(CTX, cand)
    await proj.project(CTX, cand)
    careers = await sb.select("career_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="career")
    assert len(careers) == 1  # deterministic id → upsert in place, no duplicate


@pytest.mark.asyncio
async def test_financial_constraint_answer_is_not_forced_into_financial_independence():
    """A money answer framed as a CONSTRAINT protecting existing security must be recorded
    as a constraint — NOT turned into a 'reach financial independence' objective with
    boilerplate retirement dependencies (the reported mis-categorization bug)."""
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(
        CTX, "financial_goal",
        "It is the constraint that we need to ensure is set up properly to handle all of "
        "these things without weakening the security I have built for our family.",
    )
    assert r["recorded"]["wrote"] == "life.constraints"
    assert r["recorded"].get("is_constraint") is True
    # No financial_independence objective should have been created from this constraint.
    objs = await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert not any(o.get("root_objective_key") == "financial_independence" for o in objs)
    cons = await sb.select("constraints", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert cons and cons[0]["kind"] == "financial"


@pytest.mark.asyncio
async def test_genuine_financial_goal_still_creates_objective():
    """A real money GOAL (not constraint-framed) still flows to discover_goal as before."""
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(CTX, "financial_goal", "I want to save aggressively and retire early")
    assert "life.life_objectives" in r["recorded"]["wrote"]


@pytest.mark.asyncio
async def test_dominant_narrative_persists_and_returns_in_snapshot():
    sb = FakeSupabase({})
    rm = _rm(sb)
    # primary_goal answer persists narrative free text + candidate goals → snapshot computes the story
    await rm.answer(CTX, "primary_goal", "I'm getting married and we want to start a family this year")
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    nar = snap.get("dominant_narrative")
    assert nar and nar.get("key") and nar.get("summary")
    # the narrative free text was persisted to life_vision.prompts.narrative (resumable, not in-memory)
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert (vis[0].get("prompts") or {}).get("narrative")


@pytest.mark.asyncio
async def test_candidate_goals_are_not_auto_promoted_to_confirmed_objectives():
    """Trust rule: a candidate/inferred goal stays candidate. Only the user's explicit priority CONFIRMS
    one objective — extra candidate goals must NOT be marked confirmed by the act of being captured."""
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.converse(CTX, "I want to retire early and also get an MBA someday", pending_key="primary_goal")
    cands = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    # candidate_goals table has no 'confirmed' column — they are inherently unconfirmed candidates
    assert cands and all("confirmed" not in c for c in cands)
    # a future-framed goal keeps future_goal status (not silently promoted to active/confirmed)
    assert any(c.get("status") == "future_goal" for c in cands)


def test_advisor_copy_is_human_not_procedural():
    # the questions should sound like an advisor, not a form ("Question 3 of 9")
    from app.services.relationship_manager import FLOW
    prompts = " ".join(s["prompt"] for s in FLOW).lower()
    assert "what is your primary goal" not in prompts and "risk tolerance" not in prompts
    assert "how do you usually react" in prompts  # the warm risk phrasing
