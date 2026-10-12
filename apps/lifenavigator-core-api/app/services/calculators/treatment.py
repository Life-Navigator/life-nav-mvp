"""`TreatmentResult` — the contract for a tax DETERMINATION (Phase B2).

WHY `CalcResult` IS NOT ENOUGH
------------------------------
`CalcResult` carries one figure and one tier, which is exactly right for "what do I owe on $150k?".
It is the wrong shape for "is my HELOC interest deductible?", because the answer is not a number —
it is a determination, reached by a test, bounded by a limit, and usually trailing a trap.

Two fields carry most of the value, and neither has anywhere to live on a `CalcResult`:

`tests` IS THE EXPLANATION. "Your HELOC interest is not deductible" is a dead end. "Not deductible,
because the proceeds paid off credit cards rather than improving the residence securing the loan
(§163(h)(3) tracing) — the kitchen renovation would have qualified" is advice the user can act on,
and it comes out of the identical computation. The test that decided it is the most useful thing
the engine knows.

`traps` IS THE DIFFERENTIATOR. Every rule in this layer has a delayed cost that generic advice
omits: depreciation recapture at 25% on the rental you were told to depreciate, the pro-rata rule
on the backdoor Roth, AMT on the ISO exercise, the 13-month testing period on an HSA funded under
the last-month rule. That is where real money is lost, and it is invisible at the moment of the
decision.

RULES VS PARAMETERS — THE REASON THIS LAYER CAN SHIP BEFORE ITS DATA IS VERIFIED
-------------------------------------------------------------------------------
Statutory structure is stable. §163(d) has limited investment interest to net investment income for
decades; the HELOC tracing rule has held since TCJA; the 7-day short-term-rental rule is in the
regulations. The DOLLAR THRESHOLDS bolted onto those rules change annually.

So a determination tracks the two separately. `parameters_verified=False` means **the rule holds and
the amount is unverified** — which is more useful than refusing to answer, and strictly more honest
than a number with no rule behind it. This is the inverse of Phase B, where the engine was sound and
the data was the weak half.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# ── Determinations ────────────────────────────────────────────────────────────────────────────────
DEDUCTIBLE = "deductible"
NOT_DEDUCTIBLE = "not_deductible"
PARTIALLY_DEDUCTIBLE = "partially_deductible"
EXCLUDED = "excluded"               # never enters income (employer HSA via payroll, FSA)
DEDUCTED = "deducted"               # enters income, then deducted (traditional IRA)
TAX_DEFERRED = "tax_deferred"
TAX_FREE = "tax_free"
TAXABLE = "taxable"
ELIGIBLE = "eligible"
INELIGIBLE = "ineligible"
PASSIVE = "passive"
NON_PASSIVE = "non_passive"

DETERMINATIONS = frozenset({
    DEDUCTIBLE, NOT_DEDUCTIBLE, PARTIALLY_DEDUCTIBLE, EXCLUDED, DEDUCTED,
    TAX_DEFERRED, TAX_FREE, TAXABLE, ELIGIBLE, INELIGIBLE, PASSIVE, NON_PASSIVE,
})

# ── Character ─────────────────────────────────────────────────────────────────────────────────────
ORDINARY = "ordinary"
CAPITAL_SHORT = "capital_short"
CAPITAL_LONG = "capital_long"
SE_INCOME = "se_income"
CHARACTERS = frozenset({ORDINARY, CAPITAL_SHORT, CAPITAL_LONG, SE_INCOME, PASSIVE, NON_PASSIVE})


class TreatmentError(ValueError):
    """A determination cannot be made from the facts given.

    Raised — never resolved to a default — because the defaults here are not neutral. Assuming
    interest is deductible overstates a deduction; assuming it is not understates it. Both are
    confident wrong answers, and the honest move is to name the fact that is missing.
    """


@dataclass(frozen=True)
class Test:
    """One statutory test, and what the user's facts did to it.

    `decided_by` names the INPUT that settled it, not the rule — so the user can see which of their
    own facts to change. "proceeds_used_for='debt_payoff'" tells them the lever; "§163(h)(3)" does
    not.
    """

    name: str
    passed: bool
    why: str
    decided_by: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "passed": self.passed, "why": self.why,
                "decided_by": self.decided_by}


@dataclass(frozen=True)
class TreatmentResult:
    rule: str                                   # "debt_interest.heloc"
    determination: str
    authority: str                              # "IRC §163(h)(3)" — what makes this true
    summary: str                                # one sentence, user-facing
    amount: Optional[float] = None              # deductible/excludable amount, when quantifiable
    unit: str = "usd"
    character: Optional[str] = None
    tests: tuple[Test, ...] = ()
    binding_limit: Optional[str] = None         # which cap actually bound, when one did
    traps: tuple[str, ...] = ()
    inputs_used: dict[str, Any] = field(default_factory=dict)
    parameters_verified: bool = False
    parameter_year: Optional[int] = None
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.determination not in DETERMINATIONS:
            raise TreatmentError(
                f"{self.rule}: unknown determination {self.determination!r}; "
                f"expected one of {sorted(DETERMINATIONS)}"
            )
        if self.character is not None and self.character not in CHARACTERS:
            raise TreatmentError(f"{self.rule}: unknown character {self.character!r}")
        if not self.authority.strip():
            # A determination without an authority is an opinion. The citation is what separates
            # this engine from a model guessing at tax law.
            raise TreatmentError(f"{self.rule}: every determination must cite its authority")
        if not self.tests:
            raise TreatmentError(
                f"{self.rule}: a determination must record at least one test — the test IS the "
                f"explanation, and a bare verdict is not actionable"
            )

    @property
    def failed_tests(self) -> tuple[Test, ...]:
        return tuple(t for t in self.tests if not t.passed)

    @property
    def is_favourable(self) -> bool:
        return self.determination in (DEDUCTIBLE, PARTIALLY_DEDUCTIBLE, EXCLUDED, DEDUCTED,
                                      TAX_FREE, TAX_DEFERRED, ELIGIBLE, NON_PASSIVE)

    @property
    def what_would_change_it(self) -> tuple[str, ...]:
        """The failed tests, phrased as levers. This is the actionable half of an unfavourable
        determination, and the reason `decided_by` exists."""
        return tuple(f"{t.name}: {t.why}" for t in self.failed_tests)

    def as_dict(self) -> dict[str, Any]:
        return {
            "rule": self.rule, "determination": self.determination,
            "authority": self.authority, "summary": self.summary,
            "amount": self.amount, "unit": self.unit, "character": self.character,
            "tests": [t.as_dict() for t in self.tests],
            "binding_limit": self.binding_limit, "traps": list(self.traps),
            "inputs_used": dict(self.inputs_used),
            "parameters_verified": self.parameters_verified,
            "parameter_year": self.parameter_year,
            "notes": list(self.notes),
            "what_would_change_it": list(self.what_would_change_it),
        }

    def to_calc_result(self, label: Optional[str] = None):
        """The quantified part as a `CalcResult`, so the amount can reach the number gate.

        SCENARIO tier whenever the parameters are unverified — an amount resting on an unverified
        statutory limit is an estimate, whatever the rule says, and the validator must hedge it.
        """
        from .base import SCENARIO, STRICT, CalcResult
        if self.amount is None:
            raise TreatmentError(f"{self.rule}: no quantified amount to cite")
        return CalcResult(
            calculator=self.rule, label=label or self.summary, value=round(self.amount, 2),
            unit=self.unit, tier=STRICT if self.parameters_verified else SCENARIO,
            inputs_used=dict(self.inputs_used),
            detail={"determination": self.determination, "authority": self.authority,
                    "binding_limit": self.binding_limit, "traps": list(self.traps),
                    "tests": [t.as_dict() for t in self.tests],
                    "parameters_verified": self.parameters_verified},
        )


# ── Registry ──────────────────────────────────────────────────────────────────────────────────────
RULES: dict[str, Any] = {}


def rule(rule_id: str):
    """Register a treatment rule under `rule_id` ("<group>.<name>")."""

    def _wrap(fn):
        if rule_id in RULES:
            raise RuntimeError(f"treatment rule {rule_id!r} is already registered")
        RULES[rule_id] = fn
        fn.rule_id = rule_id  # type: ignore[attr-defined]
        return fn

    return _wrap


def get_rule(rule_id: str):
    return RULES.get(rule_id)


def available_rules() -> list[str]:
    return sorted(RULES)
