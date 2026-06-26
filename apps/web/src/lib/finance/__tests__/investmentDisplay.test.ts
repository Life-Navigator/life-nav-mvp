import { isRealHolding, investmentStatus } from '../investmentDisplay';

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
});
