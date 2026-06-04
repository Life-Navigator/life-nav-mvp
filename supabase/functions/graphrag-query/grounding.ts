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

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// All authoritative personal domains read directly from the system of record.
// `null` = the domain's table was unreadable; `[]` = the user genuinely has none.
export interface PersonalData {
  accounts: FinanceAccount[] | null;
  goals: Row[] | null;
  transactions: Row[] | null;
  benefits: Row[] | null;
  retirement: Row[] | null;
  career: Row[] | null;
  jobApplications: Row[] | null;
  education: Row[] | null;
  courses: Row[] | null;
  simulations: Row[] | null;
  persona: Row[] | null;
  sessions: Row[] | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}
function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}
function pct(v: unknown): string {
  const n = num(v);
  return n === null ? '' : `${n}%`;
}

// Render one labeled domain block. Empty/null → an explicit "none on file / do
// not invent" line, so every domain fails closed exactly like finance.
function domainBlock(
  title: string,
  rows: Row[] | null,
  lineFn: (r: Row) => string,
  noun: string,
): string {
  if (rows === null) {
    return `### ${title}\nSTATUS: temporarily unavailable — do not state or invent any ${noun}.`;
  }
  if (rows.length === 0) {
    return `### ${title}\nNONE on file — do not invent any ${noun}; if asked, say there is none recorded yet.`;
  }
  return `### ${title}\n${rows.map((r) => `- ${lineFn(r)}`).join('\n')}`;
}

// AUTHORITATIVE_PERSONAL_FACTS — the system of record for EVERYTHING personal:
// finances, goals, transactions, benefits, career, education, simulations, and
// prior chats. The ONLY valid source for any personal fact about the user.
export function formatAuthoritativePersonal(d: PersonalData): string {
  const header =
    '## AUTHORITATIVE_PERSONAL_FACTS (system of record — the ONLY valid source for ANY fact about this user: money, goals, transactions, benefits, career, education, simulations, prior chats. Use ONLY what appears here; never invent or estimate.)';

  const blocks: string[] = [formatAuthoritativeFinance(d.accounts)];

  blocks.push(
    domainBlock('GOALS', d.goals, (g) => {
      const prog = str(g.progress_percent) ? `${g.progress_percent}%` : '';
      const tgt =
        num(g.target_value) !== null
          ? `target ${num(g.target_value)}${str(g.unit) ? ' ' + g.unit : ''}`
          : '';
      const cur = num(g.current_value) !== null ? `current ${num(g.current_value)}` : '';
      return [
        `"${str(g.title) || 'Untitled goal'}"`,
        str(g.category) && `category: ${g.category}`,
        str(g.status) && `status: ${g.status}`,
        prog && `progress: ${prog}`,
        tgt,
        cur,
        str(g.target_date) && `target date: ${str(g.target_date).slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'goal'),
  );

  blocks.push(
    domainBlock('RECENT TRANSACTIONS', d.transactions, (t) => {
      return [
        str(t.transaction_date).slice(0, 10),
        fmtMoney(num(t.amount), str(t.currency) || 'USD'),
        str(t.description) || str(t.merchant) || 'transaction',
        str(t.category) && `(${t.category})`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'transaction'),
  );

  blocks.push(
    domainBlock('EMPLOYER BENEFITS', d.benefits, (b) => {
      return [
        str(b.employer_name) || 'employer',
        num(b.salary) !== null && `salary: ${fmtMoney(num(b.salary))}`,
        num(b.bonus_target) !== null && `bonus target: ${fmtMoney(num(b.bonus_target))}`,
        str(b.retirement_match_percent) && `401k match: ${pct(b.retirement_match_percent)}`,
        str(b.stock_grants) && `equity: ${str(b.stock_grants)}`,
        b.is_current === false ? 'former' : 'current',
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'benefit'),
  );

  blocks.push(
    domainBlock('RETIREMENT PLANS', d.retirement, (r) => {
      return [
        str(r.plan_name) || 'plan',
        num(r.current_savings) !== null && `saved: ${fmtMoney(num(r.current_savings))}`,
        num(r.monthly_contribution) !== null &&
          `monthly: ${fmtMoney(num(r.monthly_contribution))}`,
        num(r.target_retirement_age) !== null && `target age: ${num(r.target_retirement_age)}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'retirement plan'),
  );

  blocks.push(
    domainBlock('CAREER PROFILE', d.career, (c) => {
      return [
        str(c.current_title) && `current: ${c.current_title}`,
        str(c.current_company) && `at ${c.current_company}`,
        str(c.industry) && `industry: ${c.industry}`,
        num(c.years_of_experience) !== null && `${num(c.years_of_experience)} yrs exp`,
        str(c.desired_title) && `target role: ${c.desired_title}`,
        (num(c.desired_salary_min) !== null || num(c.desired_salary_max) !== null) &&
          `target pay: ${fmtMoney(num(c.desired_salary_min))}–${fmtMoney(num(c.desired_salary_max))}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'career fact'),
  );

  blocks.push(
    domainBlock('JOB APPLICATIONS', d.jobApplications, (j) => {
      return [
        `${str(j.position) || 'role'} @ ${str(j.company) || 'company'}`,
        str(j.status) && `status: ${j.status}`,
        str(j.applied_date) && `applied: ${str(j.applied_date).slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'job application'),
  );

  blocks.push(
    domainBlock('EDUCATION', d.education, (e) => {
      return [
        `${str(e.degree_type) || 'program'} in ${str(e.field_of_study) || '—'}`,
        str(e.institution_name) && `at ${e.institution_name}`,
        str(e.status) && `status: ${e.status}`,
        num(e.gpa) !== null && `GPA: ${num(e.gpa)}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'education record'),
  );

  blocks.push(
    domainBlock('COURSES', d.courses, (c) => {
      return [
        `"${str(c.course_name) || 'course'}"`,
        str(c.provider) && `via ${c.provider}`,
        str(c.status) && `status: ${c.status}`,
        str(c.progress_percent) && `progress: ${c.progress_percent}%`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'course'),
  );

  blocks.push(
    domainBlock('SIMULATIONS (scenario runs)', d.simulations, (s) => {
      return [
        str(s.created_at).slice(0, 10),
        str(s.status) && `status: ${s.status}`,
        num(s.overall_robustness_score) !== null &&
          `robustness: ${num(s.overall_robustness_score)}`,
        num(s.market_adjusted_probability) !== null &&
          `success prob: ${num(s.market_adjusted_probability)}`,
        num(s.goals_simulated) !== null && `${num(s.goals_simulated)} goals`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'simulation result'),
  );

  blocks.push(
    domainBlock('PERSONA PROFILE', d.persona, (p) => {
      return [
        str(p.display_name) && `${p.display_name}`,
        str(p.life_stage) && `life stage: ${p.life_stage}`,
        str(p.profession) && `profession: ${p.profession}`,
        str(p.income_type) && `income: ${p.income_type}`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'persona detail'),
  );

  blocks.push(
    domainBlock('PRIOR CHAT SESSIONS', d.sessions, (s) => {
      return [
        `"${str(s.title) || str(s.session_type) || 'session'}"`,
        str(s.last_message_at) && str(s.last_message_at).slice(0, 10),
        num(s.message_count) !== null && `${num(s.message_count)} msgs`,
      ]
        .filter(Boolean)
        .join(' | ');
    }, 'prior conversation'),
  );

  return `${header}\n\n${blocks.join('\n\n')}`;
}

// MISSING_DATA — domains with NO data on file, so refusals are explicit.
export function buildMissingData(d: PersonalData): string {
  const header =
    "## MISSING_DATA (NOT available for this user — never invent these; say you don't have them)";
  const checks: Array<[string, FinanceAccount[] | Row[] | null]> = [
    ['financial accounts / balances / APRs', d.accounts],
    ['goals', d.goals],
    ['transactions / spending history', d.transactions],
    ['employer benefits / salary', d.benefits],
    ['retirement plans', d.retirement],
    ['career profile', d.career],
    ['job applications', d.jobApplications],
    ['education records', d.education],
    ['courses', d.courses],
    ['simulations / scenario runs', d.simulations],
    ['prior chat sessions', d.sessions],
  ];
  const missing = checks
    .filter(([, v]) => v === null || (Array.isArray(v) && v.length === 0))
    .map(([label]) => `- ${label}`);
  if (missing.length === 0) {
    return `${header}\n(None — all known domains have data above.)`;
  }
  return `${header}\n${missing.join('\n')}`;
}
