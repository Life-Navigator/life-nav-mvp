"""Centralized Assumption Registry (Elite Sprint 24).

Every projection in LifeNavigator references its assumptions from here — one place, each with a
value, a human label, a cited basis, a category, and whether a user/advisor may edit it. No
projection may invent an assumption inline; if you need a number that isn't measured from the
user's data, it comes from this registry and is shown to the user. This is what lets a skeptical
CFP/CFO answer "what assumptions were used?" for any value.
"""
from __future__ import annotations

from typing import Any, Optional


class Assumption:
    def __init__(self, key: str, value: float, unit: str, label: str, basis: str, category: str, editable: bool = True) -> None:
        self.key, self.value, self.unit, self.label, self.basis, self.category, self.editable = key, value, unit, label, basis, category, editable

    def to_dict(self, value: Optional[float] = None) -> dict[str, Any]:
        return {"key": self.key, "value": value if value is not None else self.value, "default": self.value,
                "unit": self.unit, "label": self.label, "basis": self.basis, "category": self.category, "editable": self.editable}


_REGISTRY: dict[str, Assumption] = {a.key: a for a in [
    Assumption("investment_return", 0.06, "annual %", "Investment return", "Long-run nominal return for a diversified 60/40-style portfolio; deliberately conservative vs the ~10% historical S&P average.", "markets"),
    Assumption("return_volatility", 0.12, "annual %", "Return volatility", "Approximate standard deviation of a diversified portfolio's annual returns.", "markets"),
    Assumption("inflation", 0.025, "annual %", "Inflation", "Near the Fed's 2% long-run target plus a small buffer.", "economy"),
    Assumption("tuition_inflation", 0.05, "annual %", "Tuition inflation", "Higher-education costs have historically risen ~5%/yr, above general inflation.", "education"),
    Assumption("home_appreciation", 0.035, "annual %", "Home appreciation", "Long-run U.S. home price growth roughly tracks inflation + ~1%.", "housing"),
    Assumption("mortgage_rate", 0.068, "annual %", "Mortgage rate", "Representative recent 30-year fixed rate; varies by credit + market.", "housing"),
    Assumption("down_payment_pct", 0.20, "% of price", "Down payment", "Conventional 20% to avoid PMI; many buyers put less down.", "housing"),
    Assumption("withdrawal_rate", 0.04, "% of assets", "Safe withdrawal rate", "The '4% rule' (Bengen 1994 / Trinity study) for a ~30-year retirement.", "retirement"),
    Assumption("retirement_replacement", 0.80, "% of income", "Retirement income replacement", "Common planning target of ~70-85% of pre-retirement income.", "retirement"),
    Assumption("life_expectancy", 92, "age", "Planning life expectancy", "Plan to ~92 to avoid outliving assets (above average to be safe).", "retirement"),
    Assumption("ss_replacement", 0.30, "% of income", "Social Security replacement (estimate)", "Used ONLY when no SSA statement is uploaded; SS replaces ~30-40% for median earners.", "retirement"),
    Assumption("salary_growth", 0.03, "annual %", "Salary growth", "Typical merit + inflation raise; your offers/history override this.", "career"),
    Assumption("equity_vest_years", 4, "years", "Equity vesting period", "Standard 4-year vest; your grant terms override this.", "career"),
    Assumption("marginal_tax_rate", 0.24, "%", "Marginal tax rate (fallback)", "Used only when income is unknown; otherwise computed from your income bracket.", "tax"),
]}


def get(key: str) -> Assumption:
    return _REGISTRY[key]


def value(key: str, overrides: Optional[dict[str, float]] = None) -> float:
    if overrides and key in overrides:
        return overrides[key]
    return _REGISTRY[key].value


def cite(key: str, overrides: Optional[dict[str, float]] = None) -> dict[str, Any]:
    """An assumption reference for a projection's lineage."""
    return _REGISTRY[key].to_dict(value(key, overrides))


def all_assumptions(overrides: Optional[dict[str, float]] = None) -> list[dict[str, Any]]:
    return [a.to_dict(value(a.key, overrides)) for a in _REGISTRY.values()]


def by_category(overrides: Optional[dict[str, float]] = None) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for a in _REGISTRY.values():
        out.setdefault(a.category, []).append(a.to_dict(value(a.key, overrides)))
    return out
