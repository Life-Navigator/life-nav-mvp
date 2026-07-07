"""Plaid Sandbox Persona Registry + custom configs — faithful Python port.

This module is a faithful, data-preserving translation of two TypeScript files:
  - apps/web/src/lib/integrations/plaid/personas.ts
  - apps/web/src/lib/integrations/plaid/plaid-custom-configs.ts

Every persona, field, account config, balance, APR, credit limit, transaction,
and holding-allocation rule is preserved EXACTLY. Nothing here is invented; the
values mirror the source TS modules 1:1. Pure standard library only.

Beta users pick a friendly "sample financial profile." Each persona carries rich
LifeNavigator metadata AND a Plaid sandbox data source. Most use a distinct
`user_custom` config (see PLAID_CUSTOM_CONFIGS) so the synthetic accounts,
balances, and cash-flow differ materially; the rest use a documented sandbox
user.

Plaid amounts: positive = money out.
"""

import math
from typing import Optional

# --- Constants (mirror personas.ts) -----------------------------------------
INST = "ins_109508"  # First Platypus Bank (sandbox)
PASS = "pass_good"


def _persona(p: dict) -> dict:
    """Apply the same defaults the TS `persona()` factory applies.

    user_custom is the username when a custom config exists; otherwise the
    documented sandbox user named in plaid_config_source.
    """
    source = p["plaid_config_source"]
    if source == "user_custom":
        user = "user_custom"
    elif source == "user_transactions_dynamic":
        user = "user_transactions_dynamic"
    else:
        user = "user_good"
    result = {
        "plaid_sandbox_user": user,
        "plaid_sandbox_password": PASS,
        "plaid_products": ["transactions"],
        "institution_id": INST,
    }
    result.update(p)
    return result


PLAID_PERSONAS: list[dict] = [
    _persona(
        {
            "persona_id": "young_professional",
            "display_name": "Young Professional",
            "description": "Early-career, steady paycheck, building savings and starting to invest.",
            "life_stage": "early_career",
            "financial_complexity": "simple",
            "profession": "Software Analyst",
            "family": "Single, no dependents",
            "income_type": "W-2 salary (biweekly)",
            "spending_pattern": "Rent + subscriptions + dining; modest discretionary",
            "asset_profile": "Small checking + starter emergency fund",
            "liability_profile": "Student loan + low credit-card balance",
            "investment_profile": "Just getting started",
            "risk_profile": "moderate",
            "primary_goals": [
                "Build an emergency fund",
                "Start investing",
                "Pay down student debt",
            ],
            "expected_insights": [
                "Emergency-fund target gap",
                "Automate investing",
                "Student-loan payoff timeline",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "small_business_owner",
            "display_name": "Small Business Owner",
            "description": "Runs a small business with irregular income and mixed personal/business cash flow.",
            "life_stage": "business_owner",
            "financial_complexity": "complex",
            "profession": "Owner, services LLC",
            "family": "Married, 1 child",
            "income_type": "Business revenue (irregular) + owner draws",
            "spending_pattern": "Lumpy vendor + payroll outflows",
            "asset_profile": "Business operating cash + personal checking",
            "liability_profile": "SBA term loan + business card",
            "investment_profile": "Reinvests in the business",
            "risk_profile": "aggressive",
            "primary_goals": [
                "Smooth irregular income",
                "Separate business & personal",
                "Plan for quarterly taxes",
            ],
            "expected_insights": [
                "Cash-flow runway",
                "Business vs personal commingling",
                "Tax set-aside recommendation",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "married_family",
            "display_name": "Married Family",
            "description": "Dual-income household with shared accounts, a mortgage, and family expenses.",
            "life_stage": "family",
            "financial_complexity": "moderate",
            "profession": "Dual income (teacher + engineer)",
            "family": "Married, 2 children",
            "income_type": "Two W-2 salaries",
            "spending_pattern": "Mortgage + childcare + groceries",
            "asset_profile": "Joint checking + 529/family savings",
            "liability_profile": "Mortgage + auto loan + card",
            "investment_profile": "College savings focus",
            "risk_profile": "moderate",
            "primary_goals": [
                "Coordinate joint finances",
                "Save for kids",
                "Pay down the mortgage",
            ],
            "expected_insights": [
                "Household cash-flow split",
                "College-savings pace",
                "Mortgage payoff scenarios",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "salary_plus_bonus",
            "display_name": "Salary + Bonus Professional",
            "description": "Base salary plus periodic bonuses; wants to make the most of lumpy bonus income.",
            "life_stage": "mid_career",
            "financial_complexity": "moderate",
            "profession": "Senior Manager",
            "family": "Married, no children",
            "income_type": "Salary + quarterly bonus",
            "spending_pattern": "Steady base spend; bonus windfalls",
            "asset_profile": "Brokerage + 401(k)",
            "liability_profile": "Low card balance",
            "investment_profile": "Growth-tilted, maxing tax-advantaged",
            "risk_profile": "aggressive",
            "primary_goals": [
                "Allocate bonuses well",
                "Max tax-advantaged accounts",
                "Invest consistently",
            ],
            "expected_insights": [
                "Bonus allocation plan",
                "Tax-advantaged headroom",
                "Lump-sum vs DCA",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "high_income_executive",
            "display_name": "High Income Executive",
            "description": "High earner with strong credit, large cash flow, and a complex balance sheet.",
            "life_stage": "peak_earning",
            "financial_complexity": "complex",
            "profession": "VP / Executive",
            "family": "Married, 2 children",
            "income_type": "High salary + equity",
            "spending_pattern": "High fixed + discretionary; low utilization",
            "asset_profile": "Money market + large brokerage + IRA",
            "liability_profile": "Jumbo mortgage, low revolving",
            "investment_profile": "Diversified, tax-aware",
            "risk_profile": "aggressive",
            "primary_goals": [
                "Optimize taxes",
                "Grow investments",
                "Build long-term wealth",
            ],
            "expected_insights": [
                "Tax optimization",
                "Asset-allocation drift",
                "Concentration risk",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "credit_rebuilding",
            "display_name": "Credit Rebuilding Profile",
            "description": "Working to rebuild credit and stabilize finances after a rough stretch.",
            "life_stage": "recovery",
            "financial_complexity": "moderate",
            "profession": "Hourly worker",
            "family": "Single parent",
            "income_type": "Hourly W-2 (thin margins)",
            "spending_pattern": "Fees, minimums, payday-loan payments",
            "asset_profile": "Very low checking, no savings",
            "liability_profile": "Secured card (high util) + collections",
            "investment_profile": "None yet",
            "risk_profile": "conservative",
            "primary_goals": [
                "Rebuild credit",
                "Reduce debt",
                "Establish an emergency fund",
            ],
            "expected_insights": [
                "Fee leakage",
                "Utilization reduction plan",
                "Debt-snowball ordering",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "gig_worker",
            "display_name": "Independent Consultant / Gig Worker",
            "description": "Independent worker with variable, multi-source income and solid credit.",
            "life_stage": "self_employed",
            "financial_complexity": "moderate",
            "profession": "Independent consultant",
            "family": "Single",
            "income_type": "1099 variable (multi-client)",
            "spending_pattern": "Business expenses + quarterly taxes",
            "asset_profile": "Checking + SEP-IRA",
            "liability_profile": "Business rewards card",
            "investment_profile": "Self-directed retirement",
            "risk_profile": "moderate",
            "primary_goals": [
                "Manage variable income",
                "Set aside taxes",
                "Build retirement savings",
            ],
            "expected_insights": [
                "Income volatility buffer",
                "Quarterly tax estimate",
                "SEP-IRA contribution room",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "earned_wage_access",
            "display_name": "Earned Wage Access Worker",
            "description": "Hourly worker who accesses earned wages between paychecks; cash-flow focused.",
            "life_stage": "hourly_worker",
            "financial_complexity": "simple",
            "profession": "Retail / hourly",
            "family": "Single",
            "income_type": "Hourly + earned-wage advances",
            "spending_pattern": "Frequent small spend; EWA fees",
            "asset_profile": "Very low balance, no savings",
            "liability_profile": "Starter card",
            "investment_profile": "None",
            "risk_profile": "conservative",
            "primary_goals": ["Stabilize cash flow", "Avoid fees", "Start saving"],
            "expected_insights": [
                "EWA-fee cost",
                "Paycheck-timing buffer",
                "First-savings nudge",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "bank_income",
            "display_name": "Bank Income Profile",
            "description": "Income verified directly from bank deposits — a clear deposit-driven picture.",
            "life_stage": "general",
            "financial_complexity": "moderate",
            "profession": "Salaried + side income",
            "family": "Single",
            "income_type": "Recurring direct deposits + side gig",
            "spending_pattern": "Rent + utilities + groceries",
            "asset_profile": "Checking + savings",
            "liability_profile": "Everyday card",
            "investment_profile": "Auto-save",
            "risk_profile": "moderate",
            "primary_goals": [
                "Understand income patterns",
                "Budget to deposits",
                "Build savings",
            ],
            "expected_insights": [
                "Income stability score",
                "Deposit-based budget",
                "Savings-rate trend",
            ],
            "plaid_config_source": "user_custom",
        }
    ),
    _persona(
        {
            "persona_id": "dynamic_transactions",
            "display_name": "Dynamic Transactions Profile",
            "description": "A rich, continuously-updating transaction history for exploring spending insights.",
            "life_stage": "general",
            "financial_complexity": "moderate",
            "profession": "General consumer",
            "family": "Single",
            "income_type": "Regular deposits",
            "spending_pattern": "High-volume, evolving transactions",
            "asset_profile": "Standard sandbox accounts",
            "liability_profile": "Standard sandbox liabilities",
            "investment_profile": "Standard sandbox",
            "risk_profile": "moderate",
            "primary_goals": [
                "Explore spending insights",
                "Find recurring costs",
                "Optimize a budget",
            ],
            "expected_insights": [
                "Recurring-cost detection",
                "Category trends",
                "Subscription audit",
            ],
            "plaid_config_source": "user_transactions_dynamic",
        }
    ),
]


# --- Persona holdings (mirror plaid-custom-configs.ts) -----------------------
FUND = {
    "VTI": {
        "name": "Vanguard Total Stock Market ETF",
        "price": 268,
        "asset_class": "us_equity",
        "sector": "Diversified Equity",
    },
    "VXUS": {
        "name": "Vanguard Total International Stock ETF",
        "price": 62,
        "asset_class": "intl_equity",
        "sector": "International Equity",
    },
    "BND": {
        "name": "Vanguard Total Bond Market ETF",
        "price": 72,
        "asset_class": "fixed_income",
        "sector": "Bonds",
    },
    "VFIFX": {
        "name": "Vanguard Target Retirement 2050 Fund",
        "price": 48,
        "asset_class": "target_date",
        "sector": "Target Date",
    },
}


def _js_round(x: float) -> float:
    """Match JS Math.round semantics: round half toward +Infinity."""
    return math.floor(x + 0.5)


def _holding(sym: str, value: float) -> dict:
    f = FUND[sym]
    return {
        "symbol": sym,
        "name": f["name"],
        "quantity": _js_round((value / f["price"]) * 1000) / 1000,
        "cost_basis": f["price"],  # == current price: no fabricated gains
        "current_price": f["price"],
        "current_value": _js_round(value * 100) / 100,
        "asset_class": f["asset_class"],
        "sector": f["sector"],
    }


def persona_holdings_for_account(subtype: str, starting_balance: float) -> list[dict]:
    """Derive representative holdings for a persona investment account from its
    balance + subtype. Retirement-style accounts → a single target-date fund;
    taxable/brokerage → a 60/25/15 stock/intl/bond split.
    """
    if not starting_balance or starting_balance <= 0:
        return []
    s = (subtype or "").lower()
    is_retirement = any(
        r in s for r in ["401k", "403b", "ira", "roth", "pension", "retirement"]
    )
    if is_retirement:
        return [_holding("VFIFX", starting_balance)]
    return [
        _holding("VTI", starting_balance * 0.6),
        _holding("VXUS", starting_balance * 0.25),
        _holding("BND", starting_balance * 0.15),
    ]


# --- Custom config builders (mirror plaid-custom-configs.ts) -----------------
def _D(mmdd: str) -> str:
    return f"2026-{mmdd}"


def _tx(date: str, amount: float, description: str) -> dict:
    return {
        "date_transacted": date,
        "date_posted": date,
        "amount": amount,
        "description": description,
        "currency": "USD",
    }


def _credit_liability(apr: float, min_pay: float, overdue: bool = False) -> dict:
    return {
        "type": "credit",
        "credit": {
            "aprs": [{"apr_percentage": apr, "apr_type": "purchase_apr"}],
            "is_overdue": overdue,
            "last_payment_amount": min_pay,
            "minimum_payment_amount": min_pay,
        },
    }


PLAID_CUSTOM_CONFIGS: dict[str, dict] = {
    "young_professional": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 3200,
                "meta": {"name": "Everyday Checking"},
                "transactions": [
                    _tx(_D("05-31"), -2150, "EMPLOYER PAYROLL"),
                    _tx(_D("05-15"), -2150, "EMPLOYER PAYROLL"),
                    _tx(_D("05-02"), 1300, "APT RENT"),
                    _tx(_D("05-06"), 92.4, "TRADER JOES"),
                    _tx(_D("05-09"), 15.99, "STREAMING SUB"),
                    _tx(_D("05-20"), 410, "STUDENT LOAN PMT"),
                ],
            },
            {
                "type": "depository",
                "subtype": "savings",
                "starting_balance": 4800,
                "meta": {"name": "Emergency Savings"},
                "transactions": [_tx(_D("05-16"), -300, "TRANSFER TO SAVINGS")],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 640,
                "meta": {"name": "Cash Rewards Card", "limit": 5000},
                "liability": _credit_liability(21.99, 35),
                "transactions": [_tx(_D("05-11"), 58.2, "GAS STATION")],
            },
            {
                "type": "loan",
                "subtype": "student",
                "starting_balance": 18400,
                "meta": {"name": "Student Loan"},
                "transactions": [],
            },
        ],
    },
    "small_business_owner": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 28400,
                "meta": {"name": "Business Operating"},
                "transactions": [
                    _tx(_D("05-28"), -8200, "CLIENT INVOICE 1042"),
                    _tx(_D("05-14"), -5400, "CLIENT INVOICE 1041"),
                    _tx(_D("05-30"), 6100, "PAYROLL RUN"),
                    _tx(_D("05-12"), 1850, "SUPPLIER AP"),
                    _tx(_D("05-21"), 480, "SOFTWARE SAAS"),
                ],
            },
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 5200,
                "meta": {"name": "Owner Personal Checking"},
                "transactions": [_tx(_D("05-25"), -3000, "OWNER DRAW")],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 6240,
                "meta": {"name": "Business Card", "limit": 25000},
                "liability": _credit_liability(18.49, 200),
                "transactions": [_tx(_D("05-18"), 920, "OFFICE SUPPLY")],
            },
            {
                "type": "loan",
                "subtype": "business",
                "starting_balance": 64000,
                "meta": {"name": "SBA Term Loan"},
                "transactions": [],
            },
        ],
    },
    "married_family": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 9400,
                "meta": {"name": "Joint Checking"},
                "transactions": [
                    _tx(_D("05-31"), -3100, "SPOUSE A PAYROLL"),
                    _tx(_D("05-31"), -2700, "SPOUSE B PAYROLL"),
                    _tx(_D("05-03"), 2350, "MORTGAGE PMT"),
                    _tx(_D("05-07"), 240, "CHILDCARE"),
                    _tx(_D("05-10"), 318, "COSTCO"),
                ],
            },
            {
                "type": "depository",
                "subtype": "savings",
                "starting_balance": 22000,
                "meta": {"name": "529 / Family Savings"},
                "transactions": [_tx(_D("05-16"), -500, "COLLEGE SAVINGS")],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 2840,
                "meta": {"name": "Family Rewards Card", "limit": 18000},
                "liability": _credit_liability(20.24, 90),
                "transactions": [_tx(_D("05-13"), 142, "GROCERY")],
            },
            {
                "type": "loan",
                "subtype": "mortgage",
                "starting_balance": 384000,
                "meta": {"name": "Home Mortgage"},
                "transactions": [],
            },
            {
                "type": "loan",
                "subtype": "auto",
                "starting_balance": 21500,
                "meta": {"name": "Auto Loan"},
                "transactions": [],
            },
        ],
    },
    "salary_plus_bonus": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 14200,
                "meta": {"name": "Primary Checking"},
                "transactions": [
                    _tx(_D("05-31"), -4200, "BASE SALARY"),
                    _tx(_D("05-15"), -4200, "BASE SALARY"),
                    _tx(_D("05-20"), -12000, "Q2 BONUS"),
                    _tx(_D("05-05"), 1900, "RENT"),
                ],
            },
            {
                "type": "investment",
                "subtype": "brokerage",
                "starting_balance": 86000,
                "meta": {"name": "Taxable Brokerage"},
                "transactions": [],
            },
            {
                "type": "investment",
                "subtype": "401k",
                "starting_balance": 142000,
                "meta": {"name": "401(k)"},
                "transactions": [],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 1820,
                "meta": {"name": "Travel Card", "limit": 20000},
                "liability": _credit_liability(19.99, 60),
                "transactions": [_tx(_D("05-09"), 410, "AIRLINE")],
            },
        ],
    },
    "high_income_executive": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 58200,
                "meta": {"name": "Executive Checking"},
                "transactions": [
                    _tx(_D("05-31"), -11800, "EXEC SALARY"),
                    _tx(_D("05-15"), -11800, "EXEC SALARY"),
                    _tx(_D("05-04"), 4800, "PROPERTY MGMT"),
                ],
            },
            {
                "type": "depository",
                "subtype": "money market",
                "starting_balance": 145000,
                "meta": {"name": "Money Market"},
                "transactions": [],
            },
            {
                "type": "investment",
                "subtype": "brokerage",
                "starting_balance": 920000,
                "meta": {"name": "Investment Portfolio"},
                "transactions": [],
            },
            {
                "type": "investment",
                "subtype": "ira",
                "starting_balance": 410000,
                "meta": {"name": "Backdoor Roth IRA"},
                "transactions": [],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 3120,
                "meta": {"name": "Signature Card", "limit": 75000},
                "liability": _credit_liability(17.99, 200),
                "transactions": [_tx(_D("05-12"), 980, "FINE DINING")],
            },
            {
                "type": "loan",
                "subtype": "mortgage",
                "starting_balance": 1240000,
                "meta": {"name": "Jumbo Mortgage"},
                "transactions": [],
            },
        ],
    },
    "credit_rebuilding": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 420,
                "meta": {"name": "Basic Checking"},
                "transactions": [
                    _tx(_D("05-30"), -1480, "HOURLY PAYROLL"),
                    _tx(_D("05-16"), -1480, "HOURLY PAYROLL"),
                    _tx(_D("05-06"), 35, "OVERDRAFT FEE"),
                    _tx(_D("05-09"), 95, "PAYDAY LOAN PMT"),
                ],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 920,
                "meta": {"name": "Secured Card", "limit": 1000},
                "liability": _credit_liability(27.99, 41, True),
                "transactions": [_tx(_D("05-14"), 60, "PHONE BILL")],
            },
            {
                # Plaid sandbox override rejects loan subtype 'personal' (INVALID_
                # CREDENTIALS) — 'consumer' is the valid subtype for a personal loan.
                "type": "loan",
                "subtype": "consumer",
                "starting_balance": 5200,
                "meta": {"name": "Personal Loan (collections)"},
                "transactions": [],
            },
        ],
    },
    "gig_worker": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 6100,
                "meta": {"name": "1099 Checking"},
                "transactions": [
                    _tx(_D("05-29"), -2200, "CLIENT A DEPOSIT"),
                    _tx(_D("05-19"), -1400, "CLIENT B DEPOSIT"),
                    _tx(_D("05-09"), -800, "PLATFORM PAYOUT"),
                    _tx(_D("05-21"), 1200, "EST QUARTERLY TAX"),
                    _tx(_D("05-11"), 240, "HOME OFFICE"),
                ],
            },
            {
                "type": "investment",
                "subtype": "ira",
                "starting_balance": 38000,
                "meta": {"name": "SEP-IRA"},
                "transactions": [],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 1340,
                "meta": {"name": "Business Rewards", "limit": 12000},
                "liability": _credit_liability(22.49, 45),
                "transactions": [_tx(_D("05-15"), 180, "CLOUD HOSTING")],
            },
        ],
    },
    "earned_wage_access": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 180,
                "meta": {"name": "Spending Checking"},
                "transactions": [
                    _tx(_D("05-31"), -760, "BIWEEKLY PAYROLL"),
                    _tx(_D("05-26"), -120, "EWA ADVANCE"),
                    _tx(_D("05-22"), -90, "EWA ADVANCE"),
                    _tx(_D("05-17"), -110, "EWA ADVANCE"),
                    _tx(_D("05-08"), 38, "EWA FEE"),
                    _tx(_D("05-10"), 64, "CONVENIENCE STORE"),
                ],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 410,
                "meta": {"name": "Starter Card", "limit": 750},
                "liability": _credit_liability(26.99, 30),
                "transactions": [_tx(_D("05-13"), 28, "FAST FOOD")],
            },
        ],
    },
    "bank_income": {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "starting_balance": 7600,
                "meta": {"name": "Primary Deposit Account"},
                "transactions": [
                    _tx(_D("05-31"), -2480, "ACME CORP DIRECT DEP"),
                    _tx(_D("05-15"), -2480, "ACME CORP DIRECT DEP"),
                    _tx(_D("05-30"), -300, "SIDE GIG DEPOSIT"),
                    _tx(_D("05-05"), 1500, "RENT"),
                    _tx(_D("05-12"), 220, "UTILITIES"),
                ],
            },
            {
                "type": "depository",
                "subtype": "savings",
                "starting_balance": 9100,
                "meta": {"name": "Savings"},
                "transactions": [_tx(_D("05-16"), -400, "AUTO SAVE")],
            },
            {
                "type": "credit",
                "subtype": "credit card",
                "starting_balance": 1180,
                "meta": {"name": "Everyday Card", "limit": 9000},
                "liability": _credit_liability(20.99, 40),
                "transactions": [_tx(_D("05-10"), 76, "GROCERY")],
            },
        ],
    },
    # dynamic_transactions intentionally has NO custom config — it uses the
    # documented `user_transactions_dynamic` sandbox user (rich evolving txns).
}


# --- Helper functions (mirror personas.ts exported fns) ----------------------
def to_public_persona(p: dict) -> dict:
    """Port of toPublicPersona — shape sent to the browser (no credentials)."""
    return {
        "persona_id": p["persona_id"],
        "display_name": p["display_name"],
        "description": p["description"],
        "goals": p["primary_goals"],
        "complexity": p["financial_complexity"],
        "life_stage": p["life_stage"],
        "profession": p["profession"],
        "risk_profile": p["risk_profile"],
        "income_type": p["income_type"],
        "asset_profile": p["asset_profile"],
        "liability_profile": p["liability_profile"],
        "investment_profile": p["investment_profile"],
    }


def list_public_personas() -> list[dict]:
    return [to_public_persona(p) for p in PLAID_PERSONAS]


def get_persona(persona_id: str) -> Optional[dict]:
    for p in PLAID_PERSONAS:
        if p["persona_id"] == persona_id:
            return p
    return None


def is_valid_persona_id(persona_id) -> bool:
    return isinstance(persona_id, str) and any(
        p["persona_id"] == persona_id for p in PLAID_PERSONAS
    )


def get_plaid_activation(p: dict) -> dict:
    """Server-side Plaid activation inputs for a persona (custom config or
    documented user). Port of getPlaidActivation.
    """
    custom_config = (
        PLAID_CUSTOM_CONFIGS.get(p["persona_id"])
        if p["plaid_config_source"] == "user_custom"
        else None
    )
    return {
        "username": p["plaid_sandbox_user"],
        "password": p["plaid_sandbox_password"],
        "custom_config": custom_config,
    }


def persona_metadata(p: dict) -> dict:
    """Persona metadata persisted to Supabase + promoted to the graph.
    Port of personaMetadata.
    """
    return {
        "persona_id": p["persona_id"],
        "display_name": p["display_name"],
        "life_stage": p["life_stage"],
        "profession": p["profession"],
        "family": p["family"],
        "income_type": p["income_type"],
        "spending_pattern": p["spending_pattern"],
        "asset_profile": p["asset_profile"],
        "liability_profile": p["liability_profile"],
        "investment_profile": p["investment_profile"],
        "risk_profile": p["risk_profile"],
        "primary_goals": p["primary_goals"],
        "expected_insights": p["expected_insights"],
        "financial_complexity": p["financial_complexity"],
        "config_source": p["plaid_config_source"],
    }
