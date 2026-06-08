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
