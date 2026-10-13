#!/usr/bin/env python3
"""Show exactly what the calculator packet ADDS to an advisor turn — without calling a model.

WHY THIS EXISTS
---------------
`ADVISOR_CALCULATORS_ENABLED` is default-off because turning it on changes what reaches the model
on every finance turn and widens what the validator admits. The repo's own standard for flipping it
is a measured win on the advisor eval harness, which needs live model credentials.

This closes the half of that decision that does NOT need credentials: it prints the packet for a
given profile so the content change is reviewable — every figure with its tier, every determination
with its authority, every conflict, and every gap. If the packet is wrong, it is wrong here, for
free, instead of wrong on every finance turn in production.

USAGE
    python scripts/calc_packet_dryrun.py                 # built-in profiles
    python scripts/calc_packet_dryrun.py --profile veteran_family
    python scripts/calc_packet_dryrun.py --json

No network, no database, no model. Profiles are synthetic and labelled as such.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.advisor_calculations import AdvisorCalculationPlanner  # noqa: E402

# Synthetic profiles. Deliberately NOT real user data: this script is for reviewing the ENGINE's
# behaviour, and a real profile would make the output un-shareable for no analytical gain.
PROFILES: dict[str, dict[str, Any]] = {
    "salaried_homeowner": {
        "_turn": {"current_age": 45},
        "income": 180_000, "filing_status": "married_jointly", "tax_state": "CA",
        "dependents": 2, "qualifying_children": 2,
        "adjusted_gross_income": 180_000, "modified_agi": 180_000,
        "cash_balance": 35_000, "investment_balance": 220_000, "retirement_balance": 410_000,
        "retirement_contribution_rate": 6, "employer_match_rate": 6, "employer_match_percent": 50,
        "monthly_expenses": 9_200, "annual_savings": 28_000, "time_horizon": 20,
        "itemized_components": {"state_local_taxes": 26_000, "mortgage_interest": 21_000,
                                "charitable_contributions": 5_000},
        "capital_gain": 48_000, "capital_gain_long_term": 40_000,
        "capital_gain_short_term": 8_000,
        "monthly_debts": 3_495, "debt_apr": 0.072, "debt_total": 472_000,
        "debt_minimum_payments": [
            {"label": "mortgage", "balance": 450_000, "apr": 0.065,
             "minimum_payment": 2_845, "loan_type": "mortgage"},
            {"label": "visa", "balance": 22_000, "apr": 0.2199,
             "minimum_payment": 650, "loan_type": "credit_card"}],
        "health_coverage_tier": "family", "hdhp_annual_deductible": 3_500,
        "hdhp_out_of_pocket_max": 9_000, "hsa_annual_contribution": 7_000,
        "hsa_through_payroll": True, "fsa_type": "limited_purpose",
        "covered_by_workplace_plan": True, "student_loan_interest": 2_600,
    },
    # The case the audit found: an HSA funded on coverage that does not qualify.
    "hsa_excess_risk": {
        "_turn": {"current_age": 38},
        "income": 145_000, "filing_status": "single", "adjusted_gross_income": 145_000,
        "retirement_contribution_rate": 4, "employer_match_rate": 5, "employer_match_percent": 100,
        "health_coverage_tier": "self_only", "hdhp_annual_deductible": 900,
        "hdhp_out_of_pocket_max": 4_000, "hsa_annual_contribution": 4_300,
        "fsa_type": "general_purpose", "fsa_election": 2_000,
    },
    # Two degrees against one salary: the comparison the education calculators could not make
    # until career/education reached the computed path.
    "career_change_mba": {
        "_turn": {"current_age": 31},
        "income": 95_000, "filing_status": "single", "adjusted_gross_income": 95_000,
        "salary_before": 95_000, "target_compensation": 150_000, "target_role": "Product Manager",
        "cash_balance": 40_000, "retirement_balance": 85_000, "time_horizon": 30,
        "monthly_expenses": 4_200, "annual_savings": 14_000,
        "education_programs": [
            {"name": "State MBA", "tuition_total": 62_000, "years_in_school": 2.0,
             "median_salary": 138_000, "graduation_rate": 0.91, "source": "IPEDS"},
            {"name": "Top-20 MBA", "tuition_total": 168_000, "years_in_school": 2.0,
             "median_salary": 175_000, "graduation_rate": 0.95, "source": "IPEDS"}],
    },
    "veteran_family": {
        "_turn": {"current_age": 52, "va_individual_ratings": [60, 30, 10]},
        "income": 96_000, "filing_status": "married_jointly", "dependents": 1,
        "qualifying_children": 1, "adjusted_gross_income": 96_000,
        "va_disability_rating": 70, "retirement_balance": 180_000,
        "cash_balance": 22_000, "monthly_expenses": 6_100, "time_horizon": 13,
    },
}


def _field(value: Any) -> dict[str, Any]:
    return {"value": value, "present": value not in (None, "", [], {}), "prompt": "", "unlocks": []}


class _Resolver:
    def __init__(self, profile: dict[str, Any]) -> None:
        self._inputs = {k: _field(v) for k, v in profile.items() if not k.startswith("_")}

    async def resolve(self, ctx: Any) -> dict[str, Any]:
        return {"inputs": self._inputs}


class _Ctx:
    user_id = "dryrun-synthetic-profile"


async def run(name: str) -> dict[str, Any]:
    profile = PROFILES[name]
    planner = AdvisorCalculationPlanner(_Resolver(profile))   # no store: nothing is persisted
    turn = dict(profile.get("_turn") or {})
    return await planner.compute(_Ctx(), tax_year=None, turn=turn,
                                 current_age=turn.get("current_age"))


def report(name: str, p: dict[str, Any]) -> None:
    print(f"\n{'=' * 78}\n{name}\n{'=' * 78}")
    if not p.get("available"):
        print("  packet unavailable:", p.get("gaps"))
        return

    conflicts = p.get("tax_conflicts") or []
    if conflicts:
        print("\n  CONFLICTS — a loss in progress, and the model is told to lead with these")
        for c in conflicts:
            print(f"    ! {c['what']}")
            print(f"      because {c['because']}  (${c.get('amount_at_risk', 0):,.0f} at risk)")

    strict = [r for r in p["results"] if r["tier"] == "strict"]
    scen = [r for r in p["results"] if r["tier"] == "scenario"]
    print(f"\n  FIGURES — {len(strict)} strict, {len(scen)} scenario")
    for r in p["results"]:
        mark = "  " if r["tier"] == "strict" else " ~"
        print(f"   {mark} {r['calculator']:36} {r['value']:>16,.2f} {r['unit']}")

    dets = p.get("treatments") or []
    if dets:
        print(f"\n  DETERMINATIONS — {len(dets)}")
        for t in dets:
            amt = f"{t['amount']:>12,.2f}" if t.get("amount") is not None else " " * 12
            print(f"      {t['rule']:32} {t['determination']:22}{amt}  [{t['authority'][:38]}]")

    levers = p.get("unfavourable_with_levers") or []
    if levers:
        print("\n  UNFAVOURABLE, WITH THE LEVER THAT WOULD CHANGE IT")
        for u in levers:
            print(f"      {u['rule']}: {u['what_would_change_it'][0][:110]}")

    traps = p.get("tax_traps") or []
    if traps:
        print(f"\n  TRAPS SURFACED — {len(traps)}")
        for t in traps[:4]:
            print(f"      - {t[:108]}")

    gaps = (p.get("gaps") or []) + (p.get("treatment_gaps") or [])
    print(f"\n  GAPS (questions to ASK, never numbers to assume) — {len(gaps)}")
    for g in gaps[:8]:
        who = g.get("calculator") or g.get("rule")
        why = g.get("refused") or (g.get("ask") or [""])[0] if isinstance(g.get("ask"), list) \
            else g.get("ask") or g.get("refused") or ""
        print(f"      {who}: {str(why)[:88]}")

    progs = p.get("education_programs_compared") or []
    if progs:
        print(f"\n  PROGRAMS COMPARED — {len(progs)}")
        for e in progs:
            print(f"      {e['program']}: ${e['tuition_total']:,.0f} over {e['years_in_school']}y, "
                  f"after ${e['salary_after']:,.0f} ({e['salary_after_source']}), "
                  f"completion {e.get('graduation_rate')}")

    nums = len(p.get("allowed_numbers") or []) + len(p.get("scenario_numbers") or [])
    print(f"\n  NUMBER GATE — {len(p.get('allowed_numbers') or [])} citable plainly, "
          f"{len(p.get('scenario_numbers') or [])} as estimates ({nums} notations)")
    print(f"  FINGERPRINTS — inputs {p['fingerprints']['inputs'][:12]}… "
          f"basis {p['fingerprints']['basis'][:12]}…")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--profile", choices=sorted(PROFILES), help="one profile (default: all)")
    ap.add_argument("--json", action="store_true", help="raw packets instead of the report")
    args = ap.parse_args()
    names = [args.profile] if args.profile else sorted(PROFILES)

    packets = {n: asyncio.run(run(n)) for n in names}
    if args.json:
        print(json.dumps(packets, indent=2, default=str))
        return 0
    print("Synthetic profiles. No network, no database, no model call.")
    for n in names:
        report(n, packets[n])
    print("\nThis is the content change ADVISOR_CALCULATORS_ENABLED would introduce. The "
          "remaining gate\nis the A/B on the advisor eval harness, which needs live model "
          "credentials.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
