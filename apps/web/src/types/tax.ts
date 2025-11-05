/**
 * Tax domain type definitions
 */

// Filing status options for US tax calculations
export type FilingStatus = 'single' | 'married_jointly' | 'married_separately' | 'head_of_household';

// Pay frequency options
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'quarterly' | 'annually';

// W-4 form data
export type W4FormData = {
  filingStatus: FilingStatus;
  multipleJobs: boolean;
  claimDependents: number;
  otherIncome: number;
  deductions: number;
  extraWithholding: number;
};

// Income details for tax calculations
export type IncomeDetails = {
  salary: number;
  payFrequency: PayFrequency;
  selfEmploymentIncome?: number;
  investmentIncome?: number;
  otherIncome?: number;
  preTaxDeductions?: number;
  retirement401k?: number;
  traditionalIRA?: number;
  roth401k?: number;
  rothIRA?: number;
  hsa?: number;
  fsa?: number;
};

// Deduction details
export type DeductionDetails = {
  useStandardDeduction: boolean;
  mortgageInterest?: number;
  propertyTaxes?: number;
  charitableDonations?: number;
  medicalExpenses?: number;
  studentLoanInterest?: number;
  otherDeductions?: number;
};

// Tax credit details
export type CreditDetails = {
  childTaxCredit?: number;
  childAndDependentCare?: number;
  educationCredits?: number;
  energyCredits?: number;
  otherCredits?: number;
};

// Complete tax profile with all information
export type TaxProfile = {
  id: string;
  userId: string;
  taxYear: number;
  w4: W4FormData;
  income: IncomeDetails;
  deductions: DeductionDetails;
  credits: CreditDetails;
  createdAt: Date;
  updatedAt: Date;
};

// Withholding calculation result
export type WithholdingResult = {
  payPeriodGrossIncome: number;
  federalWithholding: number;
  socialSecurityTax: number;
  medicareTax: number;
  stateTax?: number;
  localTax?: number;
  totalTaxes: number;
  netIncome: number;
  annualProjection: {
    annualGrossIncome: number;
    annualTaxes: number;
    annualNetIncome: number;
    effectiveTaxRate: number;
  };
};

// Tax bracket structure
export type TaxBracket = {
  rate: number; // as a percentage (e.g., 10 for 10%)
  min: number;
  max: number | null; // null for the highest bracket
}; 

// Collection of tax brackets by filing status
export type TaxBrackets = {
  [key in FilingStatus]: TaxBracket[];
};

// Annual tax estimate result
export type TaxEstimate = {
  totalIncome: number;
  adjustedGrossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  selfEmploymentTax: number;
  totalCredits: number;
  totalTaxLiability: number;
  withholdingToDate: number;
  estimatedRefundOrOwed: number;
  marginalTaxRate: number;
  effectiveTaxRate: number;
  taxBreakdown: {
    federalIncomeTax: number;
    selfEmploymentTax: number;
    socialSecurityTax: number;
    medicareTax: number;
    stateTax?: number;
    localTax?: number;
  };
};