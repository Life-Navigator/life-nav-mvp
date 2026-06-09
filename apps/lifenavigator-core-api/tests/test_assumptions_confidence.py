"""Sprint 24 — assumption registry + explainable confidence."""
from app.services import assumptions as A
from app.services import confidence as C


def test_registry_has_cited_assumptions():
    for key in ("investment_return", "inflation", "tuition_inflation", "withdrawal_rate", "life_expectancy", "ss_replacement", "mortgage_rate"):
        a = A.get(key)
        assert a.basis and a.label and a.category  # every assumption is cited + labeled


def test_overrides_apply():
    assert A.value("investment_return") == 0.06
    assert A.value("investment_return", {"investment_return": 0.05}) == 0.05


def test_cite_returns_lineage_ref():
    c = A.cite("withdrawal_rate")
    assert c["key"] == "withdrawal_rate" and c["basis"] and c["value"] == 0.04


def test_confidence_is_component_based_and_explainable():
    b = C.build(document_coverage=0.9, reference_quality=0.95, missing_inputs=1, projection_years=25, volatility=0.12, scenario_depth=2)
    assert 0 <= b["overall"] <= 100
    labels = {c["label"] for c in b["components"]}
    assert {"Document coverage", "Reference data quality", "Missing information", "Projection uncertainty", "Scenario complexity"} == labels
    # penalties are negative, positives positive
    assert all(c["value"] <= 0 for c in b["components"] if c["kind"] == "penalty")
    assert b["overall"] == sum(c["value"] for c in b["components"]) or b["overall"] in (0, 100)


def test_more_missing_data_lowers_confidence():
    strong = C.build(document_coverage=1.0, reference_quality=1.0, missing_inputs=0)["overall"]
    weak = C.build(document_coverage=0.3, reference_quality=0.5, missing_inputs=3)["overall"]
    assert strong > weak
