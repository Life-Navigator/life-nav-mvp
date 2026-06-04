// grounding.ts — pure, deterministic helpers that enforce the two-layer
// GraphRAG rule: AUTHORITATIVE_FINANCIAL_FACTS (system of record) is the ONLY
// valid source for personal money facts. When facts are absent, these helpers
// emit explicit "refuse / do not invent" instructions so the model fails closed
// instead of hallucinating accounts/balances. Pure (no Deno/IO) → unit-testable.

export interface FinanceAccount {
  account_name: string | null;
  account_type: string | null;
  institution_name: string | null;
  current_balance: number | null;
  available_balance: number | null;
  interest_rate: number | null;
  credit_limit: number | null;
  currency: string | null;
}

export function isDebtType(t: string | null): boolean {
  const s = (t || '').toLowerCase();
  return (
    s.includes('credit') ||
    s.includes('loan') ||
    s.includes('mortgage') ||
    s.includes('line_of_credit') ||
    s.includes('liability')
  );
}

export function fmtMoney(n: number | null, currency = 'USD'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'unknown';
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${abs}`;
}

// AUTHORITATIVE_FINANCIAL_FACTS — the ONLY valid source for personal money facts.
// null = system of record unreadable; [] = user genuinely has no accounts. Both
// produce an explicit refusal instruction.
export function formatAuthoritativeFinance(accounts: FinanceAccount[] | null): string {
  const header =
    "## AUTHORITATIVE_FINANCIAL_FACTS (system of record — the ONLY valid source for this user's balances, APRs, accounts, institutions, and net worth)";
  if (accounts === null) {
    return `${header}\nSTATUS: temporarily unavailable (could not read the finance system of record). Treat ALL personal financial facts as unavailable — do not state or estimate any balance, APR, or account.`;
  }
  if (accounts.length === 0) {
    return `${header}\nSTATUS: NO financial accounts are on file for this user. Do not state, estimate, or invent any account, balance, APR, institution, or net worth. If asked, say no accounts are connected yet and offer to help connect them.`;
  }
  let assets = 0;
  let debts = 0;
  const lines = accounts.map((a) => {
    const cur = a.currency || 'USD';
    const bal = a.current_balance ?? 0;
    if (isDebtType(a.account_type)) debts += bal;
    else assets += bal;
    const parts = [
      `"${a.account_name ?? 'Unnamed account'}"`,
      `type: ${a.account_type ?? 'unknown'}`,
      `institution: ${a.institution_name ?? 'not specified'}`,
      isDebtType(a.account_type)
        ? `balance owed: ${fmtMoney(a.current_balance, cur)}`
        : `balance: ${fmtMoney(a.current_balance, cur)}`,
    ];
    if (a.interest_rate !== null && a.interest_rate !== undefined) {
      parts.push(`APR: ${(a.interest_rate * 100).toFixed(2)}%`);
    }
    if (a.credit_limit !== null && a.credit_limit !== undefined) {
      parts.push(`credit limit: ${fmtMoney(a.credit_limit, cur)}`);
    }
    return `- ${parts.join(' | ')}`;
  });
  const netWorth = assets - debts;
  return (
    `${header}\n` +
    `These are the user's ACTUAL accounts. Use ONLY these for any balance/APR/account/net-worth answer; do not add or alter anything.\n` +
    `${lines.join('\n')}\n` +
    `Totals (computed from the accounts above): total assets ${fmtMoney(assets)} | total debt ${fmtMoney(debts)} | net worth ${fmtMoney(netWorth)}`
  );
}

// MISSING_DATA — explicit list of unavailable categories, to anchor refusals.
export function buildMissingData(accounts: FinanceAccount[] | null): string {
  const header =
    "## MISSING_DATA (NOT available for this user — never invent these; say you don't have them)";
  const missing: string[] = [];
  if (accounts === null) {
    missing.push('- All financial accounts (system of record temporarily unreadable)');
  } else if (accounts.length === 0) {
    missing.push('- Financial accounts / balances / APRs (none connected yet)');
  }
  missing.push('- Individual transactions / spending history (not retrieved here)');
  missing.push('- Income / salary figures (not in the finance accounts record)');
  return `${header}\n${missing.join('\n')}`;
}
