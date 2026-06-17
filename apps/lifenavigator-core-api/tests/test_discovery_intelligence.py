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


# ── Narrative-first discovery (validation sprint): the LIFE STORY, not a single objective ──────────
from app.services.life_discovery import dominant_narrative, emotional_signals  # noqa: E402
from app.services.life_bridge import LifeBridgeService  # noqa: E402

_PERSONAS = {
    "A_family": ("I want to pay off my credit card and save for a down payment and for my wedding. I'm getting "
                 "married in a year and want to buy a house then because we want to start a family soon after. "
                 "I'm also getting in shape for my wedding. I want a promotion as a junior software engineer at "
                 "NVIDIA, and I'm considering a Masters in AI at UT Austin.", "family_foundation"),
    "B_burnout": ("Financially I'm fine. My concern is I'm constantly working. I have two children. I travel "
                  "frequently and feel like I'm missing important years with my family. I'm sleeping poorly and "
                  "have gained weight. My comp is good but I'm not sure pushing harder is what I want anymore.",
                  "health_life_balance"),
    "C_career": ("I'm 28, I work in AI, and I want to become a director before 40. I'm willing to work extremely "
                 "hard for the next decade. I'm considering an MBA, a startup, or joining a top AI lab. I don't "
                 "have children and I'm comfortable prioritizing my career.", "career_acceleration"),
    "D_stress": ("I have about $18,000 in credit card debt and I'm barely making payments. I'm worried about "
                 "losing my apartment. I don't have savings. My relationship is under stress because of money. "
                 "I feel overwhelmed.", "financial_stabilization"),
}


@pytest.mark.parametrize("name", list(_PERSONAS))
def test_dominant_narrative_per_persona(name):
    stmt, expected = _PERSONAS[name]
    life = LifeDiscoveryService(FakeSupabase({}))
    nar = dominant_narrative(life.analyze_statement(stmt), stmt)
    assert nar["key"] == expected, f"{name}: got {nar['key']}, expected {expected}"


def test_emotional_signals_detects_distress_and_burnout():
    assert emotional_signals("I'm overwhelmed and worried about losing my apartment, $18k in debt")["money_stress"]
    assert emotional_signals("I am constantly working and missing important years with my family")["burnout"]
    assert emotional_signals("I don't have children and I'm comfortable prioritizing my career")["family_deprioritized"]


@pytest.mark.parametrize("name", list(_PERSONAS))
@pytest.mark.asyncio
async def test_narrative_validation_end_to_end_clean(name):
    """Phase 9 — full pipeline, pure user narrative: the surfaced theme matches the person's life story."""
    stmt, expected = _PERSONAS[name]
    sb = FakeSupabase({}); life = LifeDiscoveryService(sb)
    rm = RelationshipManager(sb, life); ctx = UserContext(user_id="u-" + name)
    cur = await rm.converse(ctx, "", None)
    for _ in range(4):
        pk = cur.get("pending_key")
        if pk == "primary_goal":
            await rm.converse(ctx, stmt, pk); break
        cur = await rm.converse(ctx, "a good life" if pk == "vision" else "x", pk)
    snap = await life.snapshot(ctx)
    assert snap["dominant_narrative"]["key"] == expected
    assert len(snap["goal_portfolio"]) >= 2  # multiple goals coexist (not collapsed to one)


@pytest.mark.parametrize("name", list(_PERSONAS))
@pytest.mark.asyncio
async def test_narrative_validation_with_persona_seed(name):
    """Phase 9 — same, WITH a financial persona seed: persona never overrides the user's life story."""
    stmt, expected = _PERSONAS[name]
    sb = FakeSupabase({"user_persona_profile": [{"user_id": "u2-" + name,
        "primary_goals": ["retire comfortably", "build wealth"], "display_name": "Sandbox"}]})
    life = LifeDiscoveryService(sb)
    rm = RelationshipManager(sb, life, LifeBridgeService(sb, life)); ctx = UserContext(user_id="u2-" + name)
    cur = await rm.converse(ctx, "", None)
    for _ in range(4):
        pk = cur.get("pending_key")
        if pk == "primary_goal":
            await rm.converse(ctx, stmt, pk); break
        cur = await rm.converse(ctx, "a good life" if pk == "vision" else "x", pk)
    snap = await life.snapshot(ctx)
    assert snap["dominant_narrative"]["key"] == expected           # life story wins
    assert snap["dominant_narrative"]["key"] != "financial_stabilization" or expected == "financial_stabilization"


# ── Real-user gate: founder/legacy theme + narrative drift ─────────────────────────────────────────
def test_dominant_narrative_founder_legacy():
    life = LifeDiscoveryService(FakeSupabase({}))
    stmt = ("I am building a company that can change how people make life decisions. I want to build "
            "something meaningful and create a legacy for my family. I'm balancing family, health, law "
            "school, career, and multiple businesses. Financial independence matters mostly for freedom "
            "to spend time with family and build things that matter.")
    assert dominant_narrative(life.analyze_statement(stmt), stmt)["key"] == "legacy_entrepreneurship"


def test_narrative_drift_evolves_on_major_life_event():
    life = LifeDiscoveryService(FakeSupabase({}))
    career = "I'm 28, I work in AI, I want to become a director before 40, considering an MBA or a top AI lab."
    before = dominant_narrative(life.analyze_statement(career), career)["key"]
    after_text = career + " I am getting married next year."
    after = dominant_narrative(life.analyze_statement(after_text), after_text)["key"]
    assert before == "career_acceleration"
    assert after != before  # a major life event (marriage) is NOT ignored — the narrative evolves


def test_narrative_not_sticky_legacy_absorbs_vc():
    life = LifeDiscoveryService(FakeSupabase({}))
    base = "I'm building a company and creating a legacy for my family with multiple businesses."
    drift = base + " I may have an opportunity to raise venture capital."
    assert dominant_narrative(life.analyze_statement(drift), drift)["key"] == "legacy_entrepreneurship"


# ── Question quality for the real-user gate (warmth for crisis/burnout; concrete tradeoff otherwise) ──
async def _next_q(stmt):
    sb = FakeSupabase({}); life = LifeDiscoveryService(sb); rm = RelationshipManager(sb, life)
    ctx = UserContext(user_id="qu")
    cur = await rm.converse(ctx, "", None)
    for _ in range(4):
        pk = cur.get("pending_key")
        if pk == "primary_goal":
            await rm.converse(ctx, stmt, pk); break
        cur = await rm.converse(ctx, "a good life" if pk == "vision" else "x", pk)
    return ((await rm.state(ctx)).get("next_question") or {}).get("prompt", "")


@pytest.mark.asyncio
async def test_crisis_gets_warm_stabilization_question_not_tradeoff():
    q = (await _next_q("I have $18,000 in credit card debt, struggling to make payments, worried about "
                       "losing my apartment, my relationship is suffering, I feel overwhelmed.")).lower()
    assert "stable ground" in q and "postpone" not in q


@pytest.mark.asyncio
async def test_burnout_gets_balance_question_not_postpone_children():
    q = (await _next_q("I make good money. I have two children. I travel constantly. I am exhausted. I have "
                       "gained weight. I am missing time with my family.")).lower()
    assert "postpone" not in q  # never "would you postpone your children?"
    assert "health" in q or "love" in q  # warm balance framing


@pytest.mark.asyncio
async def test_multipursuit_gets_concrete_tradeoff():
    q = await _next_q("Pay off my credit card, save for my wedding, buy a house, start a family, get a "
                      "promotion at NVIDIA, and start a Masters in AI.")
    assert "postpone" in q.lower()
    assert "i am " not in q.lower() and "willing to" not in q.lower()  # names goals, not context/feelings
