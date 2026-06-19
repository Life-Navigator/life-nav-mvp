/**
 * Shared tax computation helpers for the /api/tax/* routes.
 *
 * Honest, deterministic federal estimate from the user's REAL income items. This
 * is a planning estimate (ordinary brackets + standard deduction), not a filing —
 * we never fabricate numbers we don't have. 2024 federal brackets / standard
 * deductions are used as the reference schedule.
 */

// Page-facing filing-status vocabulary (src/types/tax.ts FilingStatus).
export type PageFilingStatus =
  | 'single'
  | 'married_jointly'
  | 'married_separately'
  | 'head_of_household';

// DB stores the longer IRS labels (finance.tax_profiles.filing_status comment in migration 031).
export function dbToPageFilingStatus(v?: string | null): PageFilingStatus {
  switch ((v || '').toLowerCase()) {
    case 'married_filing_jointly':
    case 'married_jointly':
      return 'married_jointly';
    case 'married_filing_separately':
    case 'married_separately':
      return 'married_separately';
    case 'head_of_household':
      return 'head_of_household';
    default:
      return 'single';
  }
}

export function pageToDbFilingStatus(v?: string | null): string {
  switch ((v || '').toLowerCase()) {
    case 'married_jointly':
      return 'married_filing_jointly';
    case 'married_separately':
      return 'married_filing_separately';
    case 'head_of_household':
      return 'head_of_household';
    default:
      return 'single';
  }
}

type Bracket = { rate: number; min: number; max: number | null };

// 2024 federal ordinary-income brackets (rate as a percentage).
const BRACKETS_2024: Record<PageFilingStatus, Bracket[]> = {
  single: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 609350 },
    { rate: 37, min: 609350, max: null },
  ],
  married_jointly: [
    { rate: 10, min: 0, max: 23200 },
    { rate: 12, min: 23200, max: 94300 },
    { rate: 22, min: 94300, max: 201050 },
    { rate: 24, min: 201050, max: 383900 },
    { rate: 32, min: 383900, max: 487450 },
    { rate: 35, min: 487450, max: 731200 },
    { rate: 37, min: 731200, max: null },
  ],
  married_separately: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 365600 },
    { rate: 37, min: 365600, max: null },
  ],
  head_of_household: [
    { rate: 10, min: 0, max: 16550 },
    { rate: 12, min: 16550, max: 63100 },
    { rate: 22, min: 63100, max: 100500 },
    { rate: 24, min: 100500, max: 191950 },
    { rate: 32, min: 191950, max: 243700 },
    { rate: 35, min: 243700, max: 609350 },
    { rate: 37, min: 609350, max: null },
  ],
};

const STANDARD_DEDUCTION_2024: Record<PageFilingStatus, number> = {
  single: 14600,
  married_jointly: 29200,
  married_separately: 14600,
  head_of_household: 21900,
};

export interface IncomeLike {
  amount?: number;
  taxWithheld?: number;
}

/** Compute a federal planning estimate from real income items. Rates returned as percentages. */
export function computeEstimate(incomes: IncomeLike[], filingStatus: PageFilingStatus) {
  const grossIncome = incomes.reduce((n, i) => n + (Number(i.amount) || 0), 0);
  const totalWithholding = incomes.reduce((n, i) => n + (Number(i.taxWithheld) || 0), 0);
  const adjustedGrossIncome = grossIncome; // above-the-line adjustments not modeled yet
  const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus];
  const taxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction);

  const brackets = BRACKETS_2024[filingStatus];
  let ordinaryIncomeTax = 0;
  let marginalRate = 0;
  for (const b of brackets) {
    if (taxableIncome > b.min) {
      const upper = b.max == null ? taxableIncome : Math.min(taxableIncome, b.max);
      ordinaryIncomeTax += ((upper - b.min) * b.rate) / 100;
      marginalRate = b.rate;
    }
  }
  ordinaryIncomeTax = Math.round(ordinaryIncomeTax);

  const totalTaxBeforeCredits = ordinaryIncomeTax;
  const totalCredits = 0;
  const totalTaxLiability = Math.max(0, totalTaxBeforeCredits - totalCredits);
  const effectiveRate = grossIncome > 0 ? (totalTaxLiability / grossIncome) * 100 : 0;

  return {
    calculatedAt: new Date().toISOString(),
    grossIncome,
    adjustedGrossIncome,
    taxableIncome,
    aboveLineDeductions: 0,
    standardDeduction,
    itemizedDeductions: 0,
    deductionUsed: 'standard' as const,
    totalDeductions: standardDeduction,
    qbiDeduction: 0,
    ordinaryIncomeTax,
    capitalGainsTax: 0,
    selfEmploymentTax: 0,
    additionalMedicareTax: 0,
    netInvestmentIncomeTax: 0,
    alternativeMinimumTax: 0,
    totalTaxBeforeCredits,
    nonrefundableCredits: 0,
    refundableCredits: 0,
    totalCredits,
    totalTaxLiability,
    totalWithholding,
    estimatedPayments: 0,
    totalPayments: totalWithholding,
    refundOrOwed: totalWithholding - totalTaxLiability,
    marginalRate,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
  };
}
