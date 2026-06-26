// Investment display contract — distinguishes real positions from account-balance-only and no-data, so the
// UI never renders placeholder holdings or fake $0 / 0.00% metrics. (No mock data — ever.)
export type InvestmentStatus =
  | 'positions_available'
  | 'account_balance_only'
  | 'no_investment_data';

/** A holding is a REAL position only if it has SHARES. A row with a market value but 0 shares is an
 *  account-level balance synthesized as a pseudo-holding (no cost basis, no performance) — NOT a position,
 *  so it's suppressed and shown at the account level instead. Placeholder/model rows (N/A · 0 shares · $0)
 *  are likewise suppressed. */
export function isRealHolding(h: { shares?: number | null; marketValue?: number | null }): boolean {
  return (Number(h?.shares) || 0) > 0;
}

export function investmentStatus(
  accountBalance: number | null | undefined,
  realHoldingsCount: number
): InvestmentStatus {
  if (realHoldingsCount > 0) return 'positions_available';
  if (accountBalance != null && accountBalance > 0) return 'account_balance_only';
  return 'no_investment_data';
}
