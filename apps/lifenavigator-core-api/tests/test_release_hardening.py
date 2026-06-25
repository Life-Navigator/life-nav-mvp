"""RELEASE_HARDENING: fallback-cause classification + latency-aware route tiers (items 2 & 4)."""
from app.services.advisor_orchestrator import classify_fallback_cause, select_route_path


def test_classify_infra_auth():
    assert classify_fallback_cause("fallback:unavailable", "VertexAuthError", []) == "infrastructure_auth"
    assert classify_fallback_cause("fallback:unavailable", "PermissionError", []) == "infrastructure_auth"
    assert classify_fallback_cause("fallback:unavailable", "not_available", []) == "infrastructure_auth"

def test_classify_provider_timeout():
    assert classify_fallback_cause("fallback:unavailable", "ReadTimeout", []) == "provider_timeout"
    assert classify_fallback_cause("fallback:unavailable", "ConnectError", []) == "provider_timeout"

def test_classify_malformed():
    assert classify_fallback_cause("fallback:unavailable", "malformed_output", []) == "malformed_output"
    assert classify_fallback_cause("fallback:empty", "", []) == "malformed_output"

def test_classify_trust_spine():
    assert classify_fallback_cause("fallback:invented numbers", "", ["invented numbers not in context: ['100000']"]) == "trust_spine_block"

def test_classify_policy_safety():
    assert classify_fallback_cause("fallback:advice", "", ["contains advice/recommendation/medical-legal language"]) == "policy_safety_gate"

def test_classify_safety_gate():
    assert classify_fallback_cause("safety_fallback", "", []) == "safety_gate"

def test_classify_not_a_fallback():
    assert classify_fallback_cause("enhanced", "", []) == ""

def test_route_supervised_for_money():
    assert select_route_path("Can I afford a $500,000 home?", []) == "supervised"
    assert select_route_path("How should I invest for retirement?", []) == "supervised"

def test_route_supervised_for_health_finance_domain():
    assert select_route_path("plan please", ["health"]) == "supervised"
    assert select_route_path("plan please", ["finance"]) == "supervised"

def test_route_supervised_for_cross_domain():
    assert select_route_path("give me a briefing", ["career", "education"]) == "supervised"

def test_route_fast_for_trivial():
    assert select_route_path("hi", []) == "fast"
    assert select_route_path("thanks", []) == "fast"

def test_route_standard_default():
    assert select_route_path("How do I get promoted faster?", ["career"]) == "standard"
