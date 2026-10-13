"""VA compensation and DIC inside the household ledger (Milestone 2.6).

WHY THIS NEEDED ITS OWN MODULE RATHER THAN A NUMBER IN `income_sources`
----------------------------------------------------------------------
Two things about VA pay break the assumptions a general income stream carries, and both change the
answer rather than the presentation.

**It is tax-free, which is not the same as "taxed less".** Compensation is excluded from gross
income (26 U.S.C. 104(a)(4)), so it never enters AGI, so it never enters MAGI. The ledger already
supports that through `taxable_share=0.0` — but the CONSEQUENCE is what matters: a veteran with
$50,000 a year of compensation has $50,000 of spending covered by income that leaves the entire
bracket, the entire Social Security taxability calculation and the entire Roth-conversion runway
untouched. That is a materially better position than a $50,000 pension, and it usually means MORE
room to convert, not less.

**It stops at death and does not pass to a spouse.** This is the opposite of the Social Security
survivor rule we model next door, and getting it backwards is the expensive mistake. A 100%-rated
veteran with a spouse receives about $4,158 a month; the survivor's DIC base is about $1,699 — a
fall of roughly 59% in tax-free income, landing in the same year the survivor starts filing single
on narrower brackets. `survivor_income_cliff` exists to put a number on that.

DIC IS NOT ASSUMED
------------------
Eligibility is a real test — the death must be service-connected, or the veteran rated totally
disabling for 8 continuous years before it — so `dic_eligible` defaults to **False**. A tool that
quietly grants DIC to every surviving spouse overstates a widow's income by about $20,000 a year
for life, which is precisely the household least able to absorb being wrong.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from ..calculators import va_disability as va
from .household import Household, IncomeSource, PlanningError, Person
from .ledger import project

# Compensation and DIC are both indexed to the Social Security COLA (38 U.S.C. 5312), so they are
# inflation-adjusted in the ledger — unlike a fixed pension.
_COLA_LINKED = True


def _veteran_and_survivor(household: Household, veteran: str) -> tuple[Person, Optional[Person]]:
    try:
        vet = next(p for p in household.people if p.name == veteran)
    except StopIteration:
        raise PlanningError(
            f"{veteran!r} is not in this household; people are "
            f"{[p.name for p in household.people]}") from None
    others = [p for p in household.people if p.name != veteran]
    if len(others) > 1:
        raise PlanningError(
            "VA benefit streams are modelled for a veteran and at most one spouse")
    return vet, (others[0] if others else None)


@dataclass(frozen=True)
class VaStreams:
    """The income sources a veteran's VA benefits put into the ledger, plus what they are worth."""

    sources: tuple[IncomeSource, ...]
    compensation_monthly: float
    compensation_annual: float
    dic_monthly: float
    dic_annual: float
    rate_year: int
    tier: str
    notes: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {"compensation_monthly": self.compensation_monthly,
                "compensation_annual": self.compensation_annual,
                "dic_monthly": self.dic_monthly, "dic_annual": self.dic_annual,
                "rate_year": self.rate_year, "tier": self.tier,
                "sources": [{"label": s.label, "owner": s.owner, "annual_amount": s.annual_amount,
                             "start_age": s.start_age, "end_age": s.end_age,
                             "taxable_share": s.taxable_share} for s in self.sources],
                "notes": list(self.notes)}


def va_streams(household: Household, *, veteran: str, rating: int,
               children_under_18: int = 0, children_over_18_in_school: int = 0,
               dependent_parents: int = 0, spouse_aid_attendance: bool = False,
               dic_eligible: bool = False, dic_eight_year_provision: bool = False,
               dic_children_under_18: int = 0,
               year: Optional[int] = None) -> VaStreams:
    """Build the veteran's compensation stream and, if eligible, the survivor's DIC stream.

    The spouse flag is taken from the household rather than passed, because the rate table's spouse
    amount and the ledger's filing status have to agree — a household filing jointly with a spouse
    the rate lookup did not know about would understate the benefit every month.
    """
    vet, spouse = _veteran_and_survivor(household, veteran)

    comp = va.disability_compensation(
        rating, spouse=spouse is not None, children_under_18=children_under_18,
        children_over_18_in_school=children_over_18_in_school,
        dependent_parents=dependent_parents,
        spouse_aid_attendance=spouse_aid_attendance, year=year)
    comp_annual = float(comp.detail["annual"])

    notes: list[str] = [
        "VA compensation is excluded from gross income (26 U.S.C. 104(a)(4)), so it is absent from "
        "AGI and MAGI: it does not make Social Security taxable, does not count toward an IRMAA "
        "bracket, and does not consume room for a Roth conversion.",
        "Compensation and DIC both move with the Social Security COLA (38 U.S.C. 5312), so both "
        "are inflation-adjusted here.",
    ]

    sources: list[IncomeSource] = [IncomeSource(
        label="VA disability compensation", annual_amount=comp_annual, owner=vet.name,
        start_age=vet.current_age,
        # Ends at the veteran's death. `Person.is_alive_in` keeps someone alive while age <=
        # life_expectancy, so the last year they collect is the year they reach it.
        end_age=vet.life_expectancy,
        taxable_share=0.0, inflation_adjusted=_COLA_LINKED)]

    dic_monthly = dic_annual = 0.0
    if spouse is not None and dic_eligible:
        d = va.dic(children_under_18=dic_children_under_18,
                   eight_year_provision=dic_eight_year_provision, year=year)
        dic_monthly = float(d.value)
        dic_annual = float(d.detail["annual"])
        # The same off-by-one that double-paid in the Social Security survivor model: the veteran is
        # still collecting IN the year they reach their life expectancy, so DIC begins one year
        # later. Starting it a year early pays compensation and DIC in the same year.
        first_gone_offset = (vet.life_expectancy - vet.current_age) + 1
        spouse_age_at_death = spouse.current_age + first_gone_offset
        if spouse_age_at_death <= spouse.life_expectancy:
            sources.append(IncomeSource(
                label="VA DIC (survivor)", annual_amount=dic_annual, owner=spouse.name,
                start_age=spouse_age_at_death, taxable_share=0.0,
                inflation_adjusted=_COLA_LINKED))
            notes.append(
                f"{spouse.name} receives DIC of ${dic_annual:,.0f}/yr from age "
                f"{spouse_age_at_death}, replacing ${comp_annual:,.0f}/yr of compensation — a fall "
                f"of ${comp_annual - dic_annual:,.0f}/yr in tax-free income.")
        else:
            notes.append(
                f"{spouse.name} is not expected to outlive {vet.name}, so no DIC stream is "
                f"modelled.")
    elif spouse is not None:
        notes.append(
            "No DIC is modelled. Eligibility is a real test — the death must be service-connected, "
            "or the veteran rated totally disabling for the 8 continuous years before it — so DIC "
            "is never assumed. If it applies, pass dic_eligible=True; it is worth about "
            f"${va.dic(year=year).detail['annual']:,.0f}/yr.")
    notes.append(
        f"Compensation ends at {vet.name}'s death and does not pass to a spouse. This is the "
        f"opposite of the Social Security survivor rule, where the survivor steps UP to the larger "
        f"benefit.")

    return VaStreams(
        sources=tuple(sources), compensation_monthly=float(comp.value),
        compensation_annual=comp_annual, dic_monthly=dic_monthly, dic_annual=dic_annual,
        rate_year=int(comp.detail["rate_year"]), tier=comp.tier, notes=tuple(notes))


@dataclass(frozen=True)
class IncomeCliff:
    """What the survivor's income does at the veteran's death."""

    year_of_death: int
    before_total: float
    after_total: float
    before_tax_free: float
    after_tax_free: float
    survivor: str
    notes: tuple[str, ...]

    @property
    def drop(self) -> float:
        return self.before_total - self.after_total

    @property
    def drop_share(self) -> float:
        return self.drop / self.before_total if self.before_total else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {"year_of_death": self.year_of_death, "survivor": self.survivor,
                "before_total": round(self.before_total, 2),
                "after_total": round(self.after_total, 2),
                "before_tax_free": round(self.before_tax_free, 2),
                "after_tax_free": round(self.after_tax_free, 2),
                "drop": round(self.drop, 2), "drop_share": round(self.drop_share, 4),
                "notes": list(self.notes)}


def survivor_income_cliff(household: Household, *, veteran: str, rating: int,
                          tax_year: Optional[int] = None, **kw: Any) -> IncomeCliff:
    """Put a number on the fall in household income at the veteran's death.

    THE EVENT NO TOOL SHOWS. Three things land in the same year: compensation stops entirely, DIC
    (if it applies at all) replaces it at roughly 40% of the amount, and the survivor begins filing
    single on narrower brackets. Modelling VA pay as a continuing pension hides all three, and the
    household finds out at the worst possible moment.
    """
    vet, spouse = _veteran_and_survivor(household, veteran)
    if spouse is None:
        raise PlanningError(
            "survivor_income_cliff compares a household before and after a death; it needs a "
            "spouse to survive")

    streams = va_streams(household, veteran=veteran, rating=rating, **kw)
    h = Household(people=list(household.people), filing_status=household.filing_status,
                  accounts=list(household.accounts),
                  income_sources=[s for s in household.income_sources
                                  if "va " not in s.label.lower()] + list(streams.sources),
                  expenses=list(household.expenses), goals=list(household.goals),
                  withdrawal_order=household.withdrawal_order)
    r = project(h, tax_year=tax_year)

    both = [y for y in r.years if len(y.ages) == 2]
    alone = [y for y in r.years if len(y.ages) == 1]
    if not both or not alone:
        raise PlanningError(
            "the projection horizon does not contain both a year with both spouses alive and a "
            "year with only the survivor; widen the horizon or check the life expectancies")
    last_together, first_alone = both[-1], alone[0]

    # Tax-free income is the part that matters most here, because it is the part that vanishes.
    # DERIVED, not read off a field that does not exist: the ledger tracks `other_income` and the
    # taxable share of it, so the untaxed remainder is the difference. An earlier version reached
    # for a `tax_free_income` attribute with a 0.0 default, which would have reported "no tax-free
    # income" for every household rather than failing.
    def tax_free(row: Any) -> float:
        return float(row.other_income) - float(row.taxable_other_income)

    notes = list(streams.notes)
    notes.append(
        f"In the last year both are alive the household has "
        f"${last_together.other_income + last_together.wage_income:,.0f} of income; in the first "
        f"year {spouse.name} is alone it has "
        f"${first_alone.other_income + first_alone.wage_income:,.0f}.")
    notes.append(
        f"{spouse.name} also moves from married-filing-jointly to single in that year, so the "
        f"remaining income is taxed on narrower brackets — the ledger's widow's penalty.")

    return IncomeCliff(
        year_of_death=first_alone.year_offset,
        before_total=last_together.other_income + last_together.wage_income,
        after_total=first_alone.other_income + first_alone.wage_income,
        before_tax_free=tax_free(last_together), after_tax_free=tax_free(first_alone),
        survivor=spouse.name, notes=tuple(notes))
