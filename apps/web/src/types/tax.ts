/**
 * Tax domain type definitions - Comprehensive Tax Planning Module
 */

// Filing status options for US tax calculations
export type FilingStatus = 'single' | 'married_jointly' | 'married_separately' | 'head_of_household';

// Pay frequency options
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'quarterly' | 'annually';

// Income categories
export type IncomeCategory =
  | 'wages'
  | 'self_employment'
  | 'business'
  | 'rental'
  | 'interest'
  | 'dividends'
  | 'capital_gains'
  | 'retirement'
  | 'social_security'
  | 'other';

// Deduction categories
export type DeductionCategory = 'standard' | 'itemized' | 'above_the_line' | 'business';

// Deduction types
export type DeductionType =
  | 'mortgage_interest'
  | 'property_tax'
  | 'charitable'
  | 'medical'
  | 'state_local_tax'
  | 'student_loan'
  | 'educator_expense'
  | 'hsa'
  | 'ira'
  | '401k'
  | 'self_employment_tax'
  | 'home_office'
  | 'other';

// Tax credit types
export type TaxCreditType =
  | 'child_tax_credit'
  | 'dependent_care'
  | 'education_aotc'
  | 'education_llc'
  | 'earned_income'
  | 'adoption'
  | 'saver'
  | 'foreign_tax'
  | 'energy'
  | 'ev_credit'
  | 'premium_tax'
  | 'other';

// Tax document types
export type TaxDocumentType =
  | 'w2'
  | '1099_misc'
  | '1099_nec'
  | '1099_div'
  | '1099_int'
  | '1099_b'
  | '1099_r'
  | '1098'
  | '1098_t'
  | '1098_e'
  | 'k1'
  | 'receipts'
  | 'other';

// Optimization categories
export type OptimizationCategory =
  | 'income_timing'
  | 'deduction_bunching'
  | 'retirement_contribution'
  | 'charitable_giving'
  | 'tax_loss_harvesting'
  | 'roth_conversion'
  | 'hsa_contribution'
  | 'business_structure'
  | 'capital_gains'
  | 'estate_planning';

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
  filingStatus: FilingStatus;
  state?: string;
  dependents: number;
  isBlind: boolean;
  isOver65: boolean;
  spouseIsBlind: boolean;
  spouseIsOver65: boolean;
  status: 'draft' | 'in_progress' | 'completed' | 'filed';
  lastCalculatedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  incomes?: TaxIncomeItem[];
  deductions?: TaxDeductionItem[];
  credits?: TaxCreditItem[];
  estimates?: TaxEstimateResult[];
  scenarios?: TaxScenario[];
  documents?: TaxDocument[];
  quarterlyPayments?: QuarterlyPayment[];
  optimizations?: TaxOptimization[];
};

// Detailed income item
export interface TaxIncomeItem {
  id: string;
  taxProfileId: string;
  category: IncomeCategory;
  subcategory?: string;
  source: string;
  amount: number;
  frequency: PayFrequency | 'annual' | 'one_time';
  taxWithheld: number;
  is1099: boolean;
  isW2: boolean;
  employerEIN?: string;
  expenses: number;
  netIncome?: number;
  qbiEligible: boolean;
  costBasis?: number;
  acquisitionDate?: Date;
  isQualified: boolean;
  propertyAddress?: string;
  daysRented?: number;
  daysPersonalUse?: number;
  notes?: string;
  documentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Detailed deduction item
export interface TaxDeductionItem {
  id: string;
  taxProfileId: string;
  category: DeductionCategory;
  type: DeductionType | string;
  description: string;
  amount: number;
  isRecurring: boolean;
  frequency?: 'monthly' | 'annual' | 'one_time';
  limitApplies: boolean;
  limitAmount?: number;
  agiPhaseoutStart?: number;
  agiPhaseoutEnd?: number;
  recipientName?: string;
  recipientEIN?: string;
  isCash: boolean;
  fairMarketValue?: number;
  lenderName?: string;
  loanNumber?: string;
  propertyAddress?: string;
  isFirstMortgage: boolean;
  loanOriginationDate?: Date;
  originalLoanAmount?: number;
  agiThreshold?: number;
  documentIds: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Detailed credit item
export interface TaxCreditItem {
  id: string;
  taxProfileId: string;
  type: TaxCreditType | string;
  name: string;
  amount: number;
  isRefundable: boolean;
  isPartiallyRefundable: boolean;
  refundableAmount?: number;
  agiPhaseoutStart?: number;
  agiPhaseoutEnd?: number;
  phaseoutRate?: number;
  qualifyingChildren?: number;
  childrenUnder6?: number;
  childrenUnder17?: number;
  studentName?: string;
  institutionName?: string;
  qualifiedExpenses?: number;
  form1098T: boolean;
  vehicleVIN?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  purchaseDate?: Date;
  msrp?: number;
  batteryCapacity?: number;
  propertyType?: string;
  installationCost?: number;
  installationDate?: Date;
  documentIds: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tax document tracking
export interface TaxDocument {
  id: string;
  taxProfileId: string;
  type: TaxDocumentType;
  year: number;
  issuerName: string;
  issuerEIN?: string;
  status: 'pending' | 'received' | 'reviewed' | 'entered' | 'filed';
  receivedDate?: Date;
  reviewedDate?: Date;
  enteredDate?: Date;
  documentNumber?: string;
  grossAmount?: number;
  taxWithheld?: number;
  stateTaxWithheld?: number;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  ocrText?: string;
  ocrData?: Record<string, unknown>;
  isValidated: boolean;
  validationErrors?: Record<string, string>[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tax scenario for what-if analysis
export interface TaxScenario {
  id: string;
  taxProfileId: string;
  name: string;
  description?: string;
  incomeChanges?: ScenarioChanges;
  deductionChanges?: ScenarioChanges;
  creditChanges?: ScenarioChanges;
  filingStatusChange?: FilingStatus;
  baselineTax?: number;
  scenarioTax?: number;
  taxDifference?: number;
  isRecommended: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScenarioChanges {
  add?: Record<string, unknown>[];
  modify?: Record<string, unknown>[];
  remove?: string[];
}

// Tax optimization suggestion
export interface TaxOptimization {
  id: string;
  taxProfileId: string;
  category: OptimizationCategory;
  title: string;
  description: string;
  estimatedSavings: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  timeframe: 'immediate' | 'this_year' | 'multi_year';
  complexity: 'simple' | 'moderate' | 'complex';
  actionRequired: string;
  deadline?: Date;
  requirements?: Record<string, unknown>;
  risks?: string;
  status: 'suggested' | 'considering' | 'implemented' | 'dismissed';
  implementedAt?: Date;
  actualSavings?: number;
  source: 'system' | 'user' | 'advisor';
  createdAt: Date;
  updatedAt: Date;
}

// Quarterly tax payment
export interface QuarterlyPayment {
  id: string;
  taxProfileId: string;
  quarter: 1 | 2 | 3 | 4;
  dueDate: Date;
  requiredPayment: number;
  actualPayment: number;
  paymentDate?: Date;
  priorYearTax?: number;
  currentYearEstimate?: number;
  safeHarborAmount?: number;
  isUnderpaid: boolean;
  penaltyAmount?: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  confirmationNumber?: string;
  paymentMethod?: string;
  notes?: string;
  documentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

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

// Comprehensive tax estimate result
export interface TaxEstimateResult {
  id?: string;
  taxProfileId?: string;
  calculatedAt: Date;
  scenarioId?: string;

  // Income Summary
  grossIncome: number;
  adjustedGrossIncome: number;
  taxableIncome: number;

  // Deductions
  aboveLineDeductions: number;
  standardDeduction: number;
  itemizedDeductions: number;
  deductionUsed: 'standard' | 'itemized';
  totalDeductions: number;
  qbiDeduction: number;

  // Tax Calculations
  ordinaryIncomeTax: number;
  capitalGainsTax: number;
  selfEmploymentTax: number;
  additionalMedicareTax: number;
  netInvestmentIncomeTax: number;
  alternativeMinimumTax: number;
  totalTaxBeforeCredits: number;

  // Credits
  nonrefundableCredits: number;
  refundableCredits: number;
  totalCredits: number;

  // Final Tax
  totalTaxLiability: number;
  totalWithholding: number;
  estimatedPayments: number;
  totalPayments: number;
  refundOrOwed: number;

  // Rates
  marginalRate: number;
  effectiveRate: number;

  // State Tax
  stateTaxableIncome?: number;
  stateTax?: number;
  stateCredits?: number;
  stateRefundOrOwed?: number;

  // Combined
  totalFederalAndState?: number;
  combinedEffectiveRate?: number;

  // Detailed breakdown
  breakdown?: TaxBreakdown;
}

// Detailed tax breakdown by bracket
export interface TaxBreakdown {
  brackets: BracketDetail[];
  capitalGains: {
    shortTerm: number;
    longTerm: number;
    rate0: number;
    rate15: number;
    rate20: number;
  };
  fica: {
    socialSecurity: number;
    medicare: number;
    additionalMedicare: number;
  };
  selfEmployment: {
    taxableAmount: number;
    tax: number;
    deduction: number;
  };
  niit: {
    threshold: number;
    netInvestmentIncome: number;
    tax: number;
  };
  amt: {
    amtIncome: number;
    exemption: number;
    tentativeMinimumTax: number;
    amtOwed: number;
  };
}

export interface BracketDetail {
  rate: number;
  min: number;
  max: number | null;
  taxableInBracket: number;
  taxFromBracket: number;
}

// Annual tax estimate result (legacy compatibility)
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

// Tax deadline
export interface TaxDeadline {
  id: string;
  name: string;
  description: string;
  dueDate: Date;
  category: 'filing' | 'payment' | 'forms' | 'retirement' | 'healthcare' | 'business' | 'estimated_tax';
  applicableTo: string[];
  filingStatus: FilingStatus[];
  form?: string;
  isExtendable: boolean;
  extensionDeadline?: Date;
  penaltyInfo?: string;
  resourceUrl?: string;
  isRecurring: boolean;
}

// Tax summary for dashboard
export interface TaxSummary {
  taxYear: number;
  profileStatus: TaxProfile['status'];
  estimatedTax: number;
  totalWithholding: number;
  totalEstimatedPayments: number;
  refundOrOwed: number;
  effectiveRate: number;
  marginalRate: number;
  documentsReceived: number;
  documentsExpected: number;
  nextDeadline?: TaxDeadline;
  optimizationPotential: number;
  quarterlyPaymentStatus: {
    q1: QuarterlyPayment['status'];
    q2: QuarterlyPayment['status'];
    q3: QuarterlyPayment['status'];
    q4: QuarterlyPayment['status'];
  };
}

// State tax rates
export interface StateTaxInfo {
  code: string;
  name: string;
  hasIncomeTax: boolean;
  flatRate?: number;
  brackets?: TaxBracket[];
  standardDeduction?: number;
  personalExemption?: number;
  dependentExemption?: number;
}

// Multi-year projection
export interface TaxProjection {
  year: number;
  estimatedIncome: number;
  estimatedTax: number;
  estimatedEffectiveRate: number;
  assumptions: string[];
}

// API response types
export interface TaxProfileResponse {
  profile: TaxProfile;
  summary: TaxSummary;
  latestEstimate?: TaxEstimateResult;
}

export interface TaxCalculationRequest {
  profileId?: string;
  taxYear: number;
  filingStatus: FilingStatus;
  incomes: Partial<TaxIncomeItem>[];
  deductions: Partial<TaxDeductionItem>[];
  credits: Partial<TaxCreditItem>[];
  state?: string;
}

export interface TaxOptimizationResponse {
  optimizations: TaxOptimization[];
  totalPotentialSavings: number;
  topRecommendations: TaxOptimization[];
}