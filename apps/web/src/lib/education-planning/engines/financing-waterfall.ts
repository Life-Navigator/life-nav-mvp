/**
 * Financing Waterfall Engine
 * Applies funds in priority order: 529 → Custodial → Savings → Cash Flow → Loans
 */

import type {
  YearlyCost,
  EducationFinancingAccount,
  FinancingBreakdown,
  YearlyLoan,
  FinancingProjection,
  FinancingWaterfallEngine as IFinancingWaterfallEngine,
} from '../types';

export class FinancingWaterfallEngine implements IFinancingWaterfallEngine {
  /**
   * Apply financing waterfall to cover yearly costs
   */
  applyWaterfall(
    yearlyCosts: YearlyCost[],
    accounts: EducationFinancingAccount[],
    enrollmentYear: number
  ): FinancingBreakdown {
    // Sort accounts by priority (lower number = higher priority)
    const sortedAccounts = [...accounts].sort((a, b) => a.priority - b.priority);

    // Project account balances to enrollment year
    const currentYear = new Date().getFullYear();
    const yearsUntilEnrollment = Math.max(0, enrollmentYear - currentYear);

    const projectedAccounts = sortedAccounts.map((account) => {
      const projections = this.projectAccountGrowth(account, yearsUntilEnrollment);
      const finalProjection = projections[projections.length - 1];
      return {
        ...account,
        currentBalance:
          finalProjection?.accounts.find((a) => a.accountId === account.id)
            ?.projectedBalance || account.currentBalance,
      };
    });

    // Track remaining balances during waterfall
    const accountBalances = new Map<string, number>();
    projectedAccounts.forEach((acc) => {
      accountBalances.set(acc.id, acc.currentBalance);
    });

    // Track totals used from each source
    let total529Used = 0;
    let totalCustodialUsed = 0;
    let totalSavingsUsed = 0;
    let totalCashFlowUsed = 0;
    let totalLoansNeeded = 0;

    const loanBreakdown: YearlyLoan[] = [];

    // Process each year
    yearlyCosts.forEach((yearCost, index) => {
      let remainingCost = yearCost.netCost;
      const year = yearCost.year;

      // Apply funds from each account type in priority order
      for (const account of projectedAccounts) {
        if (remainingCost <= 0) break;

        const availableBalance = accountBalances.get(account.id) || 0;
        const amountToUse = Math.min(remainingCost, availableBalance);

        if (amountToUse > 0) {
          // Deduct from account
          accountBalances.set(account.id, availableBalance - amountToUse);
          remainingCost -= amountToUse;

          // Track by account type
          switch (account.accountType) {
            case '529':
              total529Used += amountToUse;
              break;
            case 'custodial':
              totalCustodialUsed += amountToUse;
              break;
            case 'savings':
            case 'brokerage':
              totalSavingsUsed += amountToUse;
              break;
          }
        }

        // Grow account balance for next year (if years remain)
        if (index < yearlyCosts.length - 1) {
          const newBalance = accountBalances.get(account.id) || 0;
          const grownBalance = newBalance * (1 + account.annualReturnRate);
          const withContribution = grownBalance + account.monthlyContribution * 12;
          accountBalances.set(account.id, withContribution);
        }
      }

      // If still remaining cost, assume monthly cash flow can cover some
      // Assume family can contribute up to $2,000/month from cash flow
      const maxMonthlyCashFlow = 2000;
      const annualCashFlowCapacity = maxMonthlyCashFlow * 12;
      const cashFlowUsed = Math.min(remainingCost, annualCashFlowCapacity);

      if (cashFlowUsed > 0) {
        totalCashFlowUsed += cashFlowUsed;
        remainingCost -= cashFlowUsed;
      }

      // Any remaining cost becomes loans
      if (remainingCost > 0) {
        totalLoansNeeded += remainingCost;

        // Determine loan type based on amount
        // Federal subsidized max: $3,500-$5,500/year
        // Federal unsubsidized: up to COA
        // Private: anything above federal limits

        const federalSubsidizedMax = 3500 + (year - 1) * 500; // Increases by year
        const federalUnsubsidizedMax = 20500; // Annual limit

        let subsidizedAmount = 0;
        let unsubsidizedAmount = 0;
        let privateAmount = 0;

        if (remainingCost <= federalSubsidizedMax) {
          subsidizedAmount = remainingCost;
        } else if (remainingCost <= federalUnsubsidizedMax) {
          subsidizedAmount = federalSubsidizedMax;
          unsubsidizedAmount = remainingCost - federalSubsidizedMax;
        } else {
          subsidizedAmount = federalSubsidizedMax;
          unsubsidizedAmount = federalUnsubsidizedMax - federalSubsidizedMax;
          privateAmount = remainingCost - federalUnsubsidizedMax;
        }

        if (subsidizedAmount > 0) {
          loanBreakdown.push({
            year,
            amount: subsidizedAmount,
            interestRate: 0.0543, // Current subsidized rate ~5.43%
            type: 'subsidized',
          });
        }

        if (unsubsidizedAmount > 0) {
          loanBreakdown.push({
            year,
            amount: unsubsidizedAmount,
            interestRate: 0.0543, // Current unsubsidized rate ~5.43%
            type: 'unsubsidized',
          });
        }

        if (privateAmount > 0) {
          loanBreakdown.push({
            year,
            amount: privateAmount,
            interestRate: 0.08, // Private loans typically 7-10%
            type: 'private',
          });
        }
      }
    });

    return {
      total529Used,
      totalCustodialUsed,
      totalSavingsUsed,
      totalCashFlowUsed,
      totalLoansNeeded,
      loanBreakdown,
    };
  }

  /**
   * Project account growth over time with contributions
   */
  projectAccountGrowth(
    account: EducationFinancingAccount,
    years: number
  ): FinancingProjection[] {
    const projections: FinancingProjection[] = [];

    let balance = account.currentBalance;
    const currentYear = new Date().getFullYear();

    for (let year = 0; year <= years; year++) {
      projections.push({
        year: currentYear + year,
        age: 0, // Would need student age to calculate
        accounts: [
          {
            accountId: account.id,
            accountName: account.accountName,
            projectedBalance: balance,
          },
        ],
        totalProjectedBalance: balance,
      });

      // Grow for next year
      if (year < years) {
        // Apply investment returns
        balance *= 1 + account.annualReturnRate;
        // Add annual contributions
        balance += account.monthlyContribution * 12;
      }
    }

    return projections;
  }

  /**
   * Calculate optimal savings needed to reach target coverage
   */
  calculateRequiredSavings(
    targetCost: number,
    currentSavings: number,
    yearsUntilEnrollment: number,
    annualReturnRate: number,
    targetCoveragePercent: number
  ): {
    monthlyRequired: number;
    totalNeeded: number;
    projectedShortfall: number;
  } {
    const targetAmount = targetCost * (targetCoveragePercent / 100);

    // Project current savings growth
    const projectedCurrentSavings =
      currentSavings * Math.pow(1 + annualReturnRate, yearsUntilEnrollment);

    const amountStillNeeded = Math.max(0, targetAmount - projectedCurrentSavings);

    // Calculate required monthly contribution using future value of annuity formula
    // FV = PMT * [((1 + r)^n - 1) / r]
    // Solving for PMT: PMT = FV / [((1 + r)^n - 1) / r]

    const monthlyRate = annualReturnRate / 12;
    const months = yearsUntilEnrollment * 12;

    let monthlyRequired = 0;
    if (months > 0 && amountStillNeeded > 0) {
      if (monthlyRate === 0) {
        monthlyRequired = amountStillNeeded / months;
      } else {
        const denominator = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
        monthlyRequired = amountStillNeeded / denominator;
      }
    }

    return {
      monthlyRequired: Math.max(0, monthlyRequired),
      totalNeeded: targetAmount,
      projectedShortfall: Math.max(0, targetAmount - projectedCurrentSavings),
    };
  }

  /**
   * Calculate total financing coverage percentage
   */
  calculateCoveragePercentage(
    totalCost: number,
    financingBreakdown: FinancingBreakdown
  ): {
    savingsCoverage: number; // % covered by savings
    cashFlowCoverage: number; // % covered by cash flow
    loanCoverage: number; // % covered by loans
  } {
    const totalSavings =
      financingBreakdown.total529Used +
      financingBreakdown.totalCustodialUsed +
      financingBreakdown.totalSavingsUsed;

    return {
      savingsCoverage: (totalSavings / totalCost) * 100,
      cashFlowCoverage: (financingBreakdown.totalCashFlowUsed / totalCost) * 100,
      loanCoverage: (financingBreakdown.totalLoansNeeded / totalCost) * 100,
    };
  }
}

// Singleton instance
export const financingWaterfallEngine = new FinancingWaterfallEngine();
