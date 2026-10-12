"""The planning spine (Phase P) — a year-by-year household ledger.

A planning engine is not a bag of calculators. It is a lifetime household ledger from which every
displayed number is derived: probability of success, withdrawal sequencing, Roth conversion ladders,
stress tests and side-by-side what-ifs are all READOUTS of a ledger, not separate formulas.

See docs/financial-engine/PLANNING_ENGINE_GAP.md for why this had to move ahead of Phase K.
"""
from .household import (  # noqa: F401
    PlanningError,
    Account,
    Expense,
    Goal,
    Guardrail,
    Household,
    IncomeSource,
    Person,
    SpendItem,
    TAXABLE,
    TAX_DEFERRED,
    ROTH,
    HSA,
)
from .ledger import LedgerYear, PlanResult, project  # noqa: F401
from .monte_carlo import MonteCarloResult, simulate  # noqa: F401
from .whatif import (  # noqa: F401
    Solution,
    WhatIf,
    assume_inflation,
    assume_return,
    compare,
    custom,
    delay_social_security,
    move_to_state,
    retire_later,
    save_more,
    solve_all,
    solve_for_retirement_age,
    solve_for_spending,
    spend_change,
    suggest,
)
from .stress import (  # noqa: F401
    StressResult,
    crash_at_retirement,
    early_death_of_spouse,
    inflation_shock,
    long_term_care,
    longevity,
    lost_decade,
    run_all,
)
from .strategies import (  # noqa: F401
    GuardrailResult,
    StrategyResult,
    claiming_factor,
    roth_conversion_ladder,
    social_security_claiming,
    spending_guardrails,
    withdrawal_sequencing,
)
