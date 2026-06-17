"""Discovery Intelligence remediation — Arcana must follow the person, not the ontology.

Proves: user priorities + life-significance + urgency outrank confidence; persona-seeded goals stay
candidate (cannot be primary without confirmation); each life goal can lead; narrative is preserved;
discovery questions surface the user's tradeoff instead of the highest-confidence objective.
"""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_discovery import (
    LifeDiscoveryService, ROOT_OBJECTIVES, rank_objectives, score_objective,
)
from app.services.relationship_manager import RelationshipManager

from .conftest import FakeSupabase

CTX = UserContext(user_id="22222222-2222-2222-2222-222222222222")


def _obj(root, *, confirmed=True, origin="user", confidence=0.8, surface="", themes=None, updated="2026-06-16T00:00:00Z"):
    return {"id": f"id-{root}", "user_id": CTX.user_id, "root_objective_key": root,
            "title": ROOT_OBJECTIVES[root]["label"], "surface_goal": surface, "confidence": confidence,
            "confirmed": confirmed, "origin": origin, "status": "active", "themes": themes or [],
            "why_chain": [], "updated_at": updated}


# ── Pure ranking ────────────────────────────────────────────────────────────────────────────────
def test_user_priority_outranks_persona_goal():
    persona_fi = _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.92)
    user_family = _obj("family_stability", confirmed=True, origin="user", confidence=0.50)
    ranked = rank_objectives([persona_fi, user_family])
    assert ranked[0]["root_objective_key"] == "family_stability"  # confirmed life goal beats unconfirmed persona FI


def test_explicit_priority_wins_even_at_lower_confidence():
    fi = _obj("financial_independence", confidence=0.9)
    career = _obj("career_growth", confidence=0.4)
    ranked = rank_objectives([fi, career], priority_root="career_growth")
    assert ranked[0]["root_objective_key"] == "career_growth"


@pytest.mark.parametrize("root", ["family_stability", "homeownership", "health_longevity"])
def test_terminal_life_goal_outranks_finance_on_significance(root):
    # Terminal LIFE goals (family/home/health) outrank a high-confidence finance objective on significance.
    life = _obj(root, confidence=0.5)
    fi = _obj("financial_independence", confidence=0.9)
    ranked = rank_objectives([life, fi])
    assert ranked[0]["root_objective_key"] == root


@pytest.mark.parametrize("root", ["career_growth", "education_advancement"])
def test_instrumental_goal_leads_when_user_prioritizes_it(root):
    # Instrumental goals (career/education) need the user's priority (or urgency) to lead over finance —
    # they are not assumed more important by default. "Promotion can become primary" via priority.
    inst = _obj(root, confidence=0.4)
    fi = _obj("financial_independence", confidence=0.9)
    assert rank_objectives([inst, fi], priority_root=root)[0]["root_objective_key"] == root


def test_wedding_urgency_lifts_family_to_primary():
    family = _obj("family_stability", confidence=0.5, surface="wedding in 12 months")
    fi = _obj("financial_independence", confidence=0.95)
    assert rank_objectives([family, fi])[0]["root_objective_key"] == "family_stability"


def test_unconfirmed_persona_goal_is_penalized():
    a = _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.95)
    b = _obj("financial_independence", confirmed=True, origin="user", confidence=0.95)
    assert score_objective(b) > score_objective(a)  # identical except confirmation → confirmed scores higher


# ── snapshot: candidate protection ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_persona_fi_cannot_be_primary_without_confirmation():
    sb = FakeSupabase({"life_objectives": [
        _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.95),
    ]})
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    assert snap["primary_objective"] is None  # a lone unconfirmed persona seed is NOT primary
    cand_roots = [c["root"] for c in snap["candidate_objectives"]]
    assert "financial_independence" in cand_roots  # surfaced as a possible (unconfirmed) goal instead


@pytest.mark.asyncio
async def test_confirmed_family_is_primary_over_persona_fi():
    sb = FakeSupabase({"life_objectives": [
        _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.95),
        _obj("family_stability", confirmed=True, origin="user", confidence=0.55),
    ]})
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    assert snap["primary_objective"]["title"] == ROOT_OBJECTIVES["family_stability"]["label"]
    assert snap["primary_objective"]["confirmed"] is True


# ── write path: priority capture, narrative, candidate seeding ────────────────────────────────────
@pytest.mark.asyncio
async def test_priority_answer_confirms_and_promotes_objective():
    sb = FakeSupabase({"life_objectives": [
        _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.95),
        _obj("family_stability", confirmed=False, origin="persona_bridge", confidence=0.40),
    ]})
    rm = RelationshipManager(sb, LifeDiscoveryService(sb))
    await rm.answer(CTX, "priority", "Honestly, starting a family and the wedding matter most right now.")
    vision = (await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}))[0]
    assert vision["prompts"].get("user_priority_root") == "family_stability"
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    assert snap["primary_objective"] is not None
    assert snap["primary_objective"]["title"] == ROOT_OBJECTIVES["family_stability"]["label"]  # confirmed + promoted


@pytest.mark.asyncio
async def test_narrative_survives_ontology_conversion():
    sb = FakeSupabase({})
    rm = RelationshipManager(sb, LifeDiscoveryService(sb))
    statement = "Pay off debt, save for a wedding, buy a home, start a family, get promoted, do a Master's, get fit."
    await rm.answer(CTX, "primary_goal", statement)
    vision = (await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}))[0]
    assert vision["prompts"].get("narrative") == statement  # the user's OWN words preserved verbatim
    assert vision["prompts"].get("narrative_summary")       # a separate multi-domain summary exists


@pytest.mark.asyncio
async def test_bridge_seeds_persona_goals_as_unconfirmed_candidates():
    # discover_goal called the way the bridge calls it → objective is a candidate, never primary.
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="retire comfortably", why_chain=[{"q": "onboarding goal", "a": "retire"}],
                             root_override="financial_independence", confirmed=False, origin="persona_bridge")
    snap = await life.snapshot(CTX)
    assert snap["primary_objective"] is None
    assert any(c["root"] == "financial_independence" for c in snap["candidate_objectives"])


@pytest.mark.asyncio
async def test_user_goal_is_confirmed_and_can_lead():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="get our family a home", root_override="family_stability")  # default confirmed=user
    snap = await life.snapshot(CTX)
    assert snap["primary_objective"] is not None
    assert snap["primary_objective"]["confirmed"] is True


# ── question selection: follow the user's tradeoff, not the top objective ──────────────────────────
@pytest.mark.asyncio
async def test_discovery_question_surfaces_tradeoff_when_goals_compete():
    sb = FakeSupabase({
        "life_vision": [{"user_id": CTX.user_id, "vision_text": "build a good life",
                         "prompts": {"discovery_answered": ["vision", "primary_goal"]}}],
        "candidate_goals": [
            {"user_id": CTX.user_id, "goal_text": "save for our wedding", "domain": "family"},
            {"user_id": CTX.user_id, "goal_text": "get promoted at work", "domain": "career"},
            {"user_id": CTX.user_id, "goal_text": "get in shape", "domain": "health"},
        ],
    })
    rm = RelationshipManager(sb, LifeDiscoveryService(sb))
    st = await rm.state(CTX)
    assert st["next_question"]["key"] == "priority"
    assert "postpone" in st["next_question"]["prompt"].lower()   # tradeoff framing, not "timeline for FI"
    assert len(st["competing_goals"]) >= 2


@pytest.mark.asyncio
async def test_validation_example_family_not_financial_independence():
    """Phase 8 — the exact audit scenario. A user juggling wedding/home/family/promotion/masters/fitness,
    with a persona-seeded financial_independence, must NOT be told their focus is financial independence."""
    sb = FakeSupabase({
        "life_objectives": [
            _obj("financial_independence", confirmed=False, origin="persona_bridge", confidence=0.95),  # persona seed
            _obj("family_stability", confirmed=True, origin="user", confidence=0.55, surface="wedding in 12 months, start a family"),
        ],
        "life_vision": [{"user_id": CTX.user_id, "vision_text": "build a life and family",
                         "prompts": {"discovery_answered": ["vision", "primary_goal"]}}],
        "candidate_goals": [
            {"user_id": CTX.user_id, "goal_text": "pay off debt", "domain": "finance"},
            {"user_id": CTX.user_id, "goal_text": "save for our wedding", "domain": "family"},
            {"user_id": CTX.user_id, "goal_text": "buy a home", "domain": "family"},
            {"user_id": CTX.user_id, "goal_text": "get promoted at NVIDIA", "domain": "career"},
            {"user_id": CTX.user_id, "goal_text": "pursue a master's degree", "domain": "education"},
            {"user_id": CTX.user_id, "goal_text": "get in shape", "domain": "health"},
        ],
    })
    life = LifeDiscoveryService(sb)
    # 1) Dominant theme is the user's life, NOT the persona's financial independence.
    snap = await life.snapshot(CTX)
    assert snap["primary_objective"]["title"] == ROOT_OBJECTIVES["family_stability"]["label"]
    assert snap["primary_objective"]["title"] != ROOT_OBJECTIVES["financial_independence"]["label"]
    assert any(c["root"] == "financial_independence" and c["confirmed"] is False
               for c in snap["candidate_objectives"])  # FI shown as a possible goal, not the focus
    # 2) Next question is the tradeoff/postpone question, not "timeline for financial independence".
    rm = RelationshipManager(sb, LifeDiscoveryService(sb))
    st = await rm.state(CTX)
    assert st["next_question"]["key"] == "priority"
    assert "postpone" in st["next_question"]["prompt"].lower()
    assert "financial independence" not in st["next_question"]["prompt"].lower()
