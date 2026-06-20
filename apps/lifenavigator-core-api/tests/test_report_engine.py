"""Sprint 3 — Universal Reporting Platform: 4 report types, typed refs, reproducibility."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.report_engine import REPORT_TYPES, UniversalReportEngine, content_hash

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
ACCOUNT = {"id": "a1", "name": "Checking", "account_type": "depository", "current_balance": 6000, "currency": "USD"}
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
PROGRAM = {"id": "p1", "name": "MS CS", "level": "masters", "major": "Computer Science", "modality": "hybrid", "duration_months": 24, "tuition": 42000, "graduation_rate": 0.86, "median_salary": 145000, "source": "College Scorecard", "school_id": "s1"}
DECISION = {"id": "d1", "question": "MBA?", "decision_type": "mba_or_invest", "title": "MBA vs invest", "description": "lean invest", "confidence": 0.7, "affected_domains": ["education", "finance"], "scenarios_json": [{"label": "worst", "value": -1000}, {"label": "expected", "value": 5000}, {"label": "best", "value": 12000}], "evidence_json": [{"metric_name": "income_lift", "metric_value": 5000, "source_table": "education.programs", "confidence": 0.7}], "assumptions_json": [{"assumption_text": "Scorecard cohort", "confidence": 0.7}], "tradeoffs_json": []}

ROWS = {
    "financial_accounts": [ACCOUNT], "programs": [PROGRAM], "career_profiles": [CAREER_PROFILE],
    "compensation_bands": BANDS, "decisions": [DECISION],
}


def _engine(rows: dict) -> UniversalReportEngine:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    domains = {
        "finance": FinanceService(supabase=sb),
        "health": HealthService(supabase=sb),
        "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)),
        "family": FamilyService(sb, comp),
    }
    return UniversalReportEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)


@pytest.mark.asyncio
@pytest.mark.parametrize("rtype", REPORT_TYPES)
async def test_each_report_type_builds_with_sections(rtype):
    d = await _engine(ROWS).build(CTX, rtype)
    assert d.report_type == rtype
    assert d.sections  # always at least one section
    assert d.title


@pytest.mark.asyncio
async def test_financial_report_has_overview_and_recommendation_refs():
    d = await _engine(ROWS).build(CTX, "financial")
    keys = {s.key for s in d.sections}
    assert any("overview" in k for k in keys)
    assert any("recommendations" in k for k in keys)


@pytest.mark.asyncio
async def test_education_report_has_charts_and_evidence_refs():
    d = await _engine(ROWS).build(CTX, "education")
    assert len(d.sections) == 9  # the 9-section E3 report mapped in
    assert d.charts  # chart definitions carried over
    appendix = next(s for s in d.sections if s.key == "9_evidence_appendix")
    assert appendix.evidence and all(e.source_table for e in appendix.evidence)


@pytest.mark.asyncio
async def test_decision_report_renders_scenarios():
    d = await _engine(ROWS).build(CTX, "decision")
    sec = d.sections[0]
    assert sec.body["scenarios"]
    assert any(c.type == "scenario" for c in d.charts)


@pytest.mark.asyncio
async def test_full_report_spans_domains():
    d = await _engine(ROWS).build(CTX, "full")
    assert d.report_type == "full"
    # P4: advisor-grade reports lead with the executive briefing, then span domains.
    assert any(s.key == "advisor_executive" for s in d.sections)
    assert any(s.key == "executive_summary" for s in d.sections)
    assert len(d.sections) > 4


@pytest.mark.asyncio
async def test_reports_are_reproducible_same_input_same_hash():
    h1 = content_hash(await _engine(ROWS).build(CTX, "full"))
    h2 = content_hash(await _engine(ROWS).build(CTX, "full"))
    assert h1 == h2  # same inputs -> same hash (timestamps normalized out)


@pytest.mark.asyncio
async def test_hash_changes_when_input_changes():
    base = content_hash(await _engine(ROWS).build(CTX, "financial"))
    changed = content_hash(await _engine({**ROWS, "financial_accounts": [{**ACCOUNT, "current_balance": 999999}]}).build(CTX, "financial"))
    assert base != changed


@pytest.mark.asyncio
async def test_generate_stores_report_and_version():
    eng = _engine(ROWS)
    res = await eng.generate(CTX, "education")
    assert res["content_hash"] and res["version"] >= 1 and res["report_id"]
    # the store wrote a reports row + a report_versions row
    tables = [t for t, _ in eng._sb.inserts]  # type: ignore[attr-defined]
    assert "reports" in tables and "report_versions" in tables


# ── Phase 9 — Career & Education section reads readiness snapshots ────────────
def _snap(domain, score, status, snapshot):
    return {
        "domain": domain, "score": score, "status": status, "confidence": 90,
        "components": [{"label": "x", "score": 5, "max": 10, "reason": "r"}],
        "strengths": ["s1"], "gaps": ["g1"], "recommended_actions": ["a1"],
        "data_sources": [f"{domain}.records"], "missing_data": ["m1"],
        "payload": {"snapshot": snapshot}, "generated_at": "2026-06-19T00:00:00Z",
    }


@pytest.mark.asyncio
async def test_career_education_section_reads_snapshots_one_source_of_truth():
    rows = dict(ROWS)
    rows["readiness_snapshots"] = [
        _snap("career", 88, "strong", {"currentRole": "VP Eng", "employmentCount": 3}),
        _snap("education", 84, "strong", {"topEducation": {"label": "Master's"}, "certificationsCount": 2}),
    ]
    sec = await _engine(rows)._career_education_section(CTX, 7)
    assert sec is not None and sec.body["available"] is True
    # scores come straight from the snapshot rows — not recomputed
    assert sec.body["career"]["readiness"]["score"] == 88
    assert sec.body["education"]["readiness"]["score"] == 84
    assert sec.body["career"]["snapshot"]["currentRole"] == "VP Eng"
    # provenance lists the real source tables, deduped
    assert set(sec.body["provenance"]["sources"]) == {"career.records", "education.records"}
    # evidence references carry the source table for auditability
    assert any(e.source_table for e in sec.evidence)


@pytest.mark.asyncio
async def test_career_education_section_honest_when_no_snapshots():
    sec = await _engine(ROWS)._career_education_section(CTX, 7)
    assert sec is not None and sec.body["available"] is False
    assert "has not been computed" in sec.body["note"]


@pytest.mark.asyncio
async def test_full_report_includes_career_education_section_when_snapshots_exist():
    rows = dict(ROWS)
    rows["readiness_snapshots"] = [
        _snap("career", 88, "strong", {"currentRole": "VP Eng", "employmentCount": 3}),
        _snap("education", 84, "strong", {"topEducation": {"label": "Master's"}}),
    ]
    d = await _engine(rows).build(CTX, "full")
    ce = next((s for s in d.sections if s.key == "career_education"), None)
    assert ce is not None and ce.body["available"] is True
    assert ce.body["career"]["readiness"]["score"] == 88
