import { bucketFor, normalizeFinancePayload } from '../domainViewModel';

const DVM = {
  domain: 'finance',
  user_id: 'u1',
  generated_at: '2026-06-08T00:00:00Z',
  freshness: { as_of: '2026-06-08T00:00:00Z', stale: false, sources: [] },
  confidence: { score: 0.6, basis: 'partial', missing_fields: [] },
  data: {
    net_worth: { amount: 17000, currency: 'USD' },
    cash: { amount: 5000, currency: 'USD' },
    debt: null,
    monthly_income: null,
    monthly_expenses: null,
    savings_rate: null,
    emergency_reserve_months: null,
    accounts: [
      {
        id: 'a1',
        name: 'Checking',
        institution: 'Bank',
        type: 'depository',
        balance: { amount: 5000, currency: 'USD' },
      },
      {
        id: 'a2',
        name: 'Brokerage',
        institution: 'Broker',
        type: 'investment',
        balance: { amount: 12000, currency: 'USD' },
      },
    ],
    top_opportunities: [],
    top_risks: [],
    next_best_action: null,
  },
  recommendations: [
    {
      id: 'r1',
      title: 'Pay down your highest-interest debt first',
      why_it_matters: 'Your highest-APR balance costs the most in interest.',
      priority: 'high',
      action_steps: [
        { step: 'Direct extra payments to this balance', effort: 'low', impact: 'high' },
      ],
      affected_domains: ['finance'],
      risks: ['Reducing liquidity'],
      revisit_date: '2026-07-08',
      evidence: [],
      source_tables: ['finance.asset_loans'],
      source_graph_nodes: [],
      assumptions: [],
      confidence: { score: 0.8, basis: 'partial', missing_fields: [] },
      governance_verdict: { passed: true },
    },
  ],
  missing: [],
};

describe('normalizeFinancePayload — Core API DomainViewModel', () => {
  it('maps authoritative money tiles and bucketed accounts', () => {
    const n = normalizeFinancePayload(DVM);
    expect(n.core.source).toBe('core');
    expect(n.core.netWorth).toBe(17000);
    expect(n.core.cash).toBe(5000);
    expect(n.accounts).toHaveLength(2);
    expect(n.accounts[0].balance).toBe(5000); // {amount} object -> number
    expect(n.accounts[1].type).toBe('investment'); // raw account_type -> bucket
    expect(n.core.hasData).toBe(true);
  });

  it('surfaces recommendations with H-contract fields', () => {
    const r = normalizeFinancePayload(DVM).core.recommendations[0];
    expect(r.title).toContain('Pay down');
    expect(r.why_it_matters).toContain('interest');
    expect(r.priority).toBe('high');
    expect(r.action_steps[0].step).toContain('extra payments');
    expect(r.revisit_date).toBe('2026-07-08');
  });

  it('keeps absent money as null so the UI shows a prompt, never $0', () => {
    const empty = {
      ...DVM,
      data: { ...DVM.data, net_worth: null, cash: null, accounts: [] },
      missing: ['plaid_link'],
      confidence: { score: 0, basis: 'missing', missing_fields: ['accounts'] },
    };
    const n = normalizeFinancePayload(empty);
    expect(n.core.netWorth).toBeNull();
    expect(n.core.cash).toBeNull();
    expect(n.accounts).toHaveLength(0);
    expect(n.core.hasData).toBe(false);
    expect(n.core.missing).toContain('plaid_link');
    expect(n.core.confidenceBasis).toBe('missing');
  });
});

describe('normalizeFinancePayload — legacy payload (proxy off)', () => {
  it('maps the legacy shape and reports no authoritative tiles', () => {
    const legacy = {
      accounts: [{ id: 'a', name: 'Chk', institution: 'B', type: 'banking', balance: 100 }],
      transactions: {
        dailySpending: [{ date: '2026-06-01', amount: 5, category: 'x' }],
        categorySpending: [],
        recentTransactions: [],
      },
      investments: {},
      cryptoAssets: [],
    };
    const n = normalizeFinancePayload(legacy);
    expect(n.core.source).toBe('legacy');
    expect(n.accounts[0].balance).toBe(100);
    expect(n.transactions.dailySpending).toHaveLength(1);
    expect(n.core.recommendations).toHaveLength(0);
    expect(n.core.netWorth).toBeNull(); // legacy has no backend net-worth figure
  });

  it('unknown/empty input -> honest empty state', () => {
    const n = normalizeFinancePayload(null);
    expect(n.accounts).toHaveLength(0);
    expect(n.core.hasData).toBe(false);
    expect(n.core.missing).toContain('plaid_link');
  });
});

describe('bucketFor', () => {
  it('maps raw account types to the three dashboard buckets', () => {
    expect(bucketFor('depository')).toBe('banking');
    expect(bucketFor('investment')).toBe('investment');
    expect(bucketFor('brokerage')).toBe('investment');
    expect(bucketFor('credit card')).toBe('credit');
    expect(bucketFor('loan')).toBe('credit');
    expect(bucketFor('Jumbo Mortgage')).toBe('credit'); // mortgages are liabilities, not assets
    expect(bucketFor('mortgage')).toBe('credit');
    expect(bucketFor(null)).toBe('banking');
  });
});
