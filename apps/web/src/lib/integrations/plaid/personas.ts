import 'server-only';

/**
 * Plaid Sandbox Persona Registry — SERVER ONLY.
 *
 * Beta users pick a friendly "sample financial profile" from a dropdown. The
 * Plaid sandbox usernames/passwords below NEVER leave the server: routes return
 * only `toPublicPersona()` output. The `import 'server-only'` above makes the
 * build fail if a Client Component ever imports this module.
 *
 * The sandbox username controls which synthetic dataset Plaid generates. Where
 * Plaid documents a specific username (bank income, dynamic transactions) we use
 * it; the rest use the universal `user_good`, and `plaid_profile_label` records
 * the intended Plaid profile so the exact `override_username` can be tuned here
 * later without touching any other code. `pass_good` is Plaid's universal
 * sandbox password.
 */

export interface PlaidPersona {
  persona_id: string;
  display_name: string;
  description: string;
  life_stage: string;
  financial_complexity: 'simple' | 'moderate' | 'complex';
  expected_goals: string[];
  // --- server-only secrets / Plaid wiring (never serialized to the client) ---
  plaid_profile_label: string; // the Plaid sandbox profile this maps to
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
}

const DEFAULT_INSTITUTION = 'ins_109508'; // First Platypus Bank (sandbox)
const PASS = 'pass_good'; // universal Plaid sandbox password

export const PLAID_PERSONAS: readonly PlaidPersona[] = [
  {
    persona_id: 'young_professional',
    display_name: 'Young Professional',
    description:
      'Early-career, steady paycheck, building savings and starting to invest. Keeps things simple.',
    life_stage: 'early_career',
    financial_complexity: 'simple',
    expected_goals: ['Build an emergency fund', 'Start investing', 'Pay down student debt'],
    plaid_profile_label: 'Yuppie',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'small_business_owner',
    display_name: 'Small Business Owner',
    description:
      'Runs a small business with mixed personal and business cash flow and irregular income.',
    life_stage: 'business_owner',
    financial_complexity: 'complex',
    expected_goals: ['Smooth irregular income', 'Separate business & personal', 'Plan for taxes'],
    plaid_profile_label: 'Small Business',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'married_family',
    display_name: 'Married Family',
    description:
      'Dual-income household with shared accounts, a mortgage, and family expenses to coordinate.',
    life_stage: 'family',
    financial_complexity: 'moderate',
    expected_goals: ['Coordinate joint finances', 'Save for kids', 'Pay down the mortgage'],
    plaid_profile_label: 'Joint Account',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'high_income_executive',
    display_name: 'High Income Executive',
    description:
      'High earner with strong credit, significant cash flow, and a more complex balance sheet.',
    life_stage: 'peak_earning',
    financial_complexity: 'complex',
    expected_goals: ['Optimize taxes', 'Grow investments', 'Build long-term wealth'],
    plaid_profile_label: 'Excellent Credit Profile',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'credit_rebuilding',
    display_name: 'Credit Rebuilding Profile',
    description:
      'Working to rebuild credit and stabilize finances after a rough stretch. Needs a clear plan.',
    life_stage: 'recovery',
    financial_complexity: 'moderate',
    expected_goals: ['Rebuild credit', 'Reduce debt', 'Establish an emergency fund'],
    plaid_profile_label: 'Poor Credit Profile',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'gig_worker',
    display_name: 'Gig Worker / Consultant',
    description:
      'Independent worker with variable, multi-source income and solid credit. Plans around uneven cash flow.',
    life_stage: 'self_employed',
    financial_complexity: 'moderate',
    expected_goals: ['Manage variable income', 'Set aside taxes', 'Build retirement savings'],
    plaid_profile_label: 'Good Credit Profile',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'salary_plus_bonus',
    display_name: 'Salary + Bonus Professional',
    description: 'Base salary plus periodic bonuses. Wants to make the most of lumpy bonus income.',
    life_stage: 'mid_career',
    financial_complexity: 'moderate',
    expected_goals: ['Allocate bonuses well', 'Max tax-advantaged accounts', 'Invest consistently'],
    plaid_profile_label: 'Salary with Bonuses',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'earned_wage_access',
    display_name: 'Earned Wage Access Worker',
    description:
      'Hourly worker who accesses earned wages between paychecks. Focused on cash-flow stability.',
    life_stage: 'hourly_worker',
    financial_complexity: 'simple',
    expected_goals: ['Stabilize cash flow', 'Avoid fees', 'Start saving'],
    plaid_profile_label: 'Earned Wage Access',
    plaid_sandbox_user: 'user_good',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'bank_income',
    display_name: 'Bank Income Profile',
    description:
      'Income verified directly from bank deposits — a clear, deposit-driven financial picture.',
    life_stage: 'general',
    financial_complexity: 'moderate',
    expected_goals: ['Understand income patterns', 'Budget to deposits', 'Build savings'],
    plaid_profile_label: 'Bank Income',
    plaid_sandbox_user: 'user_bank_income',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
  {
    persona_id: 'dynamic_transactions',
    display_name: 'Dynamic Transactions Profile',
    description:
      'A rich, continuously-updating transaction history — great for exploring spending insights.',
    life_stage: 'general',
    financial_complexity: 'moderate',
    expected_goals: ['Explore spending insights', 'Find recurring costs', 'Optimize a budget'],
    plaid_profile_label: 'Dynamic Transactions',
    plaid_sandbox_user: 'user_transactions_dynamic',
    plaid_sandbox_password: PASS,
    plaid_products: ['transactions'],
    institution_id: DEFAULT_INSTITUTION,
  },
] as const;

/** Strip all server-only fields → the only shape the browser ever receives. */
export function toPublicPersona(p: PlaidPersona): PublicPersona {
  return {
    persona_id: p.persona_id,
    display_name: p.display_name,
    description: p.description,
    goals: p.expected_goals,
    complexity: p.financial_complexity,
    life_stage: p.life_stage,
  };
}

export function listPublicPersonas(): PublicPersona[] {
  return PLAID_PERSONAS.map(toPublicPersona);
}

/** Server-side lookup including credentials. Returns null for unknown ids. */
export function getPersona(personaId: string): PlaidPersona | null {
  return PLAID_PERSONAS.find((p) => p.persona_id === personaId) ?? null;
}

export function isValidPersonaId(personaId: unknown): personaId is string {
  return typeof personaId === 'string' && PLAID_PERSONAS.some((p) => p.persona_id === personaId);
}
