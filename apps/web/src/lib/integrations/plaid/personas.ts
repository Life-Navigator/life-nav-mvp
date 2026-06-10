import 'server-only';
import { PLAID_CUSTOM_CONFIGS, type PlaidCustomConfig } from './plaid-custom-configs';

/**
 * Plaid Sandbox Persona Registry — SERVER ONLY.
 *
 * Beta users pick a friendly "sample financial profile." Each persona carries
 * rich LifeNavigator metadata (profession, income/spending/asset/liability/
 * investment/risk profiles, goals, expected insights) AND a Plaid sandbox data
 * source. Most use a distinct `user_custom` config (see plaid-custom-configs.ts)
 * so the synthetic accounts/balances/cash-flow differ materially; the rest use a
 * documented sandbox user. `import 'server-only'` makes the build fail if a
 * Client Component imports this module.
 */

export type ConfigSource = 'user_custom' | 'user_transactions_dynamic' | 'user_good';

export interface PlaidPersona {
  persona_id: string;
  display_name: string;
  description: string;
  life_stage: string;
  financial_complexity: 'simple' | 'moderate' | 'complex';
  // --- LifeNavigator persona metadata (drives dashboard + recommendations) ---
  profession: string;
  family: string;
  income_type: string;
  spending_pattern: string;
  asset_profile: string;
  liability_profile: string;
  investment_profile: string;
  risk_profile: 'conservative' | 'moderate' | 'aggressive';
  primary_goals: string[];
  expected_insights: string[];
  // --- Plaid sandbox wiring (never serialized to the client) ---
  plaid_config_source: ConfigSource;
  plaid_sandbox_user: string;
  plaid_sandbox_password: string;
  plaid_products: string[];
  institution_id: string;
}

/** Shape sent to the browser — no credentials, no Plaid wiring. */
export interface PublicPersona {
  persona_id: string;
  display_name: string;
  description: string;
  goals: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  life_stage: string;
  profession: string;
  risk_profile: string;
  income_type: string;
  asset_profile: string;
  liability_profile: string;
  investment_profile: string;
}

const INST = 'ins_109508'; // First Platypus Bank (sandbox)
const PASS = 'pass_good';

function persona(
  p: Omit<
    PlaidPersona,
    'plaid_sandbox_user' | 'plaid_sandbox_password' | 'plaid_products' | 'institution_id'
  > &
    Partial<Pick<PlaidPersona, 'plaid_sandbox_user' | 'plaid_products' | 'institution_id'>>
): PlaidPersona {
  // user_custom is the username when a custom config exists; otherwise the
  // documented sandbox user named in plaid_config_source.
  const user =
    p.plaid_config_source === 'user_custom'
      ? 'user_custom'
      : p.plaid_config_source === 'user_transactions_dynamic'
        ? 'user_transactions_dynamic'
        : 'user_good';
  return {
    plaid_sandbox_user: user,
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: INST,
    ...p,
  };
}

export const PLAID_PERSONAS: readonly PlaidPersona[] = [
  persona({
    persona_id: 'young_professional',
    display_name: 'Young Professional',
    description: 'Early-career, steady paycheck, building savings and starting to invest.',
    life_stage: 'early_career',
    financial_complexity: 'simple',
    profession: 'Software Analyst',
    family: 'Single, no dependents',
    income_type: 'W-2 salary (biweekly)',
    spending_pattern: 'Rent + subscriptions + dining; modest discretionary',
    asset_profile: 'Small checking + starter emergency fund',
    liability_profile: 'Student loan + low credit-card balance',
    investment_profile: 'Just getting started',
    risk_profile: 'moderate',
    primary_goals: ['Build an emergency fund', 'Start investing', 'Pay down student debt'],
    expected_insights: [
      'Emergency-fund target gap',
      'Automate investing',
      'Student-loan payoff timeline',
    ],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'small_business_owner',
    display_name: 'Small Business Owner',
    description:
      'Runs a small business with irregular income and mixed personal/business cash flow.',
    life_stage: 'business_owner',
    financial_complexity: 'complex',
    profession: 'Owner, services LLC',
    family: 'Married, 1 child',
    income_type: 'Business revenue (irregular) + owner draws',
    spending_pattern: 'Lumpy vendor + payroll outflows',
    asset_profile: 'Business operating cash + personal checking',
    liability_profile: 'SBA term loan + business card',
    investment_profile: 'Reinvests in the business',
    risk_profile: 'aggressive',
    primary_goals: [
      'Smooth irregular income',
      'Separate business & personal',
      'Plan for quarterly taxes',
    ],
    expected_insights: [
      'Cash-flow runway',
      'Business vs personal commingling',
      'Tax set-aside recommendation',
    ],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'married_family',
    display_name: 'Married Family',
    description: 'Dual-income household with shared accounts, a mortgage, and family expenses.',
    life_stage: 'family',
    financial_complexity: 'moderate',
    profession: 'Dual income (teacher + engineer)',
    family: 'Married, 2 children',
    income_type: 'Two W-2 salaries',
    spending_pattern: 'Mortgage + childcare + groceries',
    asset_profile: 'Joint checking + 529/family savings',
    liability_profile: 'Mortgage + auto loan + card',
    investment_profile: 'College savings focus',
    risk_profile: 'moderate',
    primary_goals: ['Coordinate joint finances', 'Save for kids', 'Pay down the mortgage'],
    expected_insights: [
      'Household cash-flow split',
      'College-savings pace',
      'Mortgage payoff scenarios',
    ],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'salary_plus_bonus',
    display_name: 'Salary + Bonus Professional',
    description: 'Base salary plus periodic bonuses; wants to make the most of lumpy bonus income.',
    life_stage: 'mid_career',
    financial_complexity: 'moderate',
    profession: 'Senior Manager',
    family: 'Married, no children',
    income_type: 'Salary + quarterly bonus',
    spending_pattern: 'Steady base spend; bonus windfalls',
    asset_profile: 'Brokerage + 401(k)',
    liability_profile: 'Low card balance',
    investment_profile: 'Growth-tilted, maxing tax-advantaged',
    risk_profile: 'aggressive',
    primary_goals: ['Allocate bonuses well', 'Max tax-advantaged accounts', 'Invest consistently'],
    expected_insights: ['Bonus allocation plan', 'Tax-advantaged headroom', 'Lump-sum vs DCA'],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'high_income_executive',
    display_name: 'High Income Executive',
    description: 'High earner with strong credit, large cash flow, and a complex balance sheet.',
    life_stage: 'peak_earning',
    financial_complexity: 'complex',
    profession: 'VP / Executive',
    family: 'Married, 2 children',
    income_type: 'High salary + equity',
    spending_pattern: 'High fixed + discretionary; low utilization',
    asset_profile: 'Money market + large brokerage + IRA',
    liability_profile: 'Jumbo mortgage, low revolving',
    investment_profile: 'Diversified, tax-aware',
    risk_profile: 'aggressive',
    primary_goals: ['Optimize taxes', 'Grow investments', 'Build long-term wealth'],
    expected_insights: ['Tax optimization', 'Asset-allocation drift', 'Concentration risk'],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'credit_rebuilding',
    display_name: 'Credit Rebuilding Profile',
    description: 'Working to rebuild credit and stabilize finances after a rough stretch.',
    life_stage: 'recovery',
    financial_complexity: 'moderate',
    profession: 'Hourly worker',
    family: 'Single parent',
    income_type: 'Hourly W-2 (thin margins)',
    spending_pattern: 'Fees, minimums, payday-loan payments',
    asset_profile: 'Very low checking, no savings',
    liability_profile: 'Secured card (high util) + collections',
    investment_profile: 'None yet',
    risk_profile: 'conservative',
    primary_goals: ['Rebuild credit', 'Reduce debt', 'Establish an emergency fund'],
    expected_insights: ['Fee leakage', 'Utilization reduction plan', 'Debt-snowball ordering'],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'gig_worker',
    display_name: 'Independent Consultant / Gig Worker',
    description: 'Independent worker with variable, multi-source income and solid credit.',
    life_stage: 'self_employed',
    financial_complexity: 'moderate',
    profession: 'Independent consultant',
    family: 'Single',
    income_type: '1099 variable (multi-client)',
    spending_pattern: 'Business expenses + quarterly taxes',
    asset_profile: 'Checking + SEP-IRA',
    liability_profile: 'Business rewards card',
    investment_profile: 'Self-directed retirement',
    risk_profile: 'moderate',
    primary_goals: ['Manage variable income', 'Set aside taxes', 'Build retirement savings'],
    expected_insights: [
      'Income volatility buffer',
      'Quarterly tax estimate',
      'SEP-IRA contribution room',
    ],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'earned_wage_access',
    display_name: 'Earned Wage Access Worker',
    description: 'Hourly worker who accesses earned wages between paychecks; cash-flow focused.',
    life_stage: 'hourly_worker',
    financial_complexity: 'simple',
    profession: 'Retail / hourly',
    family: 'Single',
    income_type: 'Hourly + earned-wage advances',
    spending_pattern: 'Frequent small spend; EWA fees',
    asset_profile: 'Very low balance, no savings',
    liability_profile: 'Starter card',
    investment_profile: 'None',
    risk_profile: 'conservative',
    primary_goals: ['Stabilize cash flow', 'Avoid fees', 'Start saving'],
    expected_insights: ['EWA-fee cost', 'Paycheck-timing buffer', 'First-savings nudge'],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'bank_income',
    display_name: 'Bank Income Profile',
    description: 'Income verified directly from bank deposits — a clear deposit-driven picture.',
    life_stage: 'general',
    financial_complexity: 'moderate',
    profession: 'Salaried + side income',
    family: 'Single',
    income_type: 'Recurring direct deposits + side gig',
    spending_pattern: 'Rent + utilities + groceries',
    asset_profile: 'Checking + savings',
    liability_profile: 'Everyday card',
    investment_profile: 'Auto-save',
    risk_profile: 'moderate',
    primary_goals: ['Understand income patterns', 'Budget to deposits', 'Build savings'],
    expected_insights: ['Income stability score', 'Deposit-based budget', 'Savings-rate trend'],
    plaid_config_source: 'user_custom',
  }),
  persona({
    persona_id: 'dynamic_transactions',
    display_name: 'Dynamic Transactions Profile',
    description:
      'A rich, continuously-updating transaction history for exploring spending insights.',
    life_stage: 'general',
    financial_complexity: 'moderate',
    profession: 'General consumer',
    family: 'Single',
    income_type: 'Regular deposits',
    spending_pattern: 'High-volume, evolving transactions',
    asset_profile: 'Standard sandbox accounts',
    liability_profile: 'Standard sandbox liabilities',
    investment_profile: 'Standard sandbox',
    risk_profile: 'moderate',
    primary_goals: ['Explore spending insights', 'Find recurring costs', 'Optimize a budget'],
    expected_insights: ['Recurring-cost detection', 'Category trends', 'Subscription audit'],
    plaid_config_source: 'user_transactions_dynamic',
  }),
] as const;

export function toPublicPersona(p: PlaidPersona): PublicPersona {
  return {
    persona_id: p.persona_id,
    display_name: p.display_name,
    description: p.description,
    goals: p.primary_goals,
    complexity: p.financial_complexity,
    life_stage: p.life_stage,
    profession: p.profession,
    risk_profile: p.risk_profile,
    income_type: p.income_type,
    asset_profile: p.asset_profile,
    liability_profile: p.liability_profile,
    investment_profile: p.investment_profile,
  };
}

export function listPublicPersonas(): PublicPersona[] {
  return PLAID_PERSONAS.map(toPublicPersona);
}

export function getPersona(personaId: string): PlaidPersona | null {
  return PLAID_PERSONAS.find((p) => p.persona_id === personaId) ?? null;
}

export function isValidPersonaId(personaId: unknown): personaId is string {
  return typeof personaId === 'string' && PLAID_PERSONAS.some((p) => p.persona_id === personaId);
}

/** Server-side Plaid activation inputs for a persona (custom config or documented user). */
export function getPlaidActivation(p: PlaidPersona): {
  username: string;
  password: string;
  customConfig: PlaidCustomConfig | null;
} {
  const customConfig =
    p.plaid_config_source === 'user_custom' ? (PLAID_CUSTOM_CONFIGS[p.persona_id] ?? null) : null;
  return { username: p.plaid_sandbox_user, password: p.plaid_sandbox_password, customConfig };
}

/** Persona metadata persisted to Supabase + promoted to the graph. */
export function personaMetadata(p: PlaidPersona): Record<string, unknown> {
  return {
    persona_id: p.persona_id,
    display_name: p.display_name,
    life_stage: p.life_stage,
    profession: p.profession,
    family: p.family,
    income_type: p.income_type,
    spending_pattern: p.spending_pattern,
    asset_profile: p.asset_profile,
    liability_profile: p.liability_profile,
    investment_profile: p.investment_profile,
    risk_profile: p.risk_profile,
    primary_goals: p.primary_goals,
    expected_insights: p.expected_insights,
    financial_complexity: p.financial_complexity,
    config_source: p.plaid_config_source,
  };
}
