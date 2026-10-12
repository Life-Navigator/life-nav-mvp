"""Phase A drift gates — the tests whose job is to FAIL when reference data or structure rots.

Every gate here exists because a specific silent-wrongness already happened in this repo, or is
one the build plan commits to preventing. A gate that can never fail is decoration; each of these
has a concrete trigger stated in its docstring.
"""
from __future__ import annotations

import ast
import os
from datetime import date

import pytest

from app.services import assumptions as A
from app.services import tools as T
from app.services.calculators import base, versioned_data as V

_CALC_DIR = os.path.dirname(base.__file__)
_SERVICES_DIR = os.path.dirname(A.__file__)


# ── Gate 1: reference data must not go stale silently ─────────────────────────────────────────────
def test_no_registered_dataset_family_is_stale():
    """FAILS when a dataset family has data on disk but nothing for the current year.

    THE TRIGGER: `apps/web/src/lib/finance/tax.ts` has shipped `BRACKETS_2024` and
    `STANDARD_DEDUCTION_2024` into 2026 — two tax years stale, hardcoded, with nothing to notice.
    This gate is what makes that impossible for the Python engine.

    By design this fires every January for families that need a refresh. That is the point; see the
    build plan's open question 5 on ownership.
    """
    stale = V.stale_families()
    assert not stale, (
        f"stale reference data for {date.today().year}: "
        + "; ".join(f"{s['family']} (have {s['have']}, phase {s['phase']})" for s in stale)
    )


def test_every_declared_family_resolves_or_is_honestly_unshipped():
    """A declared family must either load or raise a message naming its phase — never return {}."""
    for name in V.FAMILIES:
        try:
            loaded = V.load(name)
        except V.VersionedDataError as exc:
            assert "has not shipped" in str(exc) or "no " in str(exc), f"{name}: {exc}"
        else:
            assert isinstance(loaded.data, dict) and loaded.data, name


# ── Gate 2: no duplicate calculators ──────────────────────────────────────────────────────────────
# The two registries overlap today: `tools.debt_payoff` vs `calculators.debt.payoff_months`, and
# `tools.retirement_projection` vs `calculators.retirement.projected_balance`. Phase A records the
# overlap explicitly rather than pretending it is gone — an undeclared duplicate is what diverges.
KNOWN_OVERLAPS: dict[str, str] = {
    "debt_payoff": "debt.payoff_months / debt.avalanche_order",
    "retirement_projection": "retirement.projected_balance / retirement.balance_needed",
    "home_affordability": "debt.amortized_payment (inverted)",
    "degree_roi": "primitives.payback_period (superseded by Phase H/J college_comparison)",
    "offer_comparison": "superseded by Phase I/J offer_impact",
}


def test_calculator_ids_are_unique_within_the_registry():
    """`base.register` raises on a duplicate id, so this asserts the registry agrees with itself."""
    ids = base.available()
    assert len(ids) == len(set(ids))
    for cid in ids:
        assert base.get(cid) is not None and cid.count(".") == 1, cid


def test_every_tools_py_overlap_is_declared():
    """FAILS when a NEW tool is added to `tools.py` that duplicates a calculator without being
    recorded here. Consolidation is Phase A's debt; adding to it silently is the thing to catch."""
    undeclared = set(T.REGISTRY) - set(KNOWN_OVERLAPS) - {
        "emergency_fund", "savings_rate", "net_worth", "k401_match", "rent_vs_buy",
    }
    assert not undeclared, (
        f"new tools.py entries not declared in KNOWN_OVERLAPS: {sorted(undeclared)} — either "
        f"register them in calculators/ or record the overlap"
    )


# ── Gate 3: no inline assumptions ─────────────────────────────────────────────────────────────────
# Rule R2. `assumptions.py` states that "no projection may invent an assumption inline", and Phase A
# found five live violations in `tools.py` plus two in `financial_resolver.py`.
_ASSUMPTION_SHAPED_LITERALS = {
    0.28, 0.36,            # DTI pair          → dti_front_pct / dti_back_pct
    0.04,                  # withdrawal rate   → withdrawal_rate
    0.025, 0.035, 0.05,    # inflation/appreciation/tuition
    0.068,                 # mortgage rate     → mortgage_rate
    0.8, 0.80,             # replacement ratio → retirement_replacement
}


# Keyword arguments whose float values are scores and thresholds, never assumptions. Without this
# exclusion the gate flagged five `confidence=0.8` arguments as a hardcoded `retirement_replacement`
# (0.80) — a false positive, and a gate that cries wolf is a gate people learn to skip.
_NON_ASSUMPTION_KWARGS = {"confidence", "confidence_band", "weight", "threshold", "tol", "rel", "abs"}


def _float_literals(path: str) -> set[float]:
    """Float literals in `path`, excluding values passed to a score/threshold keyword argument."""
    with open(path) as fh:
        tree = ast.parse(fh.read(), filename=path)
    excluded: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg in _NON_ASSUMPTION_KWARGS and isinstance(kw.value, ast.Constant):
                    excluded.add(id(kw.value))
        # `def _band(c: float)` style defaults and comparisons against a score threshold.
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            for arg, default in zip(args.args[len(args.args) - len(args.defaults):], args.defaults):
                if arg.arg in _NON_ASSUMPTION_KWARGS and isinstance(default, ast.Constant):
                    excluded.add(id(default))
            for arg, default in zip(args.kwonlyargs, args.kw_defaults):
                if arg.arg in _NON_ASSUMPTION_KWARGS and isinstance(default, ast.Constant):
                    excluded.add(id(default))
        if isinstance(node, ast.Compare):
            # `c >= 0.8` where c is a confidence-ish name.
            left = node.left
            if isinstance(left, ast.Name) and left.id in {"c", "conf", "confidence", "score"}:
                for comp in node.comparators:
                    if isinstance(comp, ast.Constant):
                        excluded.add(id(comp))
    return {n.value for n in ast.walk(tree)
            if isinstance(n, ast.Constant) and isinstance(n.value, float)
            and id(n) not in excluded}


@pytest.mark.parametrize("module", ["tools.py", "financial_resolver.py", "scenario_compare.py"])
def test_no_assumption_shaped_rate_literals_outside_the_registry(module):
    """FAILS when a registry-owned rate is hardcoded back into a service.

    Deliberately a NARROW allowlist of known assumption values, not every float — a confidence
    score of 0.9 or a rounding factor is not an assumption. The gate catches regressions of the
    exact kind Phase A removed, without producing noise that gets suppressed.
    """
    found = _float_literals(os.path.join(_SERVICES_DIR, module)) & _ASSUMPTION_SHAPED_LITERALS
    assert not found, (
        f"{module} hardcodes assumption-shaped rate(s) {sorted(found)} — source them from "
        f"assumptions.py via A.value()/A.cite()"
    )


def test_calculators_never_hardcode_a_registry_rate():
    for entry in sorted(os.listdir(_CALC_DIR)):
        if not entry.endswith(".py"):
            continue
        found = _float_literals(os.path.join(_CALC_DIR, entry)) & _ASSUMPTION_SHAPED_LITERALS
        assert not found, f"calculators/{entry} hardcodes {sorted(found)}"


def test_registry_covers_every_assumption_the_tools_cite():
    """A `A.cite("typo")` would KeyError at runtime, inside a user request. Catch it here instead."""
    for key in ("investment_return", "inflation", "mortgage_rate", "mortgage_term_months",
                "down_payment_pct", "withdrawal_rate", "retirement_replacement", "tuition_inflation",
                "home_appreciation", "retirement_age", "working_years_horizon",
                "rent_vs_buy_horizon", "dti_front_pct", "dti_back_pct",
                "default_contribution_rate_pct"):
        cited = A.cite(key)
        assert cited["label"] and cited["basis"], key
        assert cited["value"] is not None, key


# ── Gate 4: silent zeros stay dead ────────────────────────────────────────────────────────────────
def test_tools_module_no_longer_exposes_a_defaulting_parser():
    """FAILS if `_f(v, default=0.0)` comes back. It turned every missing input into a confident
    zero across all ten tools, which is the single defect Phase A was written to remove."""
    assert not hasattr(T, "_f"), "_f() is back — use _req()/_opt() so absence cannot become 0.0"
    assert hasattr(T, "_req") and hasattr(T, "_opt") and hasattr(T, "_parse")


@pytest.mark.parametrize("tool_name", sorted(T.REGISTRY))
def test_every_tool_refuses_empty_input_rather_than_answering(tool_name):
    """Called with nothing, a tool must raise or report unavailable — never produce a figure.

    `debt_payoff({})` legitimately reports `available: False` for an empty debt list, which is a
    real answer about a real (empty) portfolio rather than a fabricated number.
    """
    try:
        out = T.REGISTRY[tool_name]["fn"]({})
    except T.ToolInputError:
        return
    numeric = {k: v for k, v in out["outputs"].items() if isinstance(v, (int, float)) and v}
    assert not numeric, f"{tool_name} produced {numeric} from no inputs at all"


# ── Gate 5: parity fixtures ───────────────────────────────────────────────────────────────────────
def test_cross_language_parity_fixture_exists_and_is_loaded_by_both_sides():
    """R7. The fixture is the only thing keeping the Python and TypeScript engines in agreement; if
    it is deleted or renamed on one side, the two can drift apart silently for a release."""
    import json
    app_root = os.path.abspath(os.path.join(_SERVICES_DIR, "..", ".."))
    repo = os.path.abspath(os.path.join(app_root, "..", ".."))
    # Repo root, not app root — the fixture is shared by both languages, so it lives above both.
    fixture = os.path.join(repo, "fixtures", "financial-parity.json")
    assert os.path.exists(fixture), f"missing parity fixture at {fixture}"
    with open(fixture) as fh:
        cases = json.load(fh)
    assert cases, "parity fixture is empty"

    ts_test = os.path.join(repo, "apps", "web", "src", "lib", "trajectory", "__tests__",
                           "parity.test.ts")
    assert os.path.exists(ts_test), "the TypeScript half of the parity check is gone"
    with open(ts_test) as fh:
        assert "financial-parity.json" in fh.read(), "TS parity test no longer reads the fixture"
