"""The calculators are for the MODELS, not for users (owner decision, 2026-10-11).

WHY THIS BOUNDARY EXISTS
------------------------
`/v1/tools` used to expose a catalog of every deterministic calculator plus
`POST /v1/tools/{name}/run`, which accepted arbitrary user-supplied inputs. A web proxy at
`apps/web/src/app/api/tools/run` fronted it. Both are gone.

Three reasons, beyond the instruction:

1. **The engine is the moat.** A public calculator catalog hands away the deterministic layer and
   lets anyone extract its value without the advisor that frames it.
2. **Direct invocation bypasses every guardrail.** The number gate, strict/scenario tiering, the
   disclosure tier and the gap-vs-guess discipline all live in the advisor path. A raw `/run` call
   returns an unhedged, undisclosed figure.
3. **User-supplied inputs are unprovenanced.** `FinancialInputResolver` exists so that a cited
   number traces to real data. A hand-typed input produces a confident figure about nothing — the
   same failure as the silent zeros Phase A removed, arriving through the front door instead.

THE LINE THIS DRAWS
-------------------
Forbidden: a route that takes a calculator NAME and an INPUT BAG from the request.
Allowed: a domain route that computes from the user's CANONICAL data and returns a named missing
state when an input is absent — `/v1/finance/retirement-projection` is the model case. The user
cannot choose the calculator and cannot substitute the inputs.
"""
from __future__ import annotations

import os
import pathlib

import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-key")

from app.main import create_app  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parents[3]
APP = pathlib.Path(__file__).resolve().parents[1] / "app"


@pytest.fixture(scope="module")
def routes():
    return sorted({r.path for r in create_app().routes})


# ── No generic calculator surface ─────────────────────────────────────────────────────────────────
def test_no_route_exposes_arbitrary_calculator_invocation(routes):
    """FAILS if a route ever again takes a calculator name as a path or query parameter.

    The specific shape being banned is `/{name}/run` — name from the request, inputs from the body.
    """
    offenders = [p for p in routes
                 if "/tools" in p or "/calculator" in p or p.endswith("/run")]
    assert not offenders, (
        f"these routes expose calculator invocation to users: {offenders}. Calculators are "
        f"model-only; add a DOMAIN endpoint that computes from canonical data instead."
    )


def test_the_tools_router_module_is_gone():
    assert not (APP / "routers" / "tools.py").exists(), (
        "app/routers/tools.py is back — it exposed a catalog of every calculator plus arbitrary "
        "invocation"
    )


def test_the_web_proxy_is_gone():
    assert not (REPO / "apps" / "web" / "src" / "app" / "api" / "tools" / "run").exists(), (
        "the web /api/tools/run proxy is back — it fronted arbitrary calculator invocation from "
        "the browser"
    )


def test_main_does_not_register_a_tools_router():
    src = (APP / "main.py").read_text()
    assert "tools.router" not in src
    assert "include_router(tools" not in src


# ── No catalog leak ───────────────────────────────────────────────────────────────────────────────
def test_no_router_serves_the_calculator_catalog():
    """`ToolRunner.catalog()` still exists for internal use and for the drift gates — it must not
    be reachable over HTTP. The catalog is a map of the moat.

    Checked by scanning the router sources rather than the route PATHS: an earlier version of this
    test matched any path containing "catalog" and flagged `/v1/documents/catalog`, which is the
    document-type taxonomy and has nothing to do with calculators. A gate that fires on unrelated
    routes gets weakened, so it tests the actual call instead of a word.
    """
    offenders = []
    for path in (APP / "routers").glob("*.py"):
        src = path.read_text()
        if "ToolRunner.catalog" in src or "runner.catalog" in src:
            offenders.append(path.name)
    assert not offenders, f"these routers serve the calculator catalog: {offenders}"


def test_no_router_imports_the_tool_runner_for_a_generic_endpoint():
    """`finance.py` legitimately uses ToolRunner for ONE canonical-data projection. Any other
    router importing it is a new surface that needs this boundary re-argued."""
    allowed = {"finance.py"}
    offenders = []
    for path in (APP / "routers").glob("*.py"):
        if path.name in allowed:
            continue
        if "ToolRunner" in path.read_text():
            offenders.append(path.name)
    assert not offenders, (
        f"routers importing ToolRunner outside the allowed set: {offenders}. A new calculator "
        f"surface must be a deliberate decision, not an import."
    )


# ── What IS allowed, and why it is different ──────────────────────────────────────────────────────
def test_the_canonical_domain_projection_survives(routes):
    """The distinction that matters: this route computes from the user's RESOLVED data. They cannot
    pick the calculator and cannot substitute the inputs — so it carries provenance and returns a
    named missing state rather than a figure about nothing."""
    assert "/v1/finance/retirement-projection" in routes


def test_that_projection_takes_no_financial_inputs_from_the_request():
    """Its only parameter is `current_age`, which is user-entered BY NECESSITY (it is never in
    finance.* data) and is persisted canonically when supplied. No balances, no rates, no income —
    those all come from the resolver, or the response is a missing state."""
    src = (APP / "routers" / "finance.py").read_text()
    block = src[src.index("async def retirement_projection_card"):][:600]
    for forbidden in ("current_assets", "annual_contribution", "income", "balance", "apr", "rate"):
        assert f"{forbidden}:" not in block, (
            f"retirement-projection accepts `{forbidden}` from the request — that makes it an "
            f"arbitrary calculator call wearing a domain route's clothes"
        )


# ── The engine stays internally available ─────────────────────────────────────────────────────────
def test_calculators_remain_reachable_to_the_advisor():
    """Closing the user surface must not close the model's. The whole point is that the advisor
    still composes the engine."""
    from app.services import advisor_calc_coverage as COV
    report = COV.coverage_report()
    assert report["wired"], "the advisor must still reach calculators"
    assert len(report["wired"]) >= 16


def test_the_tool_runner_is_still_an_internal_service():
    """Used by scenario_compare, financial_resolver and report_engine — all server-side paths that
    run on canonical data. Removing the ROUTER must not have removed the service."""
    from app.services.tools import REGISTRY, ToolRunner
    assert len(REGISTRY) == 10
    assert callable(ToolRunner.catalog)
