import { computeAnalytics } from '../computeAnalytics';

const NOW = Date.UTC(2026, 5, 29); // fixed
const day = (ago: number) => new Date(NOW - ago * 86400000).toISOString().slice(0, 10);
const ACCOUNTS = [
  {
    account_name: 'Jumbo Mortgage',
    account_type: 'mortgage',
    current_balance: -1240000,
    is_active: true,
  },
  {
    account_name: 'Money Market',
    account_type: 'money_market',
    current_balance: 145000,
    is_active: true,
  },
  {
    account_name: 'Executive Checking',
    account_type: 'checking',
    current_balance: 58200,
    is_active: true,
  },
  {
    account_name: 'Investment Portfolio',
    account_type: 'investment',
    current_balance: 920000,
    is_active: true,
  },
];

describe('computeAnalytics — honest finance overview', () => {
  it('income but NO expense transactions → expenses/savings unavailable, NOT 100%', () => {
    const txns = [
      { amount: 11800, transaction_type: 'income', transaction_date: day(5), merchant: 'Employer' },
    ];
    const a = computeAnalytics(txns, [], ACCOUNTS, NOW);
    expect(a.cash_flow.income_total).toBe(11800);
    expect(a.cash_flow.expense_total).toBeNull();
    expect(a.cash_flow.net_cash_flow).toBeNull();
    expect(a.cash_flow.savings_rate).toBeNull(); // never 100% from missing expenses
    expect(a.cash_flow.note).toMatch(/expense history is needed/i);
    // spending + bills report "need transaction history", not "no spending"
    expect(a.spending_trends.missing_state.reason).toMatch(/need transaction history/i);
    expect(a.upcoming_bills.missing_state.reason).toMatch(/need recent transaction history/i);
  });

  it('no transactions at all → every section unavailable (missing_state), nothing zero', () => {
    const a = computeAnalytics([], [], ACCOUNTS, NOW);
    expect(a.cash_flow.income_total).toBeNull();
    expect(a.cash_flow.missing_state.reason).toMatch(/no transaction history/i);
    expect(a.spending_trends.missing_state).toBeTruthy();
    expect(a.upcoming_bills.missing_state).toBeTruthy();
  });

  it('income + expenses → savings rate computed', () => {
    const txns = [
      { amount: 11800, transaction_type: 'income', transaction_date: day(5) },
      {
        amount: 2000,
        transaction_type: 'expense',
        transaction_date: day(4),
        category: 'Rent',
        merchant: 'Landlord',
      },
      {
        amount: 800,
        transaction_type: 'expense',
        transaction_date: day(3),
        category: 'Food',
        merchant: 'Grocer',
      },
    ];
    const a = computeAnalytics(txns, [], ACCOUNTS, NOW);
    expect(a.cash_flow.income_total).toBe(11800);
    expect(a.cash_flow.expense_total).toBe(2800);
    expect(a.cash_flow.net_cash_flow).toBe(9000);
    expect(a.cash_flow.savings_rate).toBeCloseTo(76.27, 1);
    expect(a.spending_trends.total_spending).toBe(2800);
    expect(a.spending_trends.categories.length).toBe(2);
  });

  it('verified zero: expense history exists but none in last 30 days', () => {
    const txns = [
      {
        amount: 500,
        transaction_type: 'expense',
        transaction_date: day(45),
        category: 'Food',
        merchant: 'Grocer',
      },
      { amount: 11800, transaction_type: 'income', transaction_date: day(50) },
    ];
    const a = computeAnalytics(txns, [], ACCOUNTS, NOW);
    expect(a.spending_trends.verified_zero).toBe(true);
    expect(a.spending_trends.missing_state.reason).toMatch(/no spending detected/i);
  });

  it('recurring bills detected from repeated consistent merchant', () => {
    const txns = [
      { amount: 50, transaction_type: 'expense', transaction_date: day(40), merchant: 'Netflix' },
      { amount: 50, transaction_type: 'expense', transaction_date: day(10), merchant: 'Netflix' },
    ];
    const a = computeAnalytics(txns, [], ACCOUNTS, NOW);
    expect(a.upcoming_bills.bills.length).toBe(1);
    expect(a.upcoming_bills.bills[0].name).toBe('Netflix');
  });

  it('balance-grounded limited-data insights when no expense history (mortgage/liquidity)', () => {
    const a = computeAnalytics(
      [{ amount: 11800, transaction_type: 'income', transaction_date: day(5) }],
      [],
      ACCOUNTS,
      NOW
    );
    expect(a.financial_insights.status).toBe('limited_data');
    expect(a.financial_insights.generated_by).toBe('deterministic_fallback');
    const titles = a.financial_insights.insights.map((i: { title: string }) => i.title).join(' | ');
    expect(titles).toMatch(/largest liability/i); // mortgage
    expect(titles).toMatch(/liquidity/i);
    expect(titles).toMatch(/limited/i); // expense caveat
    // mortgage liability alone must NOT fabricate an upcoming bill
    expect(a.upcoming_bills.bills.length).toBe(0);
  });

  it('mortgage balance alone never fabricates a bill', () => {
    const a = computeAnalytics([], [], ACCOUNTS, NOW);
    expect(a.upcoming_bills.bills).toHaveLength(0);
  });
});
