/**
 * Finance payload normalizer.
 *
 * The Finance dashboard must consume the Core API Finance **DomainViewModel**
 * (from `/v1/finance/summary` via the `/api/financial` proxy) and must NOT
 * depend on Plaid-native shapes. This helper is the single place that maps a
 * raw `/api/financial` response into the normalized shape the dashboard renders.
 *
 * It accepts BOTH:
 *   - the Core API `DomainViewModel` (when `CORE_API_URL` is set), and
 *   - the legacy `/api/financial` payload (when the proxy is off).
 *
 * All Plaid/legacy coupling lives here, not in React components. This file is
 * intentionally easy to delete once the proxy is permanently on and the legacy
 * route is removed.
 */

export type AccountBucket = 'banking' | 'investment' | 'credit';

export interface PageAccount {
  id: string;
  name: string;
  type: AccountBucket;
  balance: number;
  institution: string;
}

export interface DailySpend {
  date: string;
  amount: number;
  category: string;
}
export interface CategorySpend {
  category: string;
  amount: number;
}
export interface RecentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}
export interface PageTransactions {
  dailySpending: DailySpend[];
  categorySpending: CategorySpend[];
  recentTransactions: RecentTransaction[];
}
export interface PageInvestments {
  portfolioPerformance: Array<{ date: string; value: number }>;
  assetAllocation: Array<{ name: string; value: number }>;
  holdings: Array<{ symbol: string; name: string; shares: number; price: number; value: number }>;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
}
export interface PageCrypto {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  change24h: number;
}

export interface FinanceActionStep {
  step: string;
  effort?: string;
  impact?: string;
}
export interface FinanceRecommendation {
  id: string;
  title: string;
  why_it_matters: string;
  priority: 'high' | 'medium' | 'low';
  action_steps: FinanceActionStep[];
  affected_domains: string[];
  risks: string[];
  revisit_date: string | null;
}

export interface FinanceCore {
  /** Where the data came from — drives whether we trust authoritative money tiles. */
  source: 'core' | 'legacy';
  /** Authoritative money tiles. `null` means "absent" — render a prompt, never $0. */
  netWorth: number | null;
  cash: number | null;
  debt: number | null;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  savingsRate: number | null;
  emergencyReserveMonths: number | null;
  recommendations: FinanceRecommendation[];
  /** Missing fields the backend reported (e.g. ["plaid_link"]). */
  missing: string[];
  /** True when there is no finance data at all → show connect/add prompts. */
  hasData: boolean;
  confidenceBasis: 'complete' | 'partial' | 'sparse' | 'missing' | null;
}

export interface NormalizedFinance {
  accounts: PageAccount[];
  transactions: PageTransactions;
  investments: PageInvestments;
  cryptoAssets: PageCrypto[];
  core: FinanceCore;
}

const EMPTY_TX: PageTransactions = {
  dailySpending: [],
  categorySpending: [],
  recentTransactions: [],
};
const EMPTY_INV: PageInvestments = {
  portfolioPerformance: [],
  assetAllocation: [],
  holdings: [],
  totalValue: 0,
  dayChange: 0,
  dayChangePercent: 0,
};

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyAmount(v: unknown): number | null {
  // Core API money is { amount, currency }; legacy is a bare number.
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && 'amount' in (v as Record<string, unknown>)) {
    const a = Number((v as Record<string, unknown>).amount);
    return Number.isFinite(a) ? a : null;
  }
  return null;
}

/** Map a raw account_type (Plaid/Core) into the 3 buckets the dashboard renders. */
export function bucketFor(t: string | null | undefined): AccountBucket {
  const s = (t ?? '').toLowerCase();
  if (s.includes('invest') || s.includes('retire') || s.includes('brokerage')) return 'investment';
  // Liabilities: credit cards, loans, mortgages, lines of credit, any debt account.
  if (
    s.includes('credit') ||
    s.includes('loan') ||
    s.includes('mortgage') ||
    s.includes('debt') ||
    s.includes('liabilit')
  )
    return 'credit';
  return 'banking';
}

function isDomainViewModel(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    'domain' in (raw as Record<string, unknown>) &&
    'data' in (raw as Record<string, unknown>) &&
    'confidence' in (raw as Record<string, unknown>)
  );
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Map a Core API DomainViewModel → the normalized dashboard shape. */
function fromDomainViewModel(raw: Record<string, unknown>): NormalizedFinance {
  const data = (raw.data as Record<string, unknown>) ?? {};
  const confidence = (raw.confidence as Record<string, unknown>) ?? {};
  const rawAccounts = arr<Record<string, unknown>>(data.accounts);

  const accounts: PageAccount[] = rawAccounts.map((a) => ({
    id: String(a.id ?? ''),
    name: String(a.name ?? ''),
    institution: String(a.institution ?? ''),
    type: bucketFor(a.type as string | undefined),
    balance: moneyAmount(a.balance) ?? 0,
  }));

  const rawRecs = arr<Record<string, unknown>>(raw.recommendations);
  const recommendations: FinanceRecommendation[] = rawRecs.map((r) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    why_it_matters: String(r.why_it_matters ?? ''),
    priority: (r.priority as FinanceRecommendation['priority']) ?? 'medium',
    action_steps: arr<Record<string, unknown>>(r.action_steps).map((s) => ({
      step: String(s.step ?? ''),
      effort: s.effort ? String(s.effort) : undefined,
      impact: s.impact ? String(s.impact) : undefined,
    })),
    affected_domains: arr<string>(r.affected_domains),
    risks: arr<string>(r.risks),
    revisit_date: (r.revisit_date as string | null) ?? null,
  }));

  const basis = (confidence.basis as FinanceCore['confidenceBasis']) ?? null;

  return {
    accounts,
    transactions: EMPTY_TX, // detail comes from /v1/finance/transactions (not the summary)
    investments: EMPTY_INV, // detail comes from /v1/finance/investments
    cryptoAssets: [],
    core: {
      source: 'core',
      netWorth: moneyAmount(data.net_worth),
      cash: moneyAmount(data.cash),
      debt: moneyAmount(data.debt),
      monthlyIncome: moneyAmount(data.monthly_income),
      monthlyExpenses: moneyAmount(data.monthly_expenses),
      savingsRate: typeof data.savings_rate === 'number' ? data.savings_rate : null,
      emergencyReserveMonths:
        typeof data.emergency_reserve_months === 'number' ? data.emergency_reserve_months : null,
      recommendations,
      missing: arr<string>(raw.missing),
      hasData: accounts.length > 0,
      confidenceBasis: basis,
    },
  };
}

/** Map the legacy /api/financial payload → the normalized shape (Plaid isolated here). */
function fromLegacy(raw: Record<string, unknown>): NormalizedFinance {
  const rawAccounts = arr<Record<string, unknown>>(raw.accounts);
  const accounts: PageAccount[] = rawAccounts.map((a) => ({
    id: String(a.id ?? ''),
    name: String(a.name ?? ''),
    institution: String(a.institution ?? ''),
    // legacy route already buckets type; bucketFor is idempotent for safety.
    type: bucketFor(a.type as string | undefined),
    balance: asNumber(a.balance),
  }));
  const tx = (raw.transactions as Record<string, unknown>) ?? {};
  const inv = (raw.investments as Record<string, unknown>) ?? {};

  return {
    accounts,
    transactions: {
      dailySpending: arr<DailySpend>(tx.dailySpending),
      categorySpending: arr<CategorySpend>(tx.categorySpending),
      recentTransactions: arr<RecentTransaction>(tx.recentTransactions),
    },
    investments: {
      portfolioPerformance: arr<PageInvestments['portfolioPerformance'][number]>(
        inv.portfolioPerformance
      ),
      assetAllocation: arr<PageInvestments['assetAllocation'][number]>(inv.assetAllocation),
      holdings: arr<PageInvestments['holdings'][number]>(inv.holdings),
      totalValue: asNumber(inv.totalValue),
      dayChange: asNumber(inv.dayChange),
      dayChangePercent: asNumber(inv.dayChangePercent),
    },
    cryptoAssets: arr<PageCrypto>(raw.cryptoAssets),
    core: {
      source: 'legacy',
      // Legacy payload has no authoritative aggregate tiles; the page computes
      // them from accounts. Leave null so we never imply a backend figure.
      netWorth: null,
      cash: null,
      debt: null,
      monthlyIncome: null,
      monthlyExpenses: null,
      savingsRate: null,
      emergencyReserveMonths: null,
      recommendations: [],
      missing: [],
      hasData: accounts.length > 0,
      confidenceBasis: null,
    },
  };
}

export function normalizeFinancePayload(raw: unknown): NormalizedFinance {
  if (isDomainViewModel(raw)) return fromDomainViewModel(raw as Record<string, unknown>);
  if (raw && typeof raw === 'object') return fromLegacy(raw as Record<string, unknown>);
  // Unknown/empty → honest empty state (no fake data).
  return {
    accounts: [],
    transactions: EMPTY_TX,
    investments: EMPTY_INV,
    cryptoAssets: [],
    core: {
      source: 'legacy',
      netWorth: null,
      cash: null,
      debt: null,
      monthlyIncome: null,
      monthlyExpenses: null,
      savingsRate: null,
      emergencyReserveMonths: null,
      recommendations: [],
      missing: ['plaid_link'],
      hasData: false,
      confidenceBasis: 'missing',
    },
  };
}
