import {
  isRealHolding,
  investmentStatus,
  computeDisplayMetrics,
  reconciliationNote,
} from '../investmentDisplay';

describe('investment display contract', () => {
  it('suppresses placeholder holdings (0 shares / $0 / N/A)', () => {
    expect(isRealHolding({ shares: 0, marketValue: 0 })).toBe(false);
    expect(isRealHolding({ shares: null, marketValue: null })).toBe(false);
  });
  it('keeps real positions (shares), suppresses account-balance pseudo-holdings (value but 0 shares)', () => {
    expect(isRealHolding({ shares: 10, marketValue: 1500 })).toBe(true);
    expect(isRealHolding({ shares: 10, marketValue: 0 })).toBe(true);
    // market value but no shares = synthesized from an account balance → NOT a position
    expect(isRealHolding({ shares: 0, marketValue: 920000 })).toBe(false);
  });
  it('account balance + no real holdings → account_balance_only', () => {
    expect(investmentStatus(920000, 0)).toBe('account_balance_only');
  });
  it('real holdings → positions_available', () => {
    expect(investmentStatus(920000, 4)).toBe('positions_available');
  });
  it('no balance + no holdings → no_investment_data', () => {
    expect(investmentStatus(null, 0)).toBe('no_investment_data');
    expect(investmentStatus(0, 0)).toBe('no_investment_data');
  });

  // ---- Test matrix: all three states + the metric/reconciliation rules ----
  const REAL = [
    { symbol: 'AAPL', shares: 20, marketValue: 4000 },
    { symbol: 'VTI', shares: 50, marketValue: 14000 },
  ];

  it('A — account balance only: no real holdings → account_balance_only', () => {
    const real = ([] as { shares?: number }[]).filter(isRealHolding);
    expect(real).toHaveLength(0);
    expect(investmentStatus(920000, real.length)).toBe('account_balance_only');
  });

  it('B — synthetic pseudo-holding (value, 0 shares) suppressed → account_balance_only', () => {
    const real = [{ symbol: null, shares: 0, marketValue: 920000 }].filter(isRealHolding);
    expect(real).toHaveLength(0);
    expect(investmentStatus(920000, real.length)).toBe('account_balance_only');
  });

  it('C — real holdings, no cost basis: holdings render, cost/gain/perf Not available', () => {
    const real = REAL.filter(isRealHolding);
    expect(real).toHaveLength(2);
    const m = computeDisplayMetrics(real, {});
    expect(m.totalValue).toBe(18000);
    expect(m.totalCostBasis).toBeNull();
    expect(m.totalGainLoss).toBeNull();
    expect(m.ytdReturnPercent).toBeNull();
    expect(m.dividendIncome).toBeNull();
  });

  it('D — real holdings with cost basis: gain/loss computed', () => {
    const real = [
      { shares: 20, marketValue: 4000, costBasis: 3000 },
      { shares: 50, marketValue: 14000, costBasis: 12000 },
    ].filter(isRealHolding);
    const m = computeDisplayMetrics(real, {});
    expect(m.totalCostBasis).toBe(15000);
    expect(m.totalGainLoss).toBe(3000);
    expect(m.totalGainLossPercent).toBeCloseTo(20);
  });

  it('E — performance only from real data', () => {
    const m = computeDisplayMetrics(REAL.filter(isRealHolding), {
      ytdReturn: 0.08,
      oneYearReturn: 0.15,
    });
    expect(m.ytdReturnPercent).toBeCloseTo(8);
    expect(m.oneYearReturn).toBeCloseTo(15);
    expect(m.threeYearReturn).toBeNull();
  });

  it('F — mixed real + placeholder: placeholders suppressed, count = real only', () => {
    const mixed = [
      { symbol: 'AAPL', shares: 20, marketValue: 4000 },
      { symbol: 'N/A', shares: 0, marketValue: 0 },
      { symbol: null, shares: 0, marketValue: 920000 },
    ];
    const real = mixed.filter(isRealHolding);
    expect(real).toHaveLength(1);
    expect(real[0].symbol).toBe('AAPL');
  });

  it('G — reconciliation note when balance and holdings total differ', () => {
    expect(reconciliationNote(920000, 875000)).toContain('$920,000');
    expect(reconciliationNote(920000, 875000)).toContain('$875,000');
    expect(reconciliationNote(920000, 920000)).toBeNull(); // match → no note
    expect(reconciliationNote(null, 875000)).toBeNull();
  });
});
