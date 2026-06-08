"""Sprint 4 — universal SVG charts (pure Python; no WeasyPrint needed)."""
from app.services.charts import chart_svg


def test_bar_chart_renders_values():
    svg = chart_svg({"type": "bar", "title": "Cost", "series": [{"label": "MS CS", "value": 42000}, {"label": "Bootcamp", "value": 12000}]})
    assert svg.startswith("<svg") and "</svg>" in svg
    assert "MS CS" in svg


def test_range_chart_marks_scenarios():
    svg = chart_svg({"type": "range", "title": "ROI", "spec": {"worst": 2792, "expected": 4653, "best": 7033}})
    assert "worst" in svg and "expected" in svg and "best" in svg


def test_radar_chart_uses_axes():
    svg = chart_svg({"type": "radar", "title": "Fit", "spec": {"axes": ["fit", "roi", "career"], "values": {"fit": 90, "roi": 30, "career": 55}}})
    assert "fit" in svg and "<polygon" in svg


def test_empty_series_is_graceful():
    svg = chart_svg({"type": "bar", "title": "Empty", "series": []})
    assert "data not available" in svg
