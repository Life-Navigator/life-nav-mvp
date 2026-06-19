"""Phase 8 — advisor career/education fact packet + citation grounding."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.advisor_facts import build_fact_packet, numbers_in_facts
from app.services.advisor_context import AdvisorContext
from app.services.advisor_validator import validate
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
REQUIRED = {"id", "domain", "label", "value", "source", "sourceTable", "recordId", "confidence", "updatedAt"}


@pytest.mark.asyncio
async def test_empty_user_has_empty_fact_packet():
    facts = await build_fact_packet(FakeSupabase({}), CTX)
    assert facts == []


@pytest.mark.asyncio
async def test_packet_emits_career_and_education_facts_with_provenance():
    sb = FakeSupabase({
        "experience_records": [
            {"id": "e1", "title": "VP Engineering", "employer": "Acme", "is_current": True, "start_date": "2010-01-01"},
            {"id": "e2", "title": "Engineer", "employer": "Initech", "is_current": False, "start_date": "2003-01-01"},
        ],
        "volunteer_records": [{"id": "v1", "organization": "Red Cross", "role": "Lead Mentor"}],
        "side_projects": [{"id": "p1", "name": "OSS lib"}],
        "career_goals": [{"id": "g1", "title": "Become CTO", "target_role": "CTO", "target_date": "2028-01-01", "status": "active"}],
        "education_records": [{"id": "d1", "institution_name": "Stanford", "degree_type": "master", "field_of_study": "CS", "status": "completed"}],
        "certifications": [{"id": "c1", "name": "AWS SA", "issuer": "Amazon"}],
        "licenses": [{"id": "l1", "name": "PE", "issuing_authority": "NSPE"}],
        "courses": [{"id": "co1", "course_name": "ML", "provider": "Coursera"}],
        "education_goals": [{"id": "eg1", "title": "Executive education", "status": "active"}],
    })
    facts = await build_fact_packet(sb, CTX)

    # Every fact carries full provenance.
    for f in facts:
        assert REQUIRED.issubset(f.keys())
        assert f["sourceTable"] and "." in f["sourceTable"]
        assert 0 < f["confidence"] <= 1

    by_label = {f["label"] for f in facts}
    assert "Current role" in by_label
    assert "Past role" in by_label
    assert "Degree" in by_label
    assert "Certification" in by_label
    assert "License" in by_label
    assert "Career goal" in by_label

    current = next(f for f in facts if f["label"] == "Current role")
    assert current["value"] == "VP Engineering @ Acme"
    assert current["sourceTable"] == "career.experience_records"
    assert current["recordId"] == "e1"
    assert {f["domain"] for f in facts} == {"career", "education"}


@pytest.mark.asyncio
async def test_years_of_experience_is_a_derived_fact_not_a_guess():
    sb = FakeSupabase({"experience_records": [{"id": "e1", "title": "Eng", "is_current": True, "start_date": "2010-01-01"}]})
    facts = await build_fact_packet(sb, CTX)
    yrs = next((f for f in facts if f["label"] == "Years of experience"), None)
    assert yrs is not None and yrs["value"].startswith("~")
    # the numeric token (e.g. "16.5") is exposed for the validator number-gate
    toks = numbers_in_facts(facts)
    assert toks and all(any(ch.isdigit() for ch in t) for t in toks)


def _ctx_with_packet(packet):
    return AdvisorContext(
        user_id=CTX.user_id, user_message="what do you know about my career?", current_stage="complete",
        life_vision=None, primary_objective=None, candidate_goals=[], rejected_goals=[],
        risks=[], opportunities=[], constraints=[], domains_touched=[], missing_areas=[],
        discovery_pct=50, allowed_numbers=set(), domain_facts=packet,
    )


def _valid_result(confirmed_facts):
    return {
        "decision_frame": "Considering your next career step and what supports it.",
        "tradeoffs": [
            {"option": "stay", "benefit": "stability", "cost": "slower growth"},
            {"option": "move", "benefit": "growth", "cost": "uncertainty"},
        ],
        "what_we_know": ["You are a VP Engineering at Acme"],
        "recommendation": "",
        "what_we_still_need": ["a target date for your next role"],
        "next_question": "What role are you targeting next?",
        "why_this_question": "It anchors the plan.",
        "confirmed_facts": confirmed_facts,
        "candidate_facts": [],
        "relationships_referenced": [],
        "should_persist": False,
    }


def test_validator_keeps_cited_domain_fact_and_drops_fabricated_one():
    packet = [{
        "id": "career.experience_records:e1", "domain": "career", "label": "Current role",
        "value": "VP Engineering @ Acme", "source": "Career experience",
        "sourceTable": "career.experience_records", "recordId": "e1", "confidence": 0.95, "updatedAt": None,
    }]
    ctx = _ctx_with_packet(packet)
    result = _valid_result([
        {"label": "Current role", "value": "VP Engineering @ Acme", "source": "career.experience_records"},  # grounded ✓
        {"label": "Degree", "value": "PhD from Harvard", "source": "public.education_records"},  # fabricated ✗
        {"label": "goal", "value": "become a leader", "source": "user_message"},  # user said ✓
    ])
    ok, safe, reasons = validate(result, ctx)
    assert ok, reasons
    kept = {(f["value"], f["source"]) for f in safe["confirmed_facts"]}
    assert ("VP Engineering @ Acme", "career.experience_records") in kept
    assert ("become a leader", "user_message") in kept
    assert ("PhD from Harvard", "public.education_records") not in kept


def test_validator_drops_domain_fact_with_mismatched_value():
    """A real source table but a value NOT in the packet must be dropped (no fabrication via real source)."""
    packet = [{
        "id": "career.experience_records:e1", "domain": "career", "label": "Current role",
        "value": "VP Engineering @ Acme", "source": "Career experience",
        "sourceTable": "career.experience_records", "recordId": "e1", "confidence": 0.95, "updatedAt": None,
    }]
    ctx = _ctx_with_packet(packet)
    result = _valid_result([
        {"label": "Current role", "value": "Chief Astronaut @ NASA", "source": "career.experience_records"},
    ])
    ok, safe, _ = validate(result, ctx)
    assert ok
    assert safe["confirmed_facts"] == []
