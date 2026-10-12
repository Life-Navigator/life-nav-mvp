"""Phase B2 — account-wrapper and debt-interest tax treatment.

These test RULES, not amounts. The statutory structure (the FICA distinction, the tracing rules, the
§163(d) limit, the elective-vs-415(c) split, the pro-rata trap) is stable and encodable with high
confidence; the dollar thresholds live in `tax_parameters/<year>.json` and are unverified. So the
assertions below are about determinations, tests, traps and RELATIONSHIPS between figures — not
about any particular threshold being this year's.
"""
from __future__ import annotations

import pytest

from app.services.calculators import tax_debt_interest as D, tax_wrappers as W
from app.services.calculators import treatment as TR
from app.services.calculators import versioned_data as V
from app.services.calculators.base import SCENARIO, CalculatorError


def _params():
    return V.load("tax_parameters").data


# ── The contract ──────────────────────────────────────────────────────────────────────────────────
def test_a_determination_must_cite_an_authority():
    """A determination without an authority is an opinion, and the citation is what separates this
    from a model guessing at tax law."""
    with pytest.raises(TR.TreatmentError, match="must cite its authority"):
        TR.TreatmentResult(rule="x.y", determination=TR.DEDUCTIBLE, authority="  ",
                           summary="s", tests=(TR.Test("a", True, "w"),))


def test_a_determination_must_record_at_least_one_test():
    with pytest.raises(TR.TreatmentError, match="the test IS the explanation"):
        TR.TreatmentResult(rule="x.y", determination=TR.DEDUCTIBLE, authority="IRC §1",
                           summary="s", tests=())


def test_unknown_determinations_and_characters_are_rejected():
    for kwargs, match in ((dict(determination="maybe"), "unknown determination"),
                          (dict(character="weird"), "unknown character")):
        base = dict(rule="x.y", determination=TR.DEDUCTIBLE, authority="IRC §1", summary="s",
                    tests=(TR.Test("a", True, "w"),))
        base.update(kwargs)
        with pytest.raises(TR.TreatmentError, match=match):
            TR.TreatmentResult(**base)


def test_an_unverified_parameter_makes_the_cited_amount_scenario_tier():
    """The rule can be right while the amount rests on an unverified statutory limit — so the
    validator must hedge the figure even though the determination is sound."""
    r = W.hsa_contribution(coverage="family", amount=5000, age=40)
    assert r.parameters_verified is False
    assert r.to_calc_result().tier == SCENARIO


def test_what_would_change_it_surfaces_the_failed_tests_as_levers():
    r = D.heloc_interest(annual_interest=8000, proceeds_used_for="credit_cards")
    assert r.is_favourable is False
    assert r.what_would_change_it
    assert "debt payoff" in r.what_would_change_it[0]


# ── HDHP ──────────────────────────────────────────────────────────────────────────────────────────
def test_hdhp_requires_both_a_minimum_deductible_and_a_capped_out_of_pocket():
    p = _params()["hdhp"]
    ded_min = p["min_annual_deductible"]["family"]
    oop_max = p["max_out_of_pocket"]["family"]

    ok = W.hdhp_qualifies(coverage="family", annual_deductible=ded_min,
                          out_of_pocket_max=oop_max)
    assert ok.determination == TR.ELIGIBLE

    # Fails on the deductible alone.
    assert W.hdhp_qualifies(coverage="family", annual_deductible=ded_min - 1,
                            out_of_pocket_max=oop_max).determination == TR.INELIGIBLE
    # Fails on out-of-pocket alone — the test people skip.
    bad_oop = W.hdhp_qualifies(coverage="family", annual_deductible=ded_min * 3,
                               out_of_pocket_max=oop_max + 1)
    assert bad_oop.determination == TR.INELIGIBLE
    assert any(t.name == "out_of_pocket_ceiling" and not t.passed for t in bad_oop.tests)


def test_a_failed_hdhp_test_warns_about_the_excess_contribution_excise():
    r = W.hdhp_qualifies(coverage="self_only", annual_deductible=500, out_of_pocket_max=3000)
    assert any("6% excise" in t for t in r.traps)


def test_coverage_aliases_are_accepted_and_nonsense_is_not():
    assert W.hdhp_qualifies(coverage="individual", annual_deductible=9999,
                            out_of_pocket_max=1000).inputs_used["coverage"] == "self_only"
    with pytest.raises(CalculatorError, match="coverage must be one of"):
        W.hdhp_qualifies(coverage="group", annual_deductible=5000, out_of_pocket_max=5000)


# ── HSA: the FICA distinction ─────────────────────────────────────────────────────────────────────
def test_payroll_hsa_contributions_are_excluded_and_direct_ones_are_merely_deducted():
    """THE POINT NOTHING IN THE PLATFORM KNEW. Payroll contributions are excluded from wages, so
    they escape FICA as well as income tax. The identical dollars contributed directly get income
    tax relief only — about 7.65% worse, every year."""
    payroll = W.hsa_contribution(coverage="family", amount=3000, age=40, through_payroll=True)
    direct = W.hsa_contribution(coverage="family", amount=3000, age=40, through_payroll=False)
    assert payroll.determination == TR.EXCLUDED
    assert direct.determination == TR.DEDUCTED
    assert "no FICA" in payroll.summary
    assert any("7.65%" in t for t in direct.traps)


def test_the_direct_contribution_trap_names_the_fix():
    direct = W.hsa_contribution(coverage="family", amount=3000, age=40, through_payroll=False)
    assert any("Switching this contribution to payroll" in t for t in direct.traps)


def test_employer_contributions_count_against_the_hsa_limit():
    """A generous employer seed reduces what the user may add. `offer_impact` must net this or a
    rich HSA offer looks better than it is."""
    limit = _params()["hsa"]["contribution_limit"]["family"]
    r = W.hsa_contribution(coverage="family", amount=limit, age=40,
                           employer_contribution=1000)
    assert r.amount == pytest.approx(limit - 1000, abs=0.01)
    assert any(t.name == "within_limit" and not t.passed for t in r.tests)
    assert r.binding_limit is not None


def test_catch_up_applies_from_the_statutory_age():
    cfg = _params()["hsa"]
    age = int(cfg["catch_up_age"])
    under = W.hsa_contribution(coverage="self_only", amount=100, age=age - 1)
    over = W.hsa_contribution(coverage="self_only", amount=100, age=age)
    assert any(t.name == "catch_up_eligible" and not t.passed for t in under.tests)
    assert any(t.name == "catch_up_eligible" and t.passed for t in over.tests)


def test_partial_year_coverage_prorates_and_warns_about_the_testing_period():
    """The last-month rule lets you fund the full limit on partial coverage — and imposes a 13-month
    testing period. Losing HDHP coverage inside it makes the extra taxable plus a 10% penalty."""
    r = W.hsa_contribution(coverage="family", amount=1000, age=40, months_hdhp_covered=6)
    assert any(t.name == "full_year_coverage" and not t.passed for t in r.tests)
    assert any("testing period" in t for t in r.traps)


def test_months_covered_must_be_a_real_month_count():
    with pytest.raises(CalculatorError, match="must be 0-12"):
        W.hsa_contribution(coverage="family", amount=1000, age=40, months_hdhp_covered=13)


def test_medicare_age_is_flagged_as_ending_contribution_eligibility():
    age = int(_params()["hsa"]["medicare_age_blocks_contributions"])
    r = W.hsa_contribution(coverage="self_only", amount=1000, age=age)
    assert any(t.name == "medicare_enrolment" and not t.passed for t in r.tests)


def test_the_third_leg_of_the_triple_advantage_is_stated():
    r = W.hsa_contribution(coverage="family", amount=1000, age=40)
    assert any("Qualified medical withdrawals are tax-free" in n for n in r.notes)


# ── FSA compatibility ────────────────────────────────────────────────────────────────────────────
def test_only_a_limited_purpose_fsa_can_coexist_with_an_hsa():
    """The rule the owner's 'HSA with HDHP and limited FSA' example turns on."""
    assert W.fsa_hsa_compatibility(fsa_type="limited_purpose").determination == TR.ELIGIBLE
    assert W.fsa_hsa_compatibility(fsa_type="dependent_care").determination == TR.ELIGIBLE
    blocked = W.fsa_hsa_compatibility(fsa_type="general_purpose_health")
    assert blocked.determination == TR.INELIGIBLE
    assert "whole year" in blocked.summary


def test_the_incompatible_fsa_warns_the_election_is_usually_irreversible():
    r = W.fsa_hsa_compatibility(fsa_type="health")
    assert any("irreversible" in t for t in r.traps)


def test_fsa_type_cannot_be_guessed():
    with pytest.raises(TR.TreatmentError, match="decides HSA eligibility"):
        W.fsa_hsa_compatibility(fsa_type="some_fsa")


# ── 401(k): two limits ───────────────────────────────────────────────────────────────────────────
def test_employer_contributions_do_not_consume_the_elective_limit():
    """The most common 401(k) misunderstanding. A generous match does NOT block your own deferrals;
    it consumes the much larger §415(c) total instead."""
    cfg = _params()["retirement"]
    elective = float(cfg["elective_deferral_limit"])
    r = W.k401_deferral(employee_deferral=elective, age=40, compensation=250000,
                        employer_contribution=20000)
    assert r.amount == pytest.approx(elective, abs=0.01)
    assert any(t.name == "within_elective_limit" and t.passed for t in r.tests)
    assert any(t.name == "within_415c_total" and t.passed for t in r.tests)


def test_the_415c_headroom_is_reported_as_mega_backdoor_capacity():
    r = W.k401_deferral(employee_deferral=10000, age=40, compensation=250000,
                        employer_contribution=5000)
    assert any("mega-backdoor" in t for t in r.traps)
    assert any("§415(c) headroom" in n for n in r.notes)


def test_a_bigger_match_shrinks_the_mega_backdoor_headroom():
    """Both directions of the same misunderstanding: the match does not block deferrals, but it DOES
    eat the after-tax headroom."""
    small = W.k401_deferral(employee_deferral=20000, age=40, compensation=300000,
                            employer_contribution=5000)
    large = W.k401_deferral(employee_deferral=20000, age=40, compensation=300000,
                            employer_contribution=30000)

    def headroom(r):
        return float([n for n in r.notes if "headroom" in n][0].split("headroom $")[1].replace(",", ""))

    assert headroom(large) < headroom(small)


def test_roth_deferral_is_tax_free_rather_than_deducted():
    pre = W.k401_deferral(employee_deferral=10000, age=40, compensation=150000)
    roth = W.k401_deferral(employee_deferral=10000, age=40, compensation=150000, roth=True)
    assert pre.determination == TR.DEDUCTED
    assert roth.determination == TR.TAX_FREE
    assert any("no longer subject to RMDs" in t for t in roth.traps)


def test_exceeding_the_elective_limit_names_it_as_the_binding_limit():
    elective = float(_params()["retirement"]["elective_deferral_limit"])
    r = W.k401_deferral(employee_deferral=elective + 5000, age=30, compensation=200000)
    assert r.amount == pytest.approx(elective, abs=0.01)
    assert "elective deferral limit" in (r.binding_limit or "")


# ── IRA deductibility ────────────────────────────────────────────────────────────────────────────
def test_an_uncovered_filer_deducts_fully_at_any_income():
    """The single most common IRA misconception — the phase-out only exists if you are covered by a
    workplace plan. It costs uncovered high earners a deduction they assume is unavailable."""
    r = W.ira_deduction(contribution=5000, agi=1_000_000, filing_status="single", age=40,
                        covered_by_workplace_plan=False)
    assert r.determination == TR.DEDUCTED
    assert r.amount == 5000.0
    assert "no phase-out applies" in r.summary


def test_a_covered_filer_above_the_range_gets_no_deduction_but_may_still_contribute():
    r = W.ira_deduction(contribution=5000, agi=1_000_000, filing_status="single", age=40,
                        covered_by_workplace_plan=True)
    assert r.amount == 0.0
    assert any("still ALLOWED" in n for n in r.notes)


def test_a_non_deductible_contribution_warns_about_the_pro_rata_rule():
    """The most commonly botched manoeuvre in personal finance: the backdoor Roth's pro-rata rule
    aggregates ALL traditional/SEP/SIMPLE balances on conversion."""
    r = W.ira_deduction(contribution=7000, agi=1_000_000, filing_status="single", age=40,
                        covered_by_workplace_plan=True)
    assert any("PRO-RATA RULE" in t for t in r.traps)
    assert any("Form 8606" in t for t in r.traps)


def test_mid_range_agi_gives_a_partial_deduction():
    lo, hi = (float(x) for x in
              _params()["retirement"]["ira_deduction_phase_out_covered"]["single"])
    mid = W.ira_deduction(contribution=6000, agi=(lo + hi) / 2, filing_status="single",
                          age=40, covered_by_workplace_plan=True)
    assert 0 < mid.amount < 6000
    assert mid.amount == pytest.approx(3000.0, abs=1.0)


def test_an_unknown_filing_status_is_refused_rather_than_defaulted():
    with pytest.raises(TR.TreatmentError, match="no IRA deduction phase-out range"):
        W.ira_deduction(contribution=5000, agi=50000, filing_status="widower", age=40,
                        covered_by_workplace_plan=True)


# ── Tracing: the heart of B2-b ───────────────────────────────────────────────────────────────────
def test_the_same_heloc_is_deductible_or_not_depending_only_on_use():
    """Deductibility follows WHAT THE MONEY BOUGHT, not what secured the loan. Intuition says 'it's
    secured by my home so it's deductible', and since TCJA that is wrong."""
    reno = D.heloc_interest(annual_interest=8000, proceeds_used_for="renovation")
    cards = D.heloc_interest(annual_interest=8000, proceeds_used_for="credit_cards")
    assert reno.determination == TR.DEDUCTIBLE and reno.amount == 8000.0
    assert cards.determination == TR.NOT_DEDUCTIBLE and cards.amount == 0.0
    assert "even though the loan is secured by your home" in cards.tests[0].why


def test_the_heloc_trap_names_the_pre_tcja_folk_wisdom():
    r = D.heloc_interest(annual_interest=8000, proceeds_used_for="credit_cards")
    assert any("Pre-TCJA" in t for t in r.traps)
    assert any("shares the acquisition-debt cap" in t for t in r.traps)


def test_the_use_of_proceeds_cannot_be_defaulted():
    """Assuming deductible overstates the deduction; assuming not understates it. Both are confident
    wrong answers, so the fact must be supplied."""
    with pytest.raises(TR.TreatmentError, match="cannot be defaulted"):
        D.heloc_interest(annual_interest=5000, proceeds_used_for="")


def test_not_itemizing_makes_every_itemized_interest_deduction_worthless():
    """Post-TCJA most filers take the standard deduction, which makes a widely-assumed deduction
    worth exactly nothing to them."""
    r = D.heloc_interest(annual_interest=8000, proceeds_used_for="renovation", itemizing=False)
    assert r.determination == TR.NOT_DEDUCTIBLE and r.amount == 0.0
    m = D.mortgage_interest(balance=400000, annual_interest=25000, itemizing=False)
    assert m.amount == 0.0 and "standard deduction" in (m.binding_limit or "")


def test_the_mortgage_cap_applies_to_the_DEBT_so_interest_is_prorated():
    cap = float(_params()["debt_interest"]["mortgage_acquisition_cap"])
    r = D.mortgage_interest(balance=cap * 2, annual_interest=40000)
    assert r.determination == TR.PARTIALLY_DEDUCTIBLE
    assert r.amount == pytest.approx(20000.0, abs=1.0)


def test_pre_cutoff_mortgages_keep_the_higher_grandfathered_cap():
    cfg = _params()["debt_interest"]
    bal = float(cfg["mortgage_acquisition_cap_grandfathered"])
    new = D.mortgage_interest(balance=bal, annual_interest=50000)
    old = D.mortgage_interest(balance=bal, annual_interest=50000,
                              originated_before_cutoff=True)
    assert old.amount > new.amount
    assert old.determination == TR.DEDUCTIBLE


# ── §163(d): margin / securities-based lending ───────────────────────────────────────────────────
def test_investment_interest_is_capped_at_net_investment_income():
    r = D.investment_interest(annual_interest=10000, net_investment_income=2000)
    assert r.determination == TR.PARTIALLY_DEDUCTIBLE
    assert r.amount == 2000.0
    assert "net investment income" in (r.binding_limit or "")
    assert any("carries forward indefinitely" in t for t in r.traps)


def test_a_buy_and_hold_portfolio_gets_no_current_deduction():
    """The typical securities-based-lending borrower has mostly unrealized appreciation, so little or
    no net investment income — and therefore no current deduction at all."""
    r = D.investment_interest(annual_interest=10000, net_investment_income=0)
    assert r.determination == TR.NOT_DEDUCTIBLE and r.amount == 0.0


def test_margin_interest_used_for_consumption_is_never_deductible():
    r = D.investment_interest(annual_interest=10000, net_investment_income=50000,
                              proceeds_used_for="personal_consumption")
    assert r.determination == TR.NOT_DEDUCTIBLE
    assert "whatever the collateral" in r.tests[0].why


def test_the_real_benefit_of_sbl_is_deferral_and_it_is_stated():
    """Borrowing against appreciated stock is not a realization event — usually worth far more than
    the interest deduction, and it should dominate the comparison."""
    r = D.investment_interest(annual_interest=10000, net_investment_income=1000)
    assert any("not a realization event" in n for n in r.notes)
    assert any("stepped-up basis" in n for n in r.notes)
    assert any("margin call" in t for t in r.traps)


def test_the_qualified_dividend_election_is_described_as_a_trade():
    r = D.investment_interest(annual_interest=10000, net_investment_income=1000)
    assert any("It is a trade, not a free unlock" in t for t in r.traps)


# ── §163(j): SBA 7(a) / 504 ──────────────────────────────────────────────────────────────────────
def test_the_small_business_exception_covers_almost_every_7a_borrower():
    threshold = float(_params()["debt_interest"]["business_interest_small_business_gross_receipts"])
    r = D.business_interest(annual_interest=50000, adjusted_taxable_income=10000,
                            gross_receipts=threshold / 10)
    assert r.determination == TR.DEDUCTIBLE
    assert r.amount == 50000.0, "§163(j) does not apply at all below the threshold"
    assert r.binding_limit is None


def test_above_the_threshold_163j_caps_the_deduction():
    cfg = _params()["debt_interest"]
    threshold = float(cfg["business_interest_small_business_gross_receipts"])
    pct = float(cfg["business_interest_163j_pct_of_ati"])
    r = D.business_interest(annual_interest=50000, adjusted_taxable_income=100000,
                            gross_receipts=threshold * 2)
    assert r.determination == TR.PARTIALLY_DEDUCTIBLE
    assert r.amount == pytest.approx(100000 * pct, abs=0.01)
    assert "§163(j)" in (r.binding_limit or "")


def test_163j_shrinks_in_a_bad_year_and_says_so():
    """The cap is a share of adjusted taxable income, so the deduction is smallest exactly when the
    business needs it most."""
    threshold = float(_params()["debt_interest"]["business_interest_small_business_gross_receipts"])
    good = D.business_interest(annual_interest=50000, adjusted_taxable_income=500000,
                               gross_receipts=threshold * 2)
    bad = D.business_interest(annual_interest=50000, adjusted_taxable_income=50000,
                              gross_receipts=threshold * 2)
    assert bad.amount < good.amount
    assert any("SHRINKS in a bad year" in t for t in bad.traps)


def test_business_interest_does_not_require_itemizing():
    r = D.business_interest(annual_interest=10000, adjusted_taxable_income=100000,
                            gross_receipts=1000)
    assert any(t.name == "no_itemizing_required" and t.passed for t in r.tests)


def test_sba_guarantee_fee_and_owner_occupied_allocation_are_flagged():
    r = D.business_interest(annual_interest=10000, adjusted_taxable_income=100000,
                            gross_receipts=1000)
    assert any("guarantee fee" in t for t in r.traps)
    assert any("owner-occupied commercial" in t for t in r.traps)


# ── Student loan ─────────────────────────────────────────────────────────────────────────────────
def test_married_filing_separately_cannot_deduct_student_loan_interest_at_all():
    r = D.student_loan_interest(annual_interest=2000, agi=50000,
                                filing_status="married_separately")
    assert r.determination == TR.NOT_DEDUCTIBLE and r.amount == 0.0
    assert any("income-driven repayment" in t for t in r.traps)


def test_student_loan_interest_needs_no_itemizing_but_is_capped():
    cap = float(_params()["debt_interest"]["student_loan_interest_cap"])
    r = D.student_loan_interest(annual_interest=cap * 2, agi=40000, filing_status="single")
    assert r.amount == pytest.approx(cap, abs=0.01)
    assert any(t.name == "no_itemizing_required" and t.passed for t in r.tests)


def test_student_loan_deduction_phases_out_on_agi():
    lo, hi = (float(x) for x in
              _params()["debt_interest"]["student_loan_phase_out"]["single"])
    full = D.student_loan_interest(annual_interest=1000, agi=lo, filing_status="single")
    half = D.student_loan_interest(annual_interest=1000, agi=(lo + hi) / 2,
                                   filing_status="single")
    gone = D.student_loan_interest(annual_interest=1000, agi=hi, filing_status="single")
    assert full.amount == 1000.0
    assert half.amount == pytest.approx(500.0, abs=1.0)
    assert gone.amount == 0.0


# ── The bridge into Phase L ──────────────────────────────────────────────────────────────────────
def test_a_deductible_heloc_beats_a_cheaper_non_deductible_margin_loan():
    """WHY A PRE-TAX RANKING IS WRONG, and why B2-b had to come before Phase L. At a 32% marginal
    rate an 8% deductible HELOC costs 5.44% after tax while a 7% non-deductible margin loan costs
    7.00% — the cheaper-looking loan is the more expensive one."""
    heloc = D.after_tax_cost_of_debt(apr=0.08, deductible_share=1.0, marginal_rate=0.32)
    margin = D.after_tax_cost_of_debt(apr=0.07, deductible_share=0.0, marginal_rate=0.32)
    assert heloc.amount == pytest.approx(0.0544, abs=1e-6)
    assert margin.amount == pytest.approx(0.0700, abs=1e-6)
    assert heloc.amount < margin.amount


def test_a_partial_deduction_gives_a_partial_rate_benefit():
    half = D.after_tax_cost_of_debt(apr=0.08, deductible_share=0.5, marginal_rate=0.32)
    assert half.amount == pytest.approx(0.08 * (1 - 0.5 * 0.32), abs=1e-9)


def test_a_zero_marginal_rate_means_the_deduction_is_worth_nothing():
    r = D.after_tax_cost_of_debt(apr=0.08, deductible_share=1.0, marginal_rate=0.0)
    assert r.amount == pytest.approx(0.08, abs=1e-9)
    assert any("only worth the marginal rate it offsets" in t for t in r.traps)


def test_the_after_tax_cost_is_pure_arithmetic_so_its_parameters_are_verified():
    """No statutory threshold is involved, so unlike the rest of B2 this one is not gated."""
    r = D.after_tax_cost_of_debt(apr=0.08, deductible_share=1.0, marginal_rate=0.32)
    assert r.parameters_verified is True


def test_deductible_share_must_be_a_fraction():
    with pytest.raises(CalculatorError):
        D.after_tax_cost_of_debt(apr=0.08, deductible_share=32.0, marginal_rate=0.32)


# ── Registry ─────────────────────────────────────────────────────────────────────────────────────
def test_all_b2_rules_are_registered():
    expected = {
        "wrapper.hdhp_qualifies", "wrapper.hsa_contribution", "wrapper.fsa_hsa_compatibility",
        "wrapper.k401_deferral", "wrapper.ira_deduction",
        "debt_interest.mortgage", "debt_interest.heloc", "debt_interest.investment",
        "debt_interest.business", "debt_interest.student_loan", "debt_interest.after_tax_cost",
    }
    assert expected <= set(TR.available_rules())
    for rid in expected:
        assert TR.get_rule(rid) is not None


def test_every_rule_id_is_group_dot_name():
    for rid in TR.available_rules():
        assert rid.count(".") == 1, rid
