"""Deterministic financial calculators (Phase 2).

Importing this package registers every calculator in `base.REGISTRY`. The modules are imported for
their REGISTRATION side effect, so the registry is complete after a single
`import app.services.calculators` — a caller must never have to know which module holds which
calculator in order for it to exist.

See `base.py` for the contract, the strict/scenario tiering, and why the two monthly-rate
conventions are deliberately kept apart.
"""
from . import debt, money, retirement  # noqa: F401  (imported to populate the registry)
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
    "debt", "money", "retirement",
]
