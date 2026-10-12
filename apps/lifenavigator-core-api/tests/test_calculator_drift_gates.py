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


# ── Gates 1 & 6: reference data must be present AND verified ──────────────────────────────────────
#
# WHY THERE IS A DECLARED PENDING LIST
# ------------------------------------
# A gate that fails permanently gets disabled, and a disabled gate protects nothing. But silently
# passing unverified data is the whole defect being prevented. So the gates assert an EXACT match
# against a declared list: anything new fails immediately, and each known gap is recorded here with
# what it needs. Removing an entry tightens the gate automatically, and the list doubles as the
# work queue. It cannot be used to hide a problem, because every entry is visible in review and
# carries its own reason.

PENDING_DATA: dict[str, str] = {
    "state_tax": "only 2024 exists. Needs the current year; the top ~12 states by user count are "
                 "now modelled but their rates are unverified (see PENDING_VERIFICATION).",
}

PENDING_VERIFICATION: dict[str, str] = {
    "tax_tables": "2026.json is now SOURCED from Rev. Proc. 2025-32 (brackets, standard "
                  "deduction, LTCG breakpoints, AMT, CTC, EITC, student-loan phase-out, 448(c)) "
                  "and the SSA wage base, with per-field citations in _meta.sources. Pending the "
                  "owner's CPA sign-off only. Sourcing CORRECTED three figures the earlier "
                  "model-knowledge version had wrong: the child tax credit ($2,000 -> $2,200), "
                  "the student-loan phase-out ($80-95k -> $85-100k) and the 448(c) test "
                  "($30M -> $32M); the EITC parameters were 2024 values throughout. The 2024 "
                  "`credits` section remains unsourced.",
    "tax_parameters": "2026 figures are now SOURCED from primary documents (Rev. Proc. 2025-19 "
                      "for HSA/HDHP, Notice 2025-67 for retirement limits, Rev. Proc. 2025-32 for "
                      "FSA and student-loan interest) and carry per-field citations. Pending the "
                      "owner's CPA sign-off only. Two items remain UNSOURCED and are flagged in "
                      "the file's _meta.unsourced_still: the dependent-care FSA limit and the RMD "
                      "age. NOTE the RULES in tax_wrappers.py and tax_debt_interest.py are "
                      "statutory structure and are NOT pending — only these amounts are.",
}


def test_no_registered_dataset_family_is_stale():
    """FAILS when a dataset family has data on disk but nothing for the current year.

    THE TRIGGER: `apps/web/src/lib/finance/tax.ts` has shipped `BRACKETS_2024` and
    `STANDARD_DEDUCTION_2024` into 2026 — two tax years stale, hardcoded, with nothing to notice.
    This gate is what makes that impossible for the Python engine.

    By design this fires every January for families that need a refresh. That is the point; see the
    build plan's open question 5 on ownership.
    """
    stale = {s["family"]: s for s in V.stale_families()}
    unexpected = set(stale) - set(PENDING_DATA)
    assert not unexpected, (
        f"newly stale reference data for {date.today().year}: "
        + "; ".join(f"{f} (have {stale[f]['have']}, phase {stale[f]['phase']})"
                    for f in sorted(unexpected))
    )
    fixed = set(PENDING_DATA) - set(stale)
    assert not fixed, (
        f"{sorted(fixed)} now has current-year data — remove it from PENDING_DATA so the gate "
        f"protects it from regressing"
    )


def test_every_pending_entry_names_a_real_family_and_states_what_it_needs():
    """Keeps the lists honest: no stale entries for families that no longer exist, no blank
    reasons that would turn the list into a silent suppression mechanism."""
    for name, reason in {**PENDING_DATA, **PENDING_VERIFICATION}.items():
        assert name in V.FAMILIES, f"{name} is not a declared dataset family"
        assert len(reason) > 40, f"{name}: the reason must say what is actually needed"


def test_every_declared_family_resolves_or_is_honestly_unshipped():
    """A declared family must either load or raise a message naming its phase — never return {}."""
    for name in V.FAMILIES:
        try:
            loaded = V.load(name)
        except V.VersionedDataError as exc:
            assert "has not shipped" in str(exc) or "no " in str(exc), f"{name}: {exc}"
        else:
            assert isinstance(loaded.data, dict) and loaded.data, name


# ── Gate 2: tools.py must stay an adapter ─────────────────────────────────────────────────────────
# Phase A moved every tool's arithmetic into `calculators/` and left `tools.py` as a thin
# composition layer. These gates keep it that way: the failure mode being prevented is a second
# engine growing back inside the adapter, which is how two implementations of compound growth come
# to disagree about the same user's retirement balance.

# Every tool, and the calculators it must delegate to. A tool missing from here is a new tool that
# nobody decided the delegation for.
TOOL_DELEGATION: dict[str, set[str]] = {
    "emergency_fund": {"cash.months_covered", "cash.emergency_fund_gap"},
    "savings_rate": {"cash.savings_rate"},
    "net_worth": {"cash.net_worth"},
    "debt_payoff": {"debt.payoff_plan"},
    "retirement_projection": {"retirement.projected_balance", "retirement.balance_needed"},
    "k401_match": {"career.uncaptured_match"},
    "home_affordability": {"housing.max_home_price"},
    "rent_vs_buy": {"housing.rent_vs_buy"},
    "offer_comparison": {"career.offer_total_comp"},
    "degree_roi": {"education.degree_total_cost", "education.degree_lifetime_value",
                   "education.degree_payback_years"},
}


def test_every_tool_has_a_declared_delegation():
    assert set(T.REGISTRY) == set(TOOL_DELEGATION), (
        f"tools.py and TOOL_DELEGATION disagree: "
        f"only in tools {sorted(set(T.REGISTRY) - set(TOOL_DELEGATION))}, "
        f"only declared {sorted(set(TOOL_DELEGATION) - set(T.REGISTRY))}"
    )


def test_every_declared_delegate_exists_in_the_calculator_registry():
    registered = set(base.available())
    for tool_name, delegates in TOOL_DELEGATION.items():
        missing = delegates - registered
        assert not missing, f"{tool_name} delegates to unregistered {sorted(missing)}"


def test_each_tool_actually_calls_its_declared_calculators():
    """Reads the source, so a tool that silently reimplements the math fails even if its numbers
    happen to match today."""
    src = open(T.__file__).read()
    tree = ast.parse(src)
    bodies = {n.name: ast.get_source_segment(src, n) or ""
              for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    for tool_name, delegates in TOOL_DELEGATION.items():
        body = bodies.get(tool_name, "")
        assert body, f"{tool_name} not found in {T.__file__}"
        for delegate in delegates:
            module, fn = delegate.split(".", 1)
            assert f"{module}.{fn}(" in body, f"{tool_name} does not call {delegate}"


def test_tools_py_does_no_compound_or_amortization_arithmetic_of_its_own():
    """The specific shapes that belong in `calculators/`: exponentiation of a rate, and the
    amortization denominator. Both were present in `tools.py` before Phase A — in
    `retirement_projection` and `home_affordability` respectively — alongside the calculators that
    already did the same thing."""
    tree = ast.parse(open(T.__file__).read())
    powers = [n for n in ast.walk(tree) if isinstance(n, ast.BinOp) and isinstance(n.op, ast.Pow)]
    assert not powers, (
        f"tools.py contains {len(powers)} exponentiation(s) at line(s) "
        f"{[n.lineno for n in powers]} — compound growth and amortization belong in calculators/"
    )


def test_calculator_ids_are_unique_and_well_formed():
    """`base.register` raises on a duplicate id, so this asserts the registry agrees with itself."""
    ids = base.available()
    assert len(ids) == len(set(ids))
    for cid in ids:
        assert base.get(cid) is not None and cid.count(".") == 1, cid


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


# ── Gate 6: reference data must be VERIFIED, not merely present ───────────────────────────────────
def test_no_dataset_family_serves_an_unverified_table_for_the_current_year():
    """FAILS until every current-year table has been checked against its primary source.

    Distinct from the staleness gate: that one asks "is the year present?", this asks "has anyone
    checked it?". A table can pass staleness and still be unfit to quote — which is exactly the
    state `tax_tables/2026.json` is in right now, populated from model knowledge rather than from
    the IRS revenue procedure.

    This gate is EXPECTED TO FAIL until an owner verifies the 2026 figures. That is the point: it
    is the pressure that gets the verification done, and until then every tax calculator refuses to
    produce a user-facing figure anyway (require_verified=True), so nothing can quietly ship a
    number nobody checked.
    """
    unverified = {u["family"]: u for u in V.unverified_families()}
    unexpected = set(unverified) - set(PENDING_VERIFICATION)
    assert not unexpected, (
        f"newly unverified reference data for {date.today().year}: "
        + "; ".join(f"{f}/{unverified[f]['year']} — {unverified[f]['needs']}"
                    for f in sorted(unexpected))
    )
    now_verified = set(PENDING_VERIFICATION) - set(unverified)
    assert not now_verified, (
        f"{sorted(now_verified)} is now verified — remove it from PENDING_VERIFICATION so the gate "
        f"protects it from regressing"
    )


def test_unverified_tables_cannot_produce_a_user_facing_figure():
    """The belt to the gate's braces. Even while a table sits in PENDING_VERIFICATION, every
    calculator that would quote it must refuse — so a declared gap can never become a shipped
    number, whatever CI says."""
    for family in PENDING_VERIFICATION:
        with pytest.raises(V.UnverifiedDataError):
            V.load(family, require_verified=True)


# ── Gate 7: state tax schedules must be structurally sound ────────────────────────────────────────
def test_every_shipped_state_tax_schedule_is_well_formed():
    """FAILS on a malformed state schedule, which is the error class that actually occurs.

    Verification ("is 4.95% right for Illinois?") needs a primary source. Validation ("is this
    schedule even well-formed?") is answerable here, and it is where hand-transcription goes wrong:
    29 states x 4 filing statuses x up to 9 brackets is thousands of numbers.

    This gate matters most at the moment the data becomes TRUSTED. A descending threshold truncates
    the bracket walk and silently undercharges; a rate typed as `4.95` charges 495%; a closed top
    bracket leaves high income untaxed. None of those error on their own — they just compute the
    wrong tax.
    """
    from app.services.calculators import tax as _tax
    for year in V.available_years("state_tax"):
        problems = _tax.validate_state_table(V.load("state_tax", year).data)
        assert problems == [], f"state_tax/{year}.json:\n" + "\n".join(problems)


# ── Gate 8: no calculator may be registered-but-unreachable without saying so ─────────────────────
def test_every_calculator_is_declared_reachable_or_not_advisor_facing():
    """FAILS when a registered calculator is not declared in `advisor_calc_coverage`.

    THE TRIGGER: Phase 3 wired ten calculators into the advisor with a hand-written dispatch block
    each. Phases A, B and B2 added twenty-plus more, and `advisor_calculations.py` does not know any
    of them exist — every one tested, registered, and completely unreachable. Nothing failed,
    because "registered but unreachable" has no symptom.

    This gate gives it one. A new calculator must be declared REACHABLE (with the inputs it
    consumes) or NOT_ADVISOR_FACING (with a reason), so the gap cannot silently re-open.
    """
    from app.services import advisor_calc_coverage as COV

    declared = set(COV.REACHABLE) | set(COV.NOT_ADVISOR_FACING)
    registered = set(base.available())

    undeclared = registered - declared
    assert not undeclared, (
        "these calculators are registered but not declared in advisor_calc_coverage — the advisor "
        f"cannot reach them and nothing says so: {sorted(undeclared)}"
    )
    phantom = declared - registered
    assert not phantom, (
        f"declared in advisor_calc_coverage but not registered: {sorted(phantom)}"
    )


def test_every_not_advisor_facing_entry_gives_a_reason():
    """"Not wired" without a reason is how a calculator goes missing."""
    from app.services import advisor_calc_coverage as COV
    for calc_id, reason in COV.NOT_ADVISOR_FACING.items():
        assert len(reason) > 30, f"{calc_id}: needs a real reason, not a placeholder"


def test_every_treatment_rule_declares_the_inputs_it_needs():
    from app.services import advisor_calc_coverage as COV
    from app.services.calculators import treatment as TR
    undeclared = set(TR.available_rules()) - set(COV.TREATMENT_REACH)
    assert not undeclared, f"treatment rules with no declared inputs: {sorted(undeclared)}"


def test_wired_calculators_only_need_inputs_that_actually_exist():
    """A calculator marked `wired=True` whose inputs are not available is a lie in the inventory —
    it would mean the dispatch runs and silently never fires."""
    from app.services import advisor_calc_coverage as COV
    for calc_id, reach in COV.REACHABLE.items():
        if reach.wired:
            assert reach.inputs_available, (
                f"{calc_id} is marked wired but needs unavailable inputs "
                f"{reach.missing_inputs}")


# ── Gate 9: sunsetting provisions must be noticed before they expire ──────────────────────────────
def test_no_provision_has_silently_expired():
    """FAILS when a dated provision is past its sunset and still declared with no successor.

    A sunset is the one kind of tax change that arrives on a KNOWN DATE and still surprises people,
    because nothing fails when it happens — the rule simply keeps applying expired law and the
    figure still looks like an answer. This gate makes the date arrive loudly.

    An expired provision is not automatically wrong to keep: a prior-year question about 2026 must
    still reach the 2026 rule. What is required is that it be marked `superseded_by`, so the engine
    knows which rule governs today.
    """
    from app.services.calculators import effective as E
    orphaned = [p for p in E.expired() if p.superseded_by is None]
    assert not orphaned, (
        "these provisions are past their sunset with no declared successor: "
        + "; ".join(f"{p.name} (ended {p.last_year}, {p.authority})" for p in orphaned)
        + ". Either set superseded_by, or remove it if nothing replaced it."
    )


def test_provisions_expiring_soon_are_visible():
    """Informational rather than a failure — it reports what needs attention within two years so a
    sunset is planned for rather than discovered. A tax engine that only learns about an expiry
    after it happens has already issued wrong advice."""
    from app.services.calculators import effective as E
    soon = E.expiring_within(2)
    for p in soon:
        assert p.authority and p.note, f"{p.name} expires soon and must explain itself"


def test_every_year_of_reference_data_is_kept_not_replaced():
    """Prior-year questions are only answerable because tables ACCUMULATE. A migration that
    replaced a year's file instead of adding one would silently destroy the ability to answer
    "what did I pay in 2024?" — and nothing else would notice.
    """
    years = V.available_years("tax_tables")
    assert len(years) >= 2, f"expected multiple tax years on disk, found {years}"
    assert 2024 in years, "2024 is the verified baseline the engine's tests depend on"
    # Each kept year must still load and be structurally whole.
    for y in years:
        data = V.load("tax_tables", y).data
        assert data.get("ordinary_brackets"), f"{y}: brackets missing"
        assert data.get("standard_deduction"), f"{y}: standard deduction missing"
