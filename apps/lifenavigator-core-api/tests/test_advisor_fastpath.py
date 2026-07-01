"""First-5 latency: non-supervised advisor turns route to the fast model; supervised (finance/health/complex)
stay on the deep reasoning model. Model selection only — the validator gates BOTH identically."""
from __future__ import annotations

import os
import pytest

from app.models.common import UserContext
from app.services.advisor_orchestrator import AdvisorOrchestrator, select_route_path

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _orch(fast: bool = True):
    deep = object()
    fast_llm = object() if fast else None
    o = AdvisorOrchestrator(None, None, deep, fast_llm=fast_llm)
    return o, deep, fast_llm


def _route(o, route_path: str):
    tr = {"turn_id": "t", "route_path": route_path}
    return o._route(CTX, "hello", None, tr), tr


@pytest.mark.parametrize("rp", ["standard", "fast"])
def test_non_supervised_turns_use_fast_model(rp):
    o, deep, fast = _orch(fast=True)
    (primary, fallback), tr = _route(o, rp)
    assert primary is fast  # fast primary
    assert fallback is deep  # deep same-tier fallback
    assert tr.get("fast_path") is True
    assert tr.get("model_route") == "fast"


def test_supervised_turns_stay_on_deep_model():
    o, deep, fast = _orch(fast=True)
    (primary, fallback), tr = _route(o, "supervised")
    assert primary is deep  # deep reasoning model kept
    assert tr.get("fast_path") is None


def test_no_fast_llm_configured_is_unchanged():
    o, deep, _ = _orch(fast=False)
    (primary, fallback), tr = _route(o, "standard")
    assert primary is deep
    assert tr.get("fast_path") is None


def test_kill_switch_disables_fast_path():
    o, deep, fast = _orch(fast=True)
    os.environ["ADVISOR_FAST_PATH_ENABLED"] = "false"
    try:
        (primary, _), tr = _route(o, "standard")
        assert primary is deep  # kill-switch → deep model
        assert tr.get("fast_path") is None
    finally:
        del os.environ["ADVISOR_FAST_PATH_ENABLED"]


def test_route_path_classifier_keeps_finance_and_complex_supervised():
    # finance/health + cross-domain + high-risk → supervised (deep). Simple/general → fast/standard.
    assert select_route_path("what should my emergency fund be?", ["finance"]) == "supervised"
    assert select_route_path("compare buying before vs after the promotion", ["finance", "career"]) == "supervised"
    assert select_route_path("thanks!", []) == "fast"
    assert select_route_path("can you explain that more simply?", []) in ("standard", "fast")
