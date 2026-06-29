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

// ---- Position-level metrics: derived from REAL holdings, null where unknown (NEVER coerced to 0) --------
export interface RawMetrics {
  ytdReturn?: number | null;
  oneYearReturn?: number | null;
  threeYearReturn?: number | null;
  fiveYearReturn?: number | null;
  annualDividendIncome?: number | null;
}
export interface DisplayMetrics {
  totalValue: number; // always known for real holdings (sum of market value)
  totalCostBasis: number | null; // known only if EVERY real holding has a cost basis
  totalGainLoss: number | null; // requires cost basis
  totalGainLossPercent: number | null;
  ytdReturnPercent: number | null; // only if performance data exists
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  fiveYearReturn: number | null;
  dividendIncome: number | null;
}

const _pct = (v: number | null | undefined): number | null => (v == null ? null : v * 100);

/** Compute the overview metrics from REAL holdings. A missing cost basis / performance / dividend yields
 *  `null` (rendered as "Not available") — it NEVER hides the holdings and NEVER shows a fake $0 / 0.00%. */
export function computeDisplayMetrics(
  realHoldings: { marketValue?: number | null; costBasis?: number | null }[],
  raw?: RawMetrics | null
): DisplayMetrics {
  const totalValue = realHoldings.reduce((s, h) => s + (Number(h.marketValue) || 0), 0);
  const haveAllCost =
    realHoldings.length > 0 && realHoldings.every((h) => (Number(h.costBasis) || 0) > 0);
  const rawCostBasis = haveAllCost
    ? realHoldings.reduce((s, h) => s + (Number(h.costBasis) || 0), 0)
    : null;
  // SAFETY: a cost basis that is implausibly small vs market value (e.g. per-share value mis-stored as a
  // total, or a placeholder) would yield an impossible gain (+295,455%). Treat it as UNAVAILABLE rather than
  // compute a fake gain/loss. Real cost basis is normally a meaningful fraction of market value.
  const plausibleCost =
    rawCostBasis != null && totalValue > 0
      ? rawCostBasis / totalValue >= 0.05
      : rawCostBasis != null;
  const totalCostBasis = plausibleCost ? rawCostBasis : null;
  const totalGainLoss = totalCostBasis != null ? totalValue - totalCostBasis : null;
  const totalGainLossPercent =
    totalCostBasis != null && totalCostBasis > 0 ? (totalGainLoss! / totalCostBasis) * 100 : null;
  return {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    ytdReturnPercent: _pct(raw?.ytdReturn),
    oneYearReturn: _pct(raw?.oneYearReturn),
    threeYearReturn: _pct(raw?.threeYearReturn),
    fiveYearReturn: _pct(raw?.fiveYearReturn),
    dividendIncome: raw?.annualDividendIncome == null ? null : raw.annualDividendIncome,
  };
}

/** Reconciliation note when the connected account balance and the position details total disagree. */
export function reconciliationNote(
  accountBalance: number | null | undefined,
  holdingsTotal: number
): string | null {
  if (accountBalance == null || accountBalance <= 0 || holdingsTotal <= 0) return null;
  if (Math.abs(accountBalance - holdingsTotal) < 1) return null; // they match
  return (
    `Connected account balance: $${Math.round(accountBalance).toLocaleString()}. ` +
    `Position details total: $${Math.round(holdingsTotal).toLocaleString()}. ` +
    `Difference may reflect cash, pending data, or unavailable holdings.`
  );
}
