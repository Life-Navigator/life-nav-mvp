"""Deterministic financial calculators (Phase 2).

Importing this package registers every calculator in `base.REGISTRY`. The modules are imported for
their REGISTRATION side effect, so the registry is complete after a single
`import app.services.calculators` — a caller must never have to know which module holds which
calculator in order for it to exist.

See `base.py` for the contract, the strict/scenario tiering, and why the two monthly-rate
conventions are deliberately kept apart.
"""
# Imported for their REGISTRATION side effect. Every module that calls @register or @rule MUST be
# listed, or the registry is silently partial.
#
# THE BUG THIS FIXES: only debt/money/retirement were here — the Phase 2 three. Phases A, B and B2
# added eight more modules and none were added, so `base.available()` returned 11 calculators
# instead of 34 and `treatment.available_rules()` returned ZERO unless the caller happened to have
# imported those modules itself. Gate 8 (every calculator declared reachable) passed only because
# the TEST file imports them all; a production caller asking the registry what exists got a
# confident, partial answer. The module docstring above already promised otherwise.
from . import (  # noqa: F401
    career,
    cash,
    debt,
    education,
    effective,
    housing,
    money,
    primitives,
    retirement,
    tax,
    tax_debt_interest,
    tax_wrappers,
    treatment,
    va_disability,
    versioned_data,
)
from .base import (  # noqa: F401
    SCENARIO,
    STRICT,
    Assumption,
    CalcResult,
    CalculatorError,
    available,
    effective_monthly_rate,
    get,
    nominal_monthly_rate,
    REGISTRY,
)

__all__ = [
    "SCENARIO", "STRICT", "Assumption", "CalcResult", "CalculatorError",
    "REGISTRY", "available", "get", "effective_monthly_rate", "nominal_monthly_rate",
    "career", "cash", "debt", "education", "effective", "housing", "money", "primitives",
    "retirement", "tax", "tax_debt_interest", "tax_wrappers", "treatment", "va_disability",
    "versioned_data",
]
