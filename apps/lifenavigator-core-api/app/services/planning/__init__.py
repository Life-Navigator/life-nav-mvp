"""The planning spine (Phase P) — a year-by-year household ledger.

A planning engine is not a bag of calculators. It is a lifetime household ledger from which every
displayed number is derived: probability of success, withdrawal sequencing, Roth conversion ladders,
stress tests and side-by-side what-ifs are all READOUTS of a ledger, not separate formulas.

See docs/financial-engine/PLANNING_ENGINE_GAP.md for why this had to move ahead of Phase K.
"""
from .household import (  # noqa: F401
    Account,
    Expense,
    Goal,
    Household,
    IncomeSource,
    Person,
    TAXABLE,
    TAX_DEFERRED,
    ROTH,
    HSA,
)
from .ledger import LedgerYear, PlanResult, project  # noqa: F401
from .monte_carlo import MonteCarloResult, simulate  # noqa: F401
