import { isRealHolding, investmentStatus } from '../investmentDisplay';

describe('investment display contract', () => {
  it('suppresses placeholder holdings (0 shares / $0 / N/A)', () => {
    expect(isRealHolding({ shares: 0, marketValue: 0 })).toBe(false);
    expect(isRealHolding({ shares: null, marketValue: null })).toBe(false);
  });
  it('keeps real holdings', () => {
    expect(isRealHolding({ shares: 10, marketValue: 0 })).toBe(true);
    expect(isRealHolding({ shares: 0, marketValue: 5000 })).toBe(true);
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
});
