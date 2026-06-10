'use client';

import React from 'react';

// P0 single source of truth: this component renders the canonical finance summary.
// It does NOT compute net worth from a list of accounts (that produced a figure
// that disagreed with every other page). It receives the canonical summary and
// renders it, or shows an honest MISSING state when the summary is unavailable.
interface CanonicalSummary {
  net_worth?: number;
  total_assets?: number;
  total_liabilities?: number;
  debt_total?: number;
  cash_balance?: number;
  investment_balance?: number;
  retirement_balance?: number;
  // forward-compatible flags for the mortgage-without-home prompt
  mortgage_balance?: number;
  home_value?: number;
}

interface NetWorthSummaryProps {
  summary: CanonicalSummary | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function NetWorthSummary({ summary }: NetWorthSummaryProps) {
  // No canonical summary yet → honest MISSING state, never a fabricated $0.
  if (!summary || typeof summary.net_worth !== 'number') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Financial Summary
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Net worth is unavailable right now. Connect or add your accounts to see your assets,
          liabilities, and net worth — all calculated from one canonical source.
        </p>
      </div>
    );
  }

  const netWorth = summary.net_worth;
  const liabilitiesTotal = summary.total_liabilities ?? summary.debt_total ?? 0;
  const assetsTotal =
    summary.total_assets ??
    (summary.cash_balance ?? 0) +
      (summary.investment_balance ?? 0) +
      (summary.retirement_balance ?? 0);
  const denom = assetsTotal + liabilitiesTotal;

  // Forward-compatible integrity prompt: mortgage debt present but no home value.
  const showMortgageGap = (summary.mortgage_balance ?? 0) > 0 && (summary.home_value ?? 0) <= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Financial Summary
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="text-sm text-blue-700 dark:text-blue-300 mb-1">Net Worth</h3>
          <p
            className={`text-2xl font-bold ${netWorth >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-rose-600 dark:text-rose-400'}`}
          >
            {formatCurrency(netWorth)}
          </p>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
          <h3 className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Assets</h3>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(assetsTotal)}
          </p>
        </div>

        <div className="p-4 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
          <h3 className="text-sm text-rose-700 dark:text-rose-300 mb-1">Liabilities</h3>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">
            {formatCurrency(liabilitiesTotal)}
          </p>
        </div>
      </div>

      {showMortgageGap && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          We found mortgage debt but no home asset value. Add your home&apos;s value to complete
          your net worth.
        </div>
      )}

      {denom > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600"
              style={{ width: `${Math.min(100, (assetsTotal / denom) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Assets: {Math.round((assetsTotal / denom) * 100)}%</span>
            <span>Liabilities: {Math.round((liabilitiesTotal / denom) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
