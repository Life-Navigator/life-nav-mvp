/**
 * Recommendation Quality Remediation — per-persona verification.
 *
 * Maps each persona's PLAID_CUSTOM_CONFIGS dataset into the exact
 * finance.financial_accounts / finance.transactions rows persist.ts writes
 * (APR sourced from the persona config, mirroring the FIXED activate-persona
 * route), feeds them to the REAL getRecommendations engine, and asserts the
 * sprint's quality contract for all 10 personas.
 */
import {
  getRecommendations,
  findProhibitedLanguage,
  type Recommendation,
} from '../recommendations';
import { PLAID_CUSTOM_CONFIGS } from '@/lib/integrations/plaid/plaid-custom-configs';
import { getPersona } from '@/lib/integrations/plaid/personas';
import { mapAccountType } from '@/lib/integrations/plaid/persist';

function rowsFor(personaId: string) {
  const cfg = PLAID_CUSTOM_CONFIGS[personaId];
  const accounts = cfg.override_accounts.map((a) => {
    // FIXED activate-persona: intended APR comes from the persona CONFIG (not the
    // sandbox default), persisted as a decimal on financial_accounts.interest_rate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aprPct = (a as any).liability?.credit?.aprs?.[0]?.apr_percentage;
    return {
      account_type: mapAccountType(a.type, a.subtype),
      current_balance: a.starting_balance,
      available_balance: a.starting_balance,
      credit_limit: a.meta.limit ?? null,
      interest_rate: typeof aprPct === 'number' ? aprPct / 100 : null,
    };
  });
  const transactions = cfg.override_accounts.flatMap((a) =>
    a.transactions.map((t) => ({
      amount: Math.abs(t.amount),
      transaction_type: t.amount >= 0 ? 'expense' : 'income',
      transaction_date: t.date_posted,
    }))
  );
  return { accounts, transactions };
}

function mockSvcFrom(
  accounts: unknown[],
  transactions: unknown[],
  personaRow: Record<string, unknown> | null
) {
  const financeData: Record<string, unknown[]> = {
    financial_accounts: accounts,
    transactions,
  };
  return {
    schema: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => Promise.resolve({ data: financeData[table] ?? [], error: null }),
        }),
      }),
    }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: personaRow, error: null }) }),
      }),
    }),
  };
}

function mockSvc(personaId: string) {
  const { accounts, transactions } = rowsFor(personaId);
  const p = getPersona(personaId)!;
  return mockSvcFrom(accounts, transactions, {
    persona_id: p.persona_id,
    display_name: p.display_name,
    income_type: p.income_type,
    risk_profile: p.risk_profile,
    life_stage: p.life_stage,
    primary_goals: p.primary_goals,
  });
}

const PERSONA_IDS = Object.keys(PLAID_CUSTOM_CONFIGS);
const FRAGILE = ['credit_rebuilding', 'earned_wage_access'];
const SELF_EMPLOYED = ['gig_worker', 'small_business_owner'];
const BONUS = ['salary_plus_bonus', 'high_income_executive'];

const text = (r: Recommendation) => `${r.title} ${r.detail} ${r.action}`.toLowerCase();
const INVEST_CASH = /brokerage|taxable account|idle cash|invested account|put .* to work/i;

async function setFor(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getRecommendations(mockSvc(id) as any, 'user-1');
}

describe('Recommendation engine — per-persona quality contract', () => {
  it('emits >=3 distinct recommendations with all three categories for every persona', async () => {
    const table: string[] = [];
    for (const id of PERSONA_IDS) {
      const set = await setFor(id);
      expect(set.has_data).toBe(true);
      expect(set.recommendations.length).toBeGreaterThanOrEqual(3);

      const titles = new Set(set.recommendations.map((r) => r.title));
      expect(titles.size).toBe(set.recommendations.length); // all distinct

      const cats = new Set(set.recommendations.map((r) => r.category));
      expect(cats.has('immediate_action')).toBe(true);
      expect(cats.has('risk_reduction')).toBe(true);
      expect(cats.has('growth_opportunity')).toBe(true);

      table.push(
        `• ${id.padEnd(22)} ${set.recommendations.map((r) => `[${r.category[0]}] ${r.title}`).join('  |  ')}`
      );
    }
    // eslint-disable-next-line no-console
    console.log('\n=== Recommendations per persona ===\n' + table.join('\n'));
  });

  it('compliance language scan passes for every recommendation', async () => {
    for (const id of PERSONA_IDS) {
      const set = await setFor(id);
      for (const r of set.recommendations) {
        const hit = findProhibitedLanguage(`${r.title} ${r.detail} ${r.action}`);
        expect(hit).toBeNull();
      }
    }
  });

  it('fragile personas get stabilization first and NO tone-deaf invest-your-cash rec', async () => {
    for (const id of FRAGILE) {
      const set = await setFor(id);
      const top = set.recommendations[0];
      expect(top.category).toBe('immediate_action');
      expect(top.title.toLowerCase()).toMatch(/cash flow|steady|stabil|buffer/);
      // No rec should tell a paycheck-to-paycheck user to invest their cash.
      for (const r of set.recommendations) {
        expect(text(r)).not.toMatch(INVEST_CASH);
      }
    }
  });

  it('self-employed personas receive a tax set-aside (a 25–30% range, not a promise)', async () => {
    for (const id of SELF_EMPLOYED) {
      const set = await setFor(id);
      const tax = set.recommendations.find((r) => r.theme === 'tax');
      expect(tax).toBeTruthy();
      expect(`${tax!.title} ${tax!.detail}`).toMatch(/25–30%|25-30%|set aside|set-aside/i);
    }
  });

  it('bonus-eligible personas receive bonus/equity allocation guidance', async () => {
    for (const id of BONUS) {
      const set = await setFor(id);
      const bonus = set.recommendations.find(
        (r) => r.theme === 'bonus' || /bonus|equity|vest|windfall/i.test(text(r))
      );
      expect(bonus).toBeTruthy();
    }
  });

  it('APR persistence: high-rate cards surface their REAL APR (~27–28%), not the ~13% sandbox default', async () => {
    const cr = await setFor('credit_rebuilding');
    const crDebt = cr.recommendations.find((r) => r.theme === 'debt');
    expect(crDebt).toBeTruthy();
    expect(crDebt!.metric).toMatch(/28% APR/);

    const ewa = await setFor('earned_wage_access');
    const ewaDebt = ewa.recommendations.find((r) => r.theme === 'debt');
    expect(ewaDebt).toBeTruthy();
    expect(ewaDebt!.metric).toMatch(/27% APR/);
  });

  it('no persona surfaces an "ask your advisor" deflection as its primary recommendation', async () => {
    for (const id of PERSONA_IDS) {
      const set = await setFor(id);
      expect(set.recommendations[0].action.toLowerCase()).not.toMatch(/^ask your advisor/);
      expect(set.recommendations[0].title.toLowerCase()).not.toMatch(/^ask your advisor/);
    }
  });
});

describe('Recommendation engine — debt-before-invest sequencing', () => {
  // Synthetic, non-fragile profile carrying a high-interest REVOLVING balance.
  const accounts = [
    {
      account_type: 'checking',
      current_balance: 5000,
      available_balance: 5000,
      credit_limit: null,
      interest_rate: null,
    },
    {
      account_type: 'investment',
      current_balance: 12000,
      available_balance: 12000,
      credit_limit: null,
      interest_rate: null,
    },
    {
      account_type: 'credit_card',
      current_balance: 8000,
      available_balance: 0,
      credit_limit: 10000,
      interest_rate: 0.24,
    },
  ];
  const transactions = [
    { amount: 4000, transaction_type: 'income', transaction_date: '2026-05-15' },
    { amount: 4000, transaction_type: 'income', transaction_date: '2026-05-31' },
    { amount: 2500, transaction_type: 'expense', transaction_date: '2026-05-05' },
  ];
  const personaRow = {
    persona_id: 'synthetic_revolver',
    income_type: 'W-2 salary',
    risk_profile: 'moderate',
    life_stage: 'mid_career',
    primary_goals: ['Get out of debt'],
  };

  it('leads with debt payoff and does NOT recommend investing before the balance is cleared', async () => {
    const set = await getRecommendations(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSvcFrom(accounts, transactions, personaRow) as any,
      'u'
    );
    const top = set.recommendations[0];
    expect(top.theme).toBe('debt');
    expect(top.title.toLowerCase()).toMatch(/pay down/);
    // No growth rec should steer them into a taxable brokerage while the 24%
    // balance is outstanding.
    const growth = set.recommendations.filter((r) => r.category === 'growth_opportunity');
    for (const g of growth) {
      expect(`${g.title} ${g.action}`.toLowerCase()).not.toMatch(
        /brokerage|taxable|put .* idle cash/i
      );
    }
  });
});
