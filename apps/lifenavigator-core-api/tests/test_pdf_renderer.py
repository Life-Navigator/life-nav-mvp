"""Sprint 13 — generic report PDF renderer (HTML builder is pure Python)."""
from app.services.pdf_renderer import _fmt_scalar, _generic_html, _render_value


def test_money_formatting_by_key_hint():
    assert _fmt_scalar("base_salary", 192000) == "$192,000"
    assert _fmt_scalar("coverage_amount", 1500000) == "$1,500,000"
    assert _fmt_scalar("count", 3) == "3"  # not a money key
    assert _fmt_scalar("has_will", True) == "Yes"


def test_render_value_nested_and_lists():
    html = _render_value({"total": 326560, "breakdown": {"base": 192000}, "items": [{"benefit": "401k", "annual_value": 4000}]})
    assert "$326,560" in html and "Base" in html and "401k" in html and "<table" in html


def test_generic_html_has_cover_sections_and_boundary():
    d = {
        "title": "Financial Report", "version": 1,
        "sections": [
            {"key": "a", "title": "Overview", "ord": 1, "body": {"net_worth": 65000}},
            {"key": "b", "title": "Recommendations", "ord": 2, "body": {}, "evidence": [{"metric_name": "emergency fund", "metric_value": "", "source_table": "finance.accounts"}]},
        ],
        "charts": [], "citations": ["finance.accounts"],
        "governance": {"disclaimer_text": "Not financial advice."},
    }
    html = _generic_html(d, "financial")
    assert "LIFENAVIGATOR" in html and "Financial Report" in html
    assert "Overview" in html and "$65,000" in html
    assert "finance.accounts" in html  # evidence + citations
    assert "Not financial advice." in html
    assert html.count("<h2") >= 2  # sections rendered


# ── Phase 9 — Career & Education section ─────────────────────────────────────
from app.services.pdf_renderer import _career_education_html  # noqa: E402


def _career_block(present=True, score=88, status="strong"):
    return {
        "present": present,
        "snapshot": {
            "currentRole": "VP Engineering", "currentEmployer": "Acme",
            "yearsExperience": 16.5, "employmentCount": 4, "volunteerCount": 1,
            "projectCount": 2, "activeCareerGoals": 1,
        },
        "readiness": {
            "score": score, "status": status, "confidence": 90,
            "strengths": ["Clear current role", "Deep tenure"],
            "gaps": ["Career goal missing target date"],
            "recommended_actions": ["Set a target date for your CTO goal"],
            "components": [{"label": "Current role clarity", "score": 15, "max": 15, "reason": "Title + employer on file"}],
        },
        "sources": ["career.experience_records", "career.career_goals"],
        "missing_data": ["Target date for CTO goal"],
        "generated_at": "2026-06-19T00:00:00Z",
    }


def _education_block(present=True, score=84, status="strong"):
    return {
        "present": present,
        "snapshot": {
            "topEducation": {"label": "Master's", "field": "CS", "institution": "Stanford"},
            "certificationsCount": 2, "licensesCount": 0, "coursesCount": 3, "educationGoalsCount": 1,
        },
        "readiness": {
            "score": score, "status": status, "confidence": 85,
            "strengths": ["Completed graduate degree"],
            "gaps": ["No active licenses"],
            "recommended_actions": ["Add any professional licenses"],
            "components": [{"label": "Highest degree", "score": 20, "max": 20, "reason": "Master's completed"}],
        },
        "sources": ["public.education_records", "education.certifications"],
        "missing_data": [],
        "generated_at": "2026-06-19T00:00:00Z",
    }


def test_ce_empty_user_says_so_honestly():
    html = _career_education_html({"available": False, "note": "Career & Education readiness has not been computed yet."}, 7)
    assert "Career &amp; Education" in html
    assert "has not been computed yet" in html
    # no fabricated scores / placeholders
    assert "lorem" not in html.lower()


def test_ce_rich_user_renders_scores_facts_strengths_gaps_actions_provenance():
    ce = {
        "available": True,
        "life_brief": {"title": "Your Life Brief", "summary": "You are a VP Engineering with deep tenure."},
        "career": _career_block(), "education": _education_block(),
        "provenance": {"sources": ["career.experience_records", "public.education_records"], "source_count": 2,
                       "generated_at": "2026-06-19T00:00:00Z"},
    }
    html = _career_education_html(ce, 7)
    # snapshot facts
    assert "VP Engineering" in html and "Acme" in html and "16.5" in html
    assert "Master" in html and "Stanford" in html  # apostrophe is HTML-escaped
    # readiness scores rendered in the rings
    assert ">88<" in html and ">84<" in html
    # strengths / gaps / actions
    assert "Deep tenure" in html and "missing target date" in html and "target date for your CTO" in html
    # component breakdown
    assert "Current role clarity" in html
    # provenance — real source tables, section-level
    assert "career.experience_records" in html and "public.education_records" in html
    assert "Section provenance" in html
    # life brief lead
    assert "deep tenure" in html.lower()


def test_ce_limited_user_shows_missing_data_and_no_fabrication():
    ce = {
        "available": True, "life_brief": None,
        "career": _career_block(score=35, status="limited_data"),
        "education": _education_block(present=False),
        "provenance": {"sources": ["career.experience_records"], "source_count": 1, "generated_at": "2026-06-19T00:00:00Z"},
    }
    html = _career_education_html(ce, 7)
    assert ">35<" in html  # the real low score, not invented
    assert "Limited data" in html
    # education absent → honest empty, no degree invented
    assert "No education data on file yet" in html
    assert "Stanford" not in html
    # missing data surfaced
    assert "Target date for CTO goal" in html


def test_ce_conflicting_user_renders_without_crashing_on_nulls():
    # in-progress degree (no institution), career goal without target date, null score
    career = _career_block(score=None, status="developing")
    career["snapshot"]["currentEmployer"] = None
    edu = _education_block(score=None, status="developing")
    edu["snapshot"]["topEducation"] = None
    html = _career_education_html(
        {"available": True, "life_brief": None, "career": career, "education": edu,
         "provenance": {"sources": [], "source_count": 0}}, 7)
    assert "Career &amp; Education" in html
    assert "No completed degree on file" in html  # honest education empty-fact
    assert "—" in html  # null facts shown as em-dash, never fabricated
