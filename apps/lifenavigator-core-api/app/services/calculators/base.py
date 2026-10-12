"""Deterministic financial calculators — contract and rate primitives (Phase 2).

WHY THIS EXISTS
---------------
The advisor's trust spine is a number gate: a figure may reach the user only if it is one of the
user's own numbers, or a `derivations` expression the server re-evaluates and confirms
(`advisor_math.verify_derivations`). That verifier accepts `+ - * / ( )` and nothing else — there is
no `ast.Pow` anywhere in it. So `(1 + r)^n` is INEXPRESSIBLE, and therefore the advisor structurally
cannot state a mortgage payment, a compound-growth figure, a retirement projection, or an
amortization schedule. It is not that the model gets those wrong; it is that no correct answer can
pass the gate. Measured, that gate is roughly half the advisor-quality gap.

These calculators are the sanctioned path for that math. They are TESTED CODE, not model-authored
expressions, which is why they are allowed to do what the derivation grammar may not. The right fix
was never to widen the grammar — that would mean trusting LLM-written compound-interest formulas.

CONTRACT
--------
Every calculator returns a `CalcResult` carrying its value, the inputs it used, the assumptions it
made, and a `tier`:

  strict    — derived ONLY from the user's own figures (no assumed rate). It IS their data, so it
              needs no hedging language.
  scenario  — depends on an assumption (a return rate, an inflation rate, a withdrawal rule). It
              must be presented as an estimate; `advisor_validator._SCENARIO_LABEL` is the gate that
              enforces the hedge downstream.

A calculator that takes a rate assumption is ALWAYS scenario tier. That is mechanical, not a
judgement call — see `CalcResult.__post_init__`.

TWO MONTHLY RATES, DELIBERATELY NAMED APART
-------------------------------------------
Conflating these is the classic finance bug, and the TypeScript side already has both conventions
under confusingly similar names:

  effective_monthly_rate(0.06) = (1.06)^(1/12) - 1 = 0.004867…   ← growth/returns/inflation
  nominal_monthly_rate(0.06)   = 0.06 / 12        = 0.005        ← quoted APRs (lenders)

`projector.ts` uses the exact-equivalent form for investment/income/inflation drift, and the plain
`apr / 12` form inside its mortgage payment. Both are correct for their purpose — a 6% APR mortgage
really is billed at 0.5%/month, while a 6% annual return really does compound to 6% over 12 months.
A port that "tidied" them into one would be wrong and would silently break parity, so they are kept
distinct and separately named here.

ALL RATES ARE DECIMAL FRACTIONS (0.06 == 6%). The TS `calculateMonthlyContribution` takes PERCENT
(`annualReturn / 12 / 100`) while `projector.monthlyRate` takes a decimal — a live inconsistency in
the existing code. This module admits exactly one convention and validates it.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

# A rate above this is almost certainly a percent that was not converted (e.g. 7 meaning 7%).
# Rejected loudly rather than silently projecting a 700%/yr return.
_MAX_PLAUSIBLE_ANNUAL_RATE = 1.0

STRICT = "strict"
SCENARIO = "scenario"

# Units a result can carry. The advisor renders these; a free-text unit would make that guesswork.
UNITS = frozenset({"usd", "usd_per_month", "usd_per_year", "months", "years", "pct", "ratio", "count"})


class CalculatorError(ValueError):
    """Invalid input to a calculator. Raised, never swallowed into a wrong number.

    A calculator that cannot answer must say so: the advisor's honest move is to ask for the missing
    input, and a silently-zero or silently-guessed figure is exactly the fabrication the number gate
    exists to prevent.
    """


@dataclass(frozen=True)
class Assumption:
    """A value the calculator supplied that the user did not state.

    `rationale` is user-facing: it is why the number is defensible, and it is what makes a scenario
    result honest rather than a figure pulled from nowhere.

    `source` records WHERE the value came from: "registry" when it is the platform's canonical
    assumption, or "caller" when the request supplied it. Build registry-backed assumptions with
    `from_registry()` — never by hand.
    """

    key: str
    value: Any
    rationale: str
    source: str = "caller"

    def as_dict(self) -> dict[str, Any]:
        return {"key": self.key, "value": self.value, "rationale": self.rationale,
                "source": self.source}


def from_registry(key: str) -> tuple[float, Assumption]:
    """The platform's canonical value for `key`, plus its citation.

    `app/services/assumptions.py` is explicit that "no projection may invent an assumption inline;
    if you need a number that isn't measured from the user's data, it comes from this registry and is
    shown to the user." Calculators therefore do NOT carry their own default rates.

    This matters beyond tidiness: the first cut of these calculators hardcoded a 5% "real
    (after-inflation)" return while the registry's `investment_return` is 6% NOMINAL. Two different
    numbers meaning two different things, so the same user could be shown two different retirement
    projections depending on which code path answered — the exact divergence the registry exists to
    prevent. The registry also carries each value's `basis`, so the rationale shown to the user is
    the platform's stated reasoning rather than a sentence invented here.
    """
    from .. import assumptions as A  # local import: assumptions must not depend on calculators

    cited = A.cite(key)
    return float(cited["value"]), Assumption(
        key=key,
        value=float(cited["value"]),
        rationale=f"{cited['label']} — {cited['basis']}",
        source="registry",
    )


@dataclass(frozen=True)
class CalcResult:
    """One computed figure, with everything needed to cite it and to audit it later."""

    calculator: str                       # registry id, e.g. "debt.amortized_payment"
    label: str                            # what this number IS, in the advisor's words
    value: float
    unit: str
    tier: str                             # STRICT | SCENARIO
    inputs_used: dict[str, Any] = field(default_factory=dict)
    assumptions: tuple[Assumption, ...] = ()
    detail: dict[str, Any] = field(default_factory=dict)   # extra non-cited context (schedules etc.)

    def __post_init__(self) -> None:
        if self.unit not in UNITS:
            raise CalculatorError(f"unknown unit {self.unit!r}; expected one of {sorted(UNITS)}")
        if self.tier not in (STRICT, SCENARIO):
            raise CalculatorError(f"tier must be {STRICT!r} or {SCENARIO!r}, got {self.tier!r}")
        # The mechanical rule: assumptions ⇒ scenario. A result that assumed a rate but claimed to be
        # the user's own figure would bypass the hedge the validator looks for, which is precisely how
        # an estimate gets read as a fact.
        if self.assumptions and self.tier != SCENARIO:
            raise CalculatorError(
                f"{self.calculator} made assumptions {[a.key for a in self.assumptions]} but is "
                f"tier={self.tier!r}; anything resting on an assumption must be {SCENARIO!r}"
            )

    @property
    def is_scenario(self) -> bool:
        return self.tier == SCENARIO

    def as_dict(self) -> dict[str, Any]:
        """Shape handed to the advisor context packet (Phase 3 wires this into allowed_numbers)."""
        return {
            "calculator": self.calculator,
            "label": self.label,
            "value": self.value,
            "unit": self.unit,
            "tier": self.tier,
            "inputs_used": dict(self.inputs_used),
            "assumptions": [a.as_dict() for a in self.assumptions],
            "detail": dict(self.detail),
        }


# ── Validation helpers ────────────────────────────────────────────────────────────────────────────
def require_money(name: str, v: Any, *, allow_zero: bool = True) -> float:
    """A dollar amount: finite, non-negative."""
    f = _finite(name, v)
    if f < 0:
        raise CalculatorError(f"{name} must not be negative, got {f}")
    if not allow_zero and f == 0:
        raise CalculatorError(f"{name} must be greater than zero")
    return f


def require_rate(name: str, v: Any) -> float:
    """An annual rate as a DECIMAL FRACTION (0.06 == 6%).

    A value above 1.0 is rejected: it is far more likely an unconverted percent than a real
    >100%/yr rate, and accepting it would project a wildly wrong number with total confidence.
    """
    f = _finite(name, v)
    if f < 0:
        raise CalculatorError(f"{name} must not be negative, got {f}")
    if f > _MAX_PLAUSIBLE_ANNUAL_RATE:
        raise CalculatorError(
            f"{name}={f} looks like a percent, not a decimal fraction — pass {f / 100:g} for {f:g}%"
        )
    return f


def require_discount_rate(name: str, v: Any) -> float:
    """A rate used for DISCOUNTING, which may legitimately be negative.

    Distinct from `require_rate` on purpose. `require_rate` guards *growth* inputs — a return, an
    inflation rate, an APR — where a negative value is almost always a sign error, so rejecting it
    catches bugs. Discounting is different in two ways that matter:

      * A negative discount rate is meaningful (deflation), and
      * IRR is frequently negative. A loss-making purchase has a real, negative internal rate of
        return, and `npv(irr(flows), flows) == 0` must hold for it. With `require_rate` on `npv`,
        verifying a negative IRR raised instead of returning zero — the defining property of IRR
        became unprovable for exactly the cases a user most needs told about.

    Still rejects values above 1.0 (the unconverted-percent guard from R5) and anything at or below
    -1.0, where `(1 + r)` reaches zero and every discount factor divides by it.
    """
    f = _finite(name, v)
    if f <= -1.0:
        raise CalculatorError(
            f"{name}={f} is at or below -100%; the discount factor (1+{name}) would be zero or negative"
        )
    if f > _MAX_PLAUSIBLE_ANNUAL_RATE:
        raise CalculatorError(
            f"{name}={f} looks like a percent, not a decimal fraction — pass {f / 100:g} for {f:g}%"
        )
    return f


def require_months(name: str, v: Any, *, maximum: int = 1200) -> int:
    """A whole number of months, at least 1. `maximum` defaults to 100 years."""
    try:
        i = int(v)
    except (TypeError, ValueError) as exc:
        raise CalculatorError(f"{name} must be a whole number of months, got {v!r}") from exc
    if i < 1:
        raise CalculatorError(f"{name} must be at least 1 month, got {i}")
    if i > maximum:
        raise CalculatorError(f"{name}={i} exceeds the {maximum}-month horizon")
    return i


def _finite(name: str, v: Any) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError) as exc:
        raise CalculatorError(f"{name} must be a number, got {v!r}") from exc
    # NaN propagates silently through arithmetic and would surface as a citable "nan".
    if f != f or f in (float("inf"), float("-inf")):
        raise CalculatorError(f"{name} must be finite, got {v!r}")
    return f


# ── Rate primitives ───────────────────────────────────────────────────────────────────────────────
def effective_monthly_rate(annual_rate: float) -> float:
    """Monthly rate that compounds to `annual_rate` over 12 months: (1+r)^(1/12) - 1.

    For GROWTH: investment returns, income growth, inflation. Mirrors `projector.ts monthlyRate`
    exactly, so the two engines agree.
    """
    r = require_rate("annual_rate", annual_rate)
    return (1.0 + r) ** (1.0 / 12.0) - 1.0


def nominal_monthly_rate(annual_rate: float) -> float:
    """Quoted APR divided by 12 — the LENDER convention: r / 12.

    For DEBT: mortgages, card APRs, loan amortization. A 6% APR is billed at 0.5%/month, not at the
    0.4867% that would compound to 6%. `projector.ts` uses this form inside its mortgage payment.
    """
    r = require_rate("annual_rate", annual_rate)
    return r / 12.0


# ── Registry ──────────────────────────────────────────────────────────────────────────────────────
# Populated by @register in the calculator modules. Keyed by the same id a CalcResult reports, so a
# cited figure can always be traced back to the function that produced it.
REGISTRY: dict[str, Callable[..., CalcResult]] = {}


def register(calc_id: str) -> Callable[[Callable[..., CalcResult]], Callable[..., CalcResult]]:
    """Register a calculator under `calc_id` (`"<module>.<name>"`)."""

    def _wrap(fn: Callable[..., CalcResult]) -> Callable[..., CalcResult]:
        if calc_id in REGISTRY:
            raise RuntimeError(f"calculator id {calc_id!r} is already registered")
        REGISTRY[calc_id] = fn
        fn.calc_id = calc_id  # type: ignore[attr-defined]
        return fn

    return _wrap


def get(calc_id: str) -> Optional[Callable[..., CalcResult]]:
    return REGISTRY.get(calc_id)


def available() -> list[str]:
    return sorted(REGISTRY)
