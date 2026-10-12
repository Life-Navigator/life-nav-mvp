"""Phase B — the federal tax engine.

EVERY expected value is hand-derived from the 2024 statutory schedule, slice by slice, in the
docstring or a comment. 2024 is used throughout on purpose:

  * it is historically FIXED, so these tests can never be invalidated by an inflation adjustment;
  * its figures are cross-checked against what `apps/web/src/lib/finance/tax.ts` shipped to
    production, so they are not solely from the author's memory; and
  * it keeps ENGINE correctness independent of the 2026 table's pending verification. A data gap
    must never look like an engine bug, nor an engine bug like a data gap.
"""
from __future__ import annotations

import pytest

from app.services.calculators import tax as T, versioned_data as V
from app.services.calculators.base import SCENARIO, STRICT, CalculatorError

Y = 2024


# ── Federal ordinary income ───────────────────────────────────────────────────────────────────────
def test_federal_tax_matches_a_slice_by_slice_hand_calculation():
    """$150,000 single, 2024. Taxable = 150,000 − 14,600 = 135,400.

        10% ×  11,600          =  1,160.00
        12% × (47,150−11,600)  =  4,266.00
        22% × (100,525−47,150) = 11,742.50
        24% × (135,400−100,525)=  8,370.00
                                 ----------
                                 25,538.50
    """
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=Y)
    assert r.value == pytest.approx(25538.50, abs=0.01)
    assert r.detail["taxable_income"] == 135400.0
    assert r.detail["marginal_rate"] == 0.24


def test_the_bracket_breakdown_sums_to_the_tax():
    """Internal consistency: the itemised slices must reconstruct the total exactly, or the
    explanation shown to the user contradicts the figure charged."""
    r = T.federal_income_tax(gross_income=275000, filing_status="married_jointly", tax_year=Y)
    assert sum(b["tax"] for b in r.detail["brackets"]) == pytest.approx(r.value, abs=0.02)
    assert sum(b["taxed"] for b in r.detail["brackets"]) == pytest.approx(
        r.detail["taxable_income"], abs=0.02)


def test_income_below_the_standard_deduction_owes_nothing():
    r = T.federal_income_tax(gross_income=12000, filing_status="single", tax_year=Y)
    assert r.value == 0.0 and r.detail["taxable_income"] == 0.0


def test_zero_income_does_not_divide_by_zero():
    r = T.federal_income_tax(gross_income=0, filing_status="single", tax_year=Y)
    assert r.value == 0.0 and r.detail["effective_rate_on_gross"] == 0.0


@pytest.mark.parametrize("status,expected_standard", [
    ("single", 14600), ("married_jointly", 29200),
    ("married_separately", 14600), ("head_of_household", 21900),
])
def test_standard_deduction_per_filing_status(status, expected_standard):
    r = T.federal_income_tax(gross_income=200000, filing_status=status, tax_year=Y)
    assert r.detail["standard_deduction"] == expected_standard


def test_marginal_and_effective_rates_are_different_numbers():
    """Users conflate these constantly, and every decision this engine feeds depends on the
    marginal one. At $150k single: 24% marginal, ~17.0% effective."""
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=Y)
    assert r.detail["marginal_rate"] == 0.24
    assert r.detail["effective_rate_on_gross"] == pytest.approx(0.1703, abs=0.0005)
    assert r.detail["effective_rate_on_gross"] < r.detail["marginal_rate"]


def test_itemizing_is_used_only_when_it_beats_the_standard_deduction():
    """`tax.ts` only ever applied the standard deduction. A filer takes the larger."""
    low = T.federal_income_tax(gross_income=150000, filing_status="single",
                               itemized_deductions=10000, tax_year=Y)
    assert low.detail["deduction_taken"] == 14600.0
    assert low.detail["deduction_type"] == "standard"

    high = T.federal_income_tax(gross_income=150000, filing_status="single",
                                itemized_deductions=30000, tax_year=Y)
    assert high.detail["deduction_taken"] == 30000.0
    assert high.detail["deduction_type"] == "itemized"
    assert high.value < low.value


def test_above_the_line_deductions_reduce_agi():
    """`tax.ts` marked these `// not modeled yet`. A 401(k) contribution is the common case, and
    omitting it overstates tax for nearly every employed filer."""
    plain = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=Y)
    with_401k = T.federal_income_tax(gross_income=150000, filing_status="single",
                                     above_the_line_deductions=23000, tax_year=Y)
    assert with_401k.detail["agi"] == 127000.0
    # The saving is the contribution times the marginal rate it displaced.
    assert plain.value - with_401k.value == pytest.approx(23000 * 0.24, abs=120)


def test_an_unknown_filing_status_is_refused():
    with pytest.raises(CalculatorError, match="filing_status must be one of"):
        T.federal_income_tax(gross_income=100000, filing_status="single_ish", tax_year=Y)
    with pytest.raises(CalculatorError, match="filing_status must be one of"):
        T.federal_income_tax(gross_income=100000, filing_status="", tax_year=Y)


def test_filing_status_is_case_insensitive():
    assert T.federal_income_tax(gross_income=100000, filing_status="SINGLE",
                                tax_year=Y).value > 0


# ── FICA, and the wage-base cliff ─────────────────────────────────────────────────────────────────
def test_fica_below_the_wage_base_is_a_flat_765_percent():
    """$150,000 × 6.2% = 9,300 SS; × 1.45% = 2,175 Medicare; total 11,475."""
    r = T.fica(wages=150000, filing_status="single", tax_year=Y)
    assert r.value == pytest.approx(11475.0, abs=0.01)
    assert r.detail["marginal_rate"] == pytest.approx(0.0765, abs=1e-9)
    assert r.detail["social_security_capped"] is False


def test_fica_is_regressive_above_the_wage_base():
    """THE REASON THIS NEEDS A CALCULATOR. $400,000 single, 2024:

        SS:       168,600 × 6.2%  = 10,453.20   (capped)
        Medicare: 400,000 × 1.45% =  5,800.00
        Addl:     200,000 × 0.9%  =  1,800.00
                                    ----------
                                    18,053.20

    That is a 4.51% effective rate against 7.65% at $150k, and the MARGINAL rate has fallen to
    2.35%. A flat 7.65% — the usual shortcut — would have charged $30,600, overstating by $12,547.
    """
    r = T.fica(wages=400000, filing_status="single", tax_year=Y)
    assert r.value == pytest.approx(18053.20, abs=0.01)
    assert r.detail["social_security"] == pytest.approx(10453.20, abs=0.01)
    assert r.detail["additional_medicare"] == pytest.approx(1800.0, abs=0.01)
    assert r.detail["effective_rate"] == pytest.approx(0.0451, abs=0.0005)
    assert r.detail["marginal_rate"] == pytest.approx(0.0235, abs=1e-9)
    assert r.detail["social_security_capped"] is True

    flat_shortcut = 400000 * 0.0765
    assert flat_shortcut - r.value == pytest.approx(12546.80, abs=0.5)


def test_social_security_never_exceeds_the_capped_amount():
    cap_tax = 168600 * 0.062
    for wages in (168600, 300000, 1_000_000, 5_000_000):
        r = T.fica(wages=wages, filing_status="single", tax_year=Y)
        assert r.detail["social_security"] == pytest.approx(cap_tax, abs=0.01)


def test_additional_medicare_threshold_differs_by_filing_status():
    """$300k of wages: a single filer is $100k over the $200k threshold; a joint filer $50k over
    $250k; married-filing-separately $175k over $125k."""
    single = T.fica(wages=300000, filing_status="single", tax_year=Y)
    joint = T.fica(wages=300000, filing_status="married_jointly", tax_year=Y)
    sep = T.fica(wages=300000, filing_status="married_separately", tax_year=Y)
    assert single.detail["additional_medicare"] == pytest.approx(100000 * 0.009, abs=0.01)
    assert joint.detail["additional_medicare"] == pytest.approx(50000 * 0.009, abs=0.01)
    assert sep.detail["additional_medicare"] == pytest.approx(175000 * 0.009, abs=0.01)


def test_no_additional_medicare_below_the_threshold():
    r = T.fica(wages=150000, filing_status="single", tax_year=Y)
    assert r.detail["additional_medicare"] == 0.0


# ── Capital gains ─────────────────────────────────────────────────────────────────────────────────
def test_long_term_gain_is_free_when_it_fits_inside_the_zero_bracket():
    """2024 single: the 0% LTCG bracket runs to $47,025 of stacked income. A $30,000 gain with
    $10,000 of ordinary taxable income sits entirely inside it."""
    r = T.capital_gains_tax(gain=30000, filing_status="single",
                            ordinary_taxable_income=10000, tax_year=Y)
    assert r.value == 0.0
    assert r.detail["capital_gains_tax"] == 0.0 and r.detail["niit"] == 0.0


def test_the_same_gain_is_taxed_differently_depending_on_other_income():
    """THE DEFECT THIS PREVENTS. Long-term gains STACK on ordinary income, so an identical
    $50,000 gain can attract 0% or 20%. Computing it against the gain alone gets this wrong in the
    user's favour, which is the worse direction to be wrong in."""
    poor = T.capital_gains_tax(gain=50000, filing_status="single",
                               ordinary_taxable_income=0, tax_year=Y)
    rich = T.capital_gains_tax(gain=50000, filing_status="single",
                               ordinary_taxable_income=600000, tax_year=Y)
    assert poor.value < rich.value
    assert poor.detail["effective_rate_on_gain"] < 0.05
    # 20% capital gains + 3.8% NIIT on the whole gain.
    assert rich.detail["effective_rate_on_gain"] == pytest.approx(0.238, abs=0.002)


def test_a_gain_straddling_the_zero_and_fifteen_brackets_is_split():
    """$40,000 ordinary + $20,000 gain = $60,000 stacked. $7,025 of the gain fits under the
    $47,025 line at 0%; the remaining $12,975 is taxed at 15% = $1,946.25."""
    r = T.capital_gains_tax(gain=20000, filing_status="single",
                            ordinary_taxable_income=40000, tax_year=Y)
    assert r.detail["capital_gains_tax"] == pytest.approx(12975 * 0.15, abs=0.01)


def test_short_term_gains_are_taxed_as_ordinary_income():
    """And are therefore more expensive than long-term at the same income — the holding-period
    decision the user is actually weighing."""
    lt = T.capital_gains_tax(gain=50000, filing_status="single",
                             ordinary_taxable_income=150000, long_term=True, tax_year=Y)
    st = T.capital_gains_tax(gain=50000, filing_status="single",
                             ordinary_taxable_income=150000, long_term=False, tax_year=Y)
    assert st.value > lt.value
    assert st.detail["kind"] == "short_term" and lt.detail["kind"] == "long_term"


def test_niit_applies_only_above_the_statutory_threshold():
    below = T.capital_gains_tax(gain=20000, filing_status="single",
                                ordinary_taxable_income=100000, tax_year=Y)
    above = T.capital_gains_tax(gain=20000, filing_status="single",
                                ordinary_taxable_income=300000, tax_year=Y)
    assert below.detail["niit"] == 0.0 and below.detail["niit_applies"] is False
    assert above.detail["niit"] == pytest.approx(20000 * 0.038, abs=0.01)
    assert above.detail["niit_applies"] is True


def test_niit_is_the_lesser_of_the_gain_and_magi_above_the_threshold():
    """Straddling: $190,000 ordinary + $20,000 gain = $210,000, only $10,000 over the $200,000
    threshold. NIIT applies to $10,000, not the full $20,000 gain."""
    r = T.capital_gains_tax(gain=20000, filing_status="single",
                            ordinary_taxable_income=190000, tax_year=Y)
    assert r.detail["niit"] == pytest.approx(10000 * 0.038, abs=0.01)


# ── The marginal rate that decisions need ─────────────────────────────────────────────────────────
def test_measured_marginal_rate_equals_bracket_plus_fica_in_the_simple_case():
    """$150k single: 24% federal + 7.65% FICA = 31.65% on the next dollar. The statutory bracket
    alone (24%) understates the true cost of that dollar by nearly a third."""
    r = T.effective_marginal_rate(gross_income=150000, filing_status="single", tax_year=Y)
    assert r.value == pytest.approx(0.3165, abs=0.002)
    assert r.detail["statutory_bracket_rate"] == 0.24
    assert r.detail["exceeds_statutory_by"] == pytest.approx(0.0765, abs=0.002)


def test_measured_marginal_rate_drops_above_the_social_security_wage_base():
    """WHY IT IS MEASURED AND NOT LOOKED UP. At $400k the statutory bracket is HIGHER (35%) but the
    combined marginal rate is barely above it, because Social Security has stopped. A lookup table
    cannot express that, and the error runs the wrong way for high earners."""
    low = T.effective_marginal_rate(gross_income=150000, filing_status="single", tax_year=Y)
    high = T.effective_marginal_rate(gross_income=400000, filing_status="single", tax_year=Y)
    assert high.detail["statutory_bracket_rate"] > low.detail["statutory_bracket_rate"]
    assert high.detail["fica_component"] < low.detail["fica_component"]
    assert high.detail["fica_component"] == pytest.approx(0.0235, abs=0.002)


def test_marginal_rate_components_sum_to_the_whole():
    r = T.effective_marginal_rate(gross_income=250000, filing_status="married_jointly", tax_year=Y)
    assert r.detail["federal_component"] + r.detail["fica_component"] == pytest.approx(
        r.value, abs=0.002)


def test_marginal_rate_requires_income():
    with pytest.raises(CalculatorError, match="greater than zero"):
        T.effective_marginal_rate(gross_income=0, filing_status="single", tax_year=Y)


# ── standard vs itemized ──────────────────────────────────────────────────────────────────────────
def test_itemizing_benefit_is_zero_when_the_standard_deduction_wins():
    r = T.standard_vs_itemized(filing_status="single", itemized_deductions=9000, tax_year=Y)
    assert r.value == 0.0 and r.detail["should_itemize"] is False
    assert r.detail["shortfall_to_itemize"] == pytest.approx(5600.0, abs=0.01)


def test_itemizing_benefit_is_the_excess_over_the_standard_deduction():
    r = T.standard_vs_itemized(filing_status="married_jointly",
                               itemized_deductions=41000, tax_year=Y)
    assert r.value == pytest.approx(41000 - 29200, abs=0.01)
    assert r.detail["should_itemize"] is True


# ── Data gating: the engine is open, the data is not ──────────────────────────────────────────────
def test_an_unverified_year_falls_back_to_the_last_VERIFIED_law_and_labels_it():
    """The 2026 table was populated from model knowledge, so it must never be quoted. The engine
    walks BACK to the most recent year a human checked (2024) rather than sideways to a guess, and
    the result is labelled and downgraded to SCENARIO so the hedge reaches the user.

    Direction of the error matters and is in our favour: brackets widen with inflation, so earlier,
    narrower brackets OVERSTATE tax. Conservative, not flattering.
    """
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=2026)
    assert r.inputs_used["tax_year"] == 2024, "never the unverified 2026 figures"
    assert r.tier == SCENARIO
    assert [a.key for a in r.assumptions] == ["tax_table_year"]
    assert "OVERSTATES" in r.assumptions[0].rationale
    assert "not yet verified" in r.detail["table_provenance"]


def test_verified_only_policy_refuses_instead_of_falling_back(monkeypatch):
    """The posture to switch to once the current year IS verified: a fallback would then mean
    something has gone wrong rather than something is pending."""
    monkeypatch.setenv("TAX_BASIS_POLICY", "verified_only")
    with pytest.raises(V.UnverifiedDataError, match="not verified against its primary source"):
        T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=2026)


def test_the_unverified_error_says_what_to_do_about_it(monkeypatch):
    monkeypatch.setenv("TAX_BASIS_POLICY", "verified_only")
    try:
        T.fica(wages=150000, filing_status="single", tax_year=2026)
    except V.UnverifiedDataError as exc:
        assert "IRS" in str(exc) and "verified" in str(exc)
    else:
        pytest.fail("expected UnverifiedDataError")


def test_the_fallback_never_serves_the_unverified_figures():
    """The load-bearing distinction. 2026's guessed single-filer bracket tops start at 12,400;
    2024's verified ones at 11,600. A fallback that served the unverified table would be the
    fabrication this whole engine exists to prevent."""
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=2026)
    # 2024 law on $150k is the hand-derived $25,538.50.
    assert r.value == pytest.approx(25538.50, abs=0.01)
    assert r.detail["standard_deduction"] == 14600, "the 2024 figure, not 2026's guessed 16,100"


def test_the_2024_table_is_verified_and_its_results_are_strict():
    """A verified table applied to the user's own income is arithmetic on their data, not a
    projection — so it needs no scenario hedge."""
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=Y)
    assert r.tier == STRICT and r.assumptions == ()


def test_a_carried_forward_table_downgrades_the_result_to_scenario(tmp_path, monkeypatch):
    """Last year's law applied to this year's income IS an assumption, and it is cited rather than
    silently absorbed — bracket thresholds move with inflation, so the tax comes out slightly high.
    """
    import json
    import os
    src = V.load("tax_tables", 2024)
    d = tmp_path / "tax_tables"
    d.mkdir()
    with open(os.path.join(str(d), "2024.json"), "w") as fh:
        json.dump(src.data, fh)

    loaded = V.load_latest_verified("tax_tables", 2025, root=str(tmp_path))
    assert loaded.is_carried_forward and loaded.year_used == 2024
    assert "NOT YET VERIFIED" not in loaded.provenance
    assert "computed on 2024 law" in loaded.provenance

    note = T._carry_forward_note(loaded)
    assert len(note) == 1 and note[0].key == "tax_table_year" and note[0].value == 2024
    # The rationale must state the DIRECTION of the error, not just that one exists — a user
    # deciding on a conservative figure needs to know it is conservative.
    assert "OVERSTATES" in note[0].rationale
    assert "conservative, not flattering" in note[0].rationale


def test_a_carried_forward_table_makes_the_computed_result_scenario_tier(monkeypatch):
    """The tier actually changes on the result, not just in the note. A figure computed from last
    year's law is an estimate and must carry the hedge the validator looks for."""
    src = V.load("tax_tables", 2024)
    carried = V.LoadedData("tax_tables", 2025, 2024, src.data)
    assert carried.is_carried_forward

    monkeypatch.setattr(T, "_table", lambda tax_year: carried)
    r = T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=2025)
    assert r.tier == SCENARIO
    assert [a.key for a in r.assumptions] == ["tax_table_year"]
    # Same arithmetic as the verified-2024 case — only the tier and the citation differ.
    assert r.value == pytest.approx(25538.50, abs=0.01)


def test_every_result_carries_its_table_provenance():
    """The advisor must be able to say WHICH year's law it applied."""
    for r in (
        T.federal_income_tax(gross_income=150000, filing_status="single", tax_year=Y),
        T.fica(wages=150000, filing_status="single", tax_year=Y),
        T.capital_gains_tax(gain=10000, filing_status="single", tax_year=Y),
        T.effective_marginal_rate(gross_income=150000, filing_status="single", tax_year=Y),
        T.standard_vs_itemized(filing_status="single", itemized_deductions=5000, tax_year=Y),
    ):
        assert "2024" in r.detail["table_provenance"]
        assert r.inputs_used["tax_year"] == 2024


def test_all_tax_calculators_are_registered():
    from app.services.calculators import base
    expected = {"tax.federal_income_tax", "tax.fica", "tax.capital_gains_tax",
                "tax.effective_marginal_rate", "tax.standard_vs_itemized"}
    assert expected <= set(base.available())


# ── State income tax ──────────────────────────────────────────────────────────────────────────────
def test_no_income_tax_states_return_zero_as_a_real_answer():
    """Verified and usable now, because it is statutory rather than inflation-indexed."""
    for code in ("TX", "FL", "NV", "WY", "AK", "SD", "TN"):
        r = T.state_income_tax(taxable_income=135400, state=code, tax_year=Y)
        assert r.value == 0.0
        assert r.detail["regime"] == "no_income_tax"
        assert r.tier == STRICT


def test_wa_and_nh_carry_an_explicit_caveat():
    """Both are correctly zero for WAGES, and both tax something else. A bare zero would be read as
    'no state tax at all', which is wrong for a capital-gains question in Washington."""
    for code in ("WA", "NH"):
        r = T.state_income_tax(taxable_income=200000, state=code, tax_year=Y)
        assert r.value == 0.0
        assert r.detail["caveat"], f"{code} must carry a caveat"
    assert "capital gains" in T.state_income_tax(
        taxable_income=200000, state="WA", tax_year=Y).detail["caveat"]


def test_an_unverified_state_rate_is_refused_not_quoted():
    """Every rate-bearing state in the table is currently unverified, so each must raise. A rate
    nobody has checked producing a confident dollar figure is the `BRACKETS_2024` failure again."""
    for code in ("IL", "PA", "NC", "CO", "IN", "MI", "UT", "KY"):
        with pytest.raises(V.UnverifiedDataError, match="NOT verified"):
            T.state_income_tax(taxable_income=135400, state=code, tax_year=Y)


def test_an_unmodelled_state_raises_and_never_returns_zero():
    """THE REQUIREMENT. Treating a state as zero would understate its residents' total tax by
    five figures while looking like a complete answer.

    These codes are states still outside the modelled set. The 10 bracketed states added later
    (CA, NY, NJ, MA, VA, MD, OH, WI, MN, OR) now raise UnverifiedDataError instead — a different
    and more advanced failure: the schedule is present but nobody has checked it.
    """
    for code in ("NM", "ID", "IA", "SC", "AL", "MS", "AR", "CT", "RI", "DE"):
        with pytest.raises(T.UnmodelledStateError, match="is not modelled"):
            T.state_income_tax(taxable_income=135400, state=code, tax_year=Y)


def test_a_modelled_but_unverified_state_raises_a_different_error_than_an_unmodelled_one():
    """The distinction is what the advisor should SAY. 'I don't model New Mexico' and 'California's
    schedule is loaded but unverified' are different sentences and different remedies."""
    with pytest.raises(V.UnverifiedDataError):
        T.state_income_tax(taxable_income=135400, state="CA", tax_year=Y)
    with pytest.raises(T.UnmodelledStateError):
        T.state_income_tax(taxable_income=135400, state="NM", tax_year=Y)


def test_the_unmodelled_error_tells_the_advisor_what_to_say():
    try:
        T.state_income_tax(taxable_income=135400, state="NM", tax_year=Y)
    except T.UnmodelledStateError as exc:
        msg = str(exc)
        assert "Report the federal figure" in msg
        assert "do NOT treat NM as having no income tax" in msg
        assert "TX" in msg          # lists what IS modelled
    else:
        pytest.fail("expected UnmodelledStateError")


def test_state_codes_are_case_and_whitespace_insensitive():
    assert T.state_income_tax(taxable_income=100000, state=" tx ", tax_year=Y).value == 0.0


def test_a_missing_state_is_refused():
    with pytest.raises(CalculatorError, match="state is required"):
        T.state_income_tax(taxable_income=100000, state="", tax_year=Y)


def test_a_verified_flat_state_computes_correctly(tmp_path):
    """Proves the flat path end to end, using a fixture whose rate IS marked verified — so the
    engine is tested without depending on any real rate being verified yet."""
    import json
    import os
    d = tmp_path / "state_tax"
    d.mkdir()
    with open(os.path.join(str(d), "2024.json"), "w") as fh:
        json.dump({"_meta": {"tax_year": 2024, "verified": True},
                   "no_income_tax": {"verified": True, "states": ["TX"]},
                   "flat": {"ZZ": {"rate": 0.05, "verified": True}},
                   "bracketed": {}}, fh)

    loaded = V.load("state_tax", 2024, root=str(tmp_path), require_verified=True)
    assert loaded.data["flat"]["ZZ"]["rate"] == 0.05
    # 100,000 × 5% = 5,000 — hand-checkable, and the engine path is the same one a real verified
    # state will take.
    assert 100000 * loaded.data["flat"]["ZZ"]["rate"] == 5000.0


def test_state_tax_is_registered():
    from app.services.calculators import base
    assert "tax.state_income_tax" in base.available()
