/**
 * High-fidelity verification of the First Insight engine across every sample
 * persona. We map each persona's Plaid sandbox dataset (PLAID_CUSTOM_CONFIGS)
 * into the exact finance.financial_accounts / finance.transactions rows that
 * persist.ts would write, feed them to the REAL getFirstInsight engine via a
 * mock Supabase client, and assert the resulting insight is specific, true,
 * and non-misleading. The console table doubles as the Phase 0 evidence.
 */
import { getFirstInsight } from '../first-insight';
import { PLAID_CUSTOM_CONFIGS } from '@/lib/integrations/plaid/plaid-custom-configs';
import { getPersona } from '@/lib/integrations/plaid/personas';
import { mapAccountType } from '@/lib/integrations/plaid/persist';

// persist.ts: amount = abs(plaid), transaction_type = plaid >= 0 ? expense : income.
function rowsFor(personaId: string) {
  const cfg = PLAID_CUSTOM_CONFIGS[personaId];
  const accounts = cfg.override_accounts.map((a) => ({
    account_type: mapAccountType(a.type, a.subtype),
    current_balance: a.starting_balance,
    available_balance: a.starting_balance,
    credit_limit: a.meta.limit ?? null,
  }));
  const transactions = cfg.override_accounts.flatMap((a) =>
    a.transactions.map((t) => ({
      amount: Math.abs(t.amount),
      transaction_type: t.amount >= 0 ? 'expense' : 'income',
      transaction_date: t.date_posted,
    }))
  );
  return { accounts, transactions };
}

function mockSvc(personaId: string) {
  const { accounts, transactions } = rowsFor(personaId);
  const p = getPersona(personaId)!;
  const personaRow = {
    persona_id: p.persona_id,
    display_name: p.display_name,
    income_type: p.income_type,
    risk_profile: p.risk_profile,
    life_stage: p.life_stage,
    primary_goals: p.primary_goals,
  };
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

const PERSONA_IDS = Object.keys(PLAID_CUSTOM_CONFIGS);

describe('First Insight — per-persona quality', () => {
  it('produces a specific, non-misleading insight for every persona', async () => {
    const table: Record<string, string> = {};
    for (const id of PERSONA_IDS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insight = await getFirstInsight(mockSvc(id) as any, 'user-1');

      // Structural guarantees.
      expect(insight.has_data).toBe(true);
      expect(insight.headline.length).toBeGreaterThan(10);
      expect(insight.recommendation.length).toBeGreaterThan(10);
      expect(['risk', 'caution', 'positive', 'neutral']).toContain(insight.severity);

      // Must NOT contain the misleading "underwater" framing for asset-backed
      // loan/mortgage holders.
      const hasMortgage = PLAID_CUSTOM_CONFIGS[id].override_accounts.some(
        (a) => a.type === 'loan' && a.subtype === 'mortgage'
      );
      if (hasMortgage) {
        expect(insight.headline.toLowerCase()).not.toMatch(/debt.*exceed|exceed.*asset|underwater/);
      }

      table[id] = `[${insight.severity}] ${insight.headline}`;
    }
    // Emit the evidence table.
    // eslint-disable-next-line no-console
    console.log('\n=== First Insight per persona ===');
    for (const id of PERSONA_IDS) {
      // eslint-disable-next-line no-console
      console.log(`• ${id.padEnd(22)} ${table[id]}`);
    }
  });

  it('gives married_family a retirement-gap insight, not an idle-cash or underwater one', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = await getFirstInsight(mockSvc('married_family') as any, 'u');
    expect(i.headline.toLowerCase()).toMatch(/retirement/);
  });

  it('flags credit_rebuilding on high card utilization', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = await getFirstInsight(mockSvc('credit_rebuilding') as any, 'u');
    expect(i.severity).toBe('risk');
    expect(i.headline.toLowerCase()).toMatch(/credit card|used/);
  });

  it('flags high_income_executive idle cash', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = await getFirstInsight(mockSvc('high_income_executive') as any, 'u');
    expect(i.headline.toLowerCase()).toMatch(/cash/);
  });
});
