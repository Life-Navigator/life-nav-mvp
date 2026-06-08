"""Sprint 6 — Advisor Sharing Platform: tokens, consent, revocation, expiration, audit, redaction."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.report_engine import UniversalReportEngine
from app.services.sharing import ShareService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
ACCOUNT = {"id": "a1", "name": "Checking", "account_type": "depository", "current_balance": 6000, "currency": "USD"}
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
PROGRAM = {"id": "p1", "name": "MS CS", "level": "masters", "major": "Computer Science", "duration_months": 24, "tuition": 42000, "graduation_rate": 0.86, "median_salary": 145000, "source": "Scorecard", "school_id": "s1"}
ROWS = {"financial_accounts": [ACCOUNT], "programs": [PROGRAM], "career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS}


def _share(rows: dict) -> ShareService:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    engine = UniversalReportEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    return ShareService(supabase=sb, reports=engine)


@pytest.mark.asyncio
async def test_create_share_returns_token_and_consent_row():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="education", audience="parent", expires_in_days=7)
    assert res["token"] and res["share_path"].endswith(res["token"])
    assert res["audience"] == "parent" and res["stored"]


@pytest.mark.asyncio
async def test_resolve_valid_token_returns_report():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="education", audience="parent")
    view = await svc.resolve(res["token"])
    assert view["ok"] and view["report"]["sections"]
    assert view["audience"] == "parent"


@pytest.mark.asyncio
async def test_revocation_blocks_access():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="education", audience="advisor")
    await svc.revoke(CTX, res["share_id"])
    view = await svc.resolve(res["token"])
    assert not view["ok"] and view["reason"] == "revoked"


@pytest.mark.asyncio
async def test_expiration_blocks_access():
    svc = _share(dict(ROWS))
    # inject an already-expired share + a report row directly
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    await svc._sb.insert("reports", {"id": "r1", "content_json": {"sections": []}}, schema="reporting")  # type: ignore[attr-defined]
    await svc._sb.insert("report_shares", {"id": "s1", "report_id": "r1", "user_id": CTX.user_id,  # type: ignore[attr-defined]
                                           "token": "EXPIRED", "audience": "cpa", "expires_at": past, "revoked": False}, schema="reporting")
    view = await svc.resolve("EXPIRED")
    assert not view["ok"] and view["reason"] == "expired"


@pytest.mark.asyncio
async def test_unknown_token_not_found():
    view = await _share(dict(ROWS)).resolve("does-not-exist")
    assert not view["ok"] and view["reason"] == "not_found"


@pytest.mark.asyncio
async def test_audience_redaction_hides_out_of_scope_sections():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="full", audience="parent")  # parent sees education+general only
    view = await svc.resolve(res["token"])
    keys = [s["key"] for s in view["report"]["sections"]]
    assert view["redacted"] is True
    assert not any(k.startswith("finance") or k.startswith("career") or k.startswith("health") for k in keys)


@pytest.mark.asyncio
async def test_advisor_sees_full_report_unredacted():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="full", audience="advisor")
    view = await svc.resolve(res["token"])
    assert view["redacted"] is False


@pytest.mark.asyncio
async def test_access_is_audited():
    svc = _share(dict(ROWS))
    res = await svc.create_share(CTX, report_type="education", audience="attorney")
    await svc.resolve(res["token"])
    log = await svc.audit_log(CTX)
    assert any(e.get("outcome") == "granted" and e.get("audience") == "attorney" for e in log)


@pytest.mark.asyncio
async def test_invalid_audience_rejected():
    with pytest.raises(ValueError):
        await _share(dict(ROWS)).create_share(CTX, report_type="education", audience="stranger")
