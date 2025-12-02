/**
 * Education Planning Module - Type Definitions
 * Most Advanced Education ROI & Planning System
 */

// ==================== ENUMS & CONSTANTS ====================

export type DegreeType =
  | 'bachelors'
  | 'masters'
  | 'jd'
  | 'md'
  | 'do'
  | 'mba'
  | 'phd'
  | 'associates'
  | 'certificate';

export type SchoolType = 'public' | 'private' | 'for-profit';

export type AccountType = '529' | 'custodial' | 'savings' | 'brokerage';

export type NetworkImportance = 'high' | 'medium' | 'low';

export type NetworkPriority = 'low' | 'medium' | 'high';

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export type LongTermGoalType = 'jd' | 'md' | 'mba' | 'phd' | 'masters' | 'none';

export type ProgramTier = 'top_10' | 'top_25' | 'top_50' | 'any';

export type DocumentType =
  | 'aid_letter'
  | 'scholarship_letter'
  | '529_statement'
  | 'school_costs'
  | 'brokerage_statement';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Network-Critical Degrees (High ANIS weight)
export const NETWORK_CRITICAL_DEGREES = ['jd', 'mba', 'md', 'do'];

// Network-Important Degrees (Medium ANIS weight)
export const NETWORK_IMPORTANT_DEGREES = ['bachelors', 'masters', 'phd'];

// Network-Low Impact Degrees (Low ANIS weight)
export const NETWORK_LOW_DEGREES = ['associates', 'certificate'];

// ==================== CORE INTERFACES ====================

export interface School {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country: string;
  type: SchoolType;

  // Cost Data
  tuitionInState?: number;
  tuitionOutOfState?: number;
  fees?: number;
  roomAndBoard?: number;
  books?: number;
  otherExpenses?: number;

  // Inflation
  tuitionInflationRate: number;
  coaInflationRate: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface DegreeProgram {
  id: string;
  schoolId: string;

  // Program Details
  degreeType: DegreeType;
  major: string;
  programLength: number;

  // Career Outcomes
  startingSalary?: number;
  salary25Percentile?: number;
  salary75Percentile?: number;
  midCareerSalary?: number;
  salaryGrowthRate?: number;

  // Employment Data
  jobPlacementRate?: number;
  underemploymentRate?: number;
  jobGrowthRate?: number;

  // Alumni Network Impact Score (ANIS)
  anisScore: number;
  anisJobFactor: number;
  anisSalaryAlpha: number;
  anisGrowthBeta: number;
  anisUnderemployGamma: number;

  // Network Metrics
  alumniCount?: number;
  alumniInTargetRoles?: number;
  alumniLeadershipPct?: number;
  networkDensityScore?: number;
  brandPremiumScore?: number;

  networkImportance: NetworkImportance;

  // Follow-On Program Access Score (FPAS)
  fpasLawSchool?: number;
  fpasMedSchool?: number;
  fpasMBA?: number;
  fpasPhD?: number;
  fpasMasters?: number;
  fpasMetrics?: FPASMetrics;

  lastUpdated: Date;
  dataSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile {
  id: string;
  userId: string;

  // Student Info
  studentName: string;
  currentAge: number;
  enrollmentYear: number;
  graduationYear: number;

  // Location
  currentState?: string;
  preferredRegion?: string;

  // Financial
  householdIncome?: number;
  expectedFamilyContribution?: number;

  // Career Targets
  targetIndustry?: string;
  targetRole?: string;
  targetSalaryRange?: SalaryRange;

  // Long-Term Educational Goals (Follow-On Programs)
  hasLongTermGoal?: boolean;
  longTermGoalType?: LongTermGoalType;
  targetProgramTier?: ProgramTier;
  targetGPA?: number;
  targetTestScore?: TestScore;

  // Goals Integration
  linkedGoalIds?: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface SalaryRange {
  min: number;
  max: number;
}

export interface TestScore {
  testType: 'LSAT' | 'MCAT' | 'GMAT' | 'GRE' | 'DAT' | 'other';
  targetScore: number;
  percentile?: number;
}

export interface FPASMetrics {
  // Law School
  lawT14Rate?: number; // % admitted to T14 law schools
  lawT50Rate?: number;
  medianLSAT?: number;

  // Med School
  medMatchRate?: number; // % matched to residency programs
  medTopTierRate?: number; // % to top 25 med schools
  medianMCAT?: number;

  // MBA
  mbaM7Rate?: number; // % to M7 MBA programs
  mbaT15Rate?: number;
  medianGMAT?: number;

  // PhD
  phdTopProgramRate?: number; // % to top-ranked PhD programs
  phdFundingRate?: number; // % receiving full funding

  // General
  feederSchoolStatus?: boolean; // Is this a known feeder school?
  gradSchoolPlacementRate?: number; // Overall grad school placement
}

export interface EducationFinancingAccount {
  id: string;
  studentProfileId: string;

  accountType: AccountType;
  accountName: string;
  currentBalance: number;
  monthlyContribution: number;
  annualReturnRate: number;

  priority: number; // Lower = used first in waterfall

  createdAt: Date;
  updatedAt: Date;
}

// ==================== DEGREE ANALYSIS ====================

export interface DegreeAnalysisInput {
  studentProfileId: string;
  schoolId: string;
  degreeProgramId?: string;

  // Custom Overrides
  customSchoolName?: string;
  customDegreeName?: string;
  customDegreeType?: DegreeType;
  customProgramLength?: number;

  // Cost Inputs
  tuition: number;
  fees: number;
  roomBoard: number;
  books: number;
  otherExpenses: number;
  tuitionInflation?: number;
  coaInflation?: number;

  // Financial Aid
  scholarships?: number;
  grants?: number;

  // Career Inputs
  expectedStartSalary: number;
  expectedSalaryGrowth: number;
  expectedJobPlacementRate: number;
  targetRegion?: string;

  // Network Preference
  networkPriority?: NetworkPriority;
}

export interface DegreeAnalysis {
  id: string;
  userId: string;
  studentProfileId: string;
  schoolId: string;
  degreeProgramId?: string;

  // Input Data
  input: DegreeAnalysisInput;

  // Cost of Attendance Results
  totalCostOfAttendance: number;
  yearlyBreakdown: YearlyCost[];

  // Financing Waterfall Results
  financingBreakdown: FinancingBreakdown;

  // Debt Projections
  debtProjection: DebtProjection;

  // Career Outcomes (ANIS-Adjusted)
  careerOutcomes: CareerOutcomes;

  // ROI Calculations
  roiMetrics: ROIMetrics;

  // Scenario Analysis
  scenarios: ScenarioAnalysis;

  // Goal Alignment
  goalAlignmentScore?: number;
  goalImpactAnalysis?: GoalImpact[];

  // AI Analysis
  aiAnalysis: AIAnalysis;

  createdAt: Date;
  updatedAt: Date;
}

export interface YearlyCost {
  year: number;
  tuition: number;
  fees: number;
  roomBoard: number;
  books: number;
  otherExpenses: number;
  totalCOA: number;
  scholarships: number;
  grants: number;
  netCost: number;
}

export interface FinancingBreakdown {
  total529Used: number;
  totalCustodialUsed: number;
  totalSavingsUsed: number;
  totalCashFlowUsed: number;
  totalLoansNeeded: number;
  loanBreakdown: YearlyLoan[];
}

export interface YearlyLoan {
  year: number;
  amount: number;
  interestRate: number;
  type: 'subsidized' | 'unsubsidized' | 'private';
}

export interface DebtProjection {
  totalLoanAmount: number;
  monthlyPayment: number;
  paybackPeriodMonths: number;
  totalInterestPaid: number;
  debtToIncomeRatio: number;
  totalRepaymentAmount: number;
}

export interface CareerOutcomes {
  adjustedStartSalary: number;
  adjustedSalaryGrowth: number;
  adjustedPlacementRate: number;
  adjustedUnderemploymentRate: number;

  // Salary progression (10 years)
  salaryProgression: SalaryProjection[];
}

export interface SalaryProjection {
  year: number;
  salary: number;
  cumulativeEarnings: number;
}

export interface ROIMetrics {
  paybackPeriodYears: number;
  lifetimeNetValue: number; // NPV
  npvIncrementalEarnings: number;
  breakEvenYear: number;

  // Cumulative analysis (30 years)
  cumulativeROI: number; // Percentage
  totalLifetimeEarnings: number;
}

export interface ScenarioAnalysis {
  conservative: Scenario;
  base: Scenario;
  optimistic: Scenario;
}

export interface Scenario {
  name: string;
  assumptions: {
    salaryGrowth: number;
    placementRate: number;
    inflationRate: number;
  };
  roi: number;
  paybackYears: number;
  netValue: number;
  riskAdjustment: number;
}

export interface GoalImpact {
  goalId: string;
  goalName: string;
  impactType: 'accelerates' | 'delays' | 'neutral' | 'blocks';
  yearsImpact: number; // Positive or negative
  description: string;
}

export interface AIAnalysis {
  summary: string;
  warnings: string[];
  suggestions: string[];
  riskLevel: RiskLevel;
  worthItScore: number; // 0-100
}

// ==================== DEGREE COMPARISON ====================

export interface DegreeComparisonInput {
  studentProfileId: string;
  name?: string;
  degreeAnalysisIds: string[];

  // User Preference Weights
  weights?: ComparisonWeights;
}

export interface ComparisonWeights {
  debt: number;        // Default 0.25
  earnings: number;    // Default 0.25
  payback: number;     // Default 0.20
  risk: number;        // Default 0.15
  goalAlignment: number; // Default 0.15
}

export interface DegreeComparison {
  id: string;
  userId: string;
  studentProfileId: string;
  name: string;

  weights: ComparisonWeights;

  entries: ComparisonEntry[];

  aiRecommendation: string;
  topChoiceId: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonEntry {
  id: string;
  degreeAnalysisId: string;
  degreeAnalysis: DegreeAnalysis;

  overallRank: number;
  weightedScore: number;

  // Individual component scores (0-100)
  scores: {
    debt: number;
    earnings: number;
    payback: number;
    risk: number;
    goalAlignment: number;
  };
}

// ==================== FINANCING PLANNER ====================

export interface EducationFinancingPlan {
  studentProfileId: string;
  targetCoveragePercentage: number; // 0-100

  accounts: EducationFinancingAccount[];

  projections: FinancingProjection[];

  recommendations: FinancingRecommendation[];
}

export interface FinancingProjection {
  year: number;
  age: number;

  accounts: {
    accountId: string;
    accountName: string;
    projectedBalance: number;
  }[];

  totalProjectedBalance: number;
}

export interface FinancingRecommendation {
  type: 'increase_contribution' | 'shift_allocation' | 'open_529' | 'adjust_timeline';
  priority: 'high' | 'medium' | 'low';

  description: string;
  impact: {
    loansReduced: number;
    paybackReduced: number; // months
    coverageIncreased: number; // percentage points
  };

  actionRequired: string;
}

// ==================== DOCUMENT PARSING ====================

export interface EducationDocument {
  id: string;
  userId: string;
  studentProfileId?: string;

  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;

  documentType: DocumentType;

  extractedData?: ExtractedDocumentData;
  processingStatus: ProcessingStatus;
  extractedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedDocumentData {
  // Financial Aid Letter
  schoolName?: string;
  totalCostOfAttendance?: number;
  grants?: number;
  scholarships?: number;
  workStudy?: number;
  loans?: number;

  // 529 Statement
  accountBalance?: number;
  accountName?: string;
  ytdGrowth?: number;

  // Raw extracted text
  rawText?: string;
  confidence?: number;
}

// ==================== CALCULATION ENGINES ====================

export interface CostOfAttendanceEngine {
  calculateTotalCOA(input: DegreeAnalysisInput): YearlyCost[];
  applyInflation(baseCost: number, year: number, inflationRate: number): number;
}

export interface FinancingWaterfallEngine {
  applyWaterfall(
    yearlyCosts: YearlyCost[],
    accounts: EducationFinancingAccount[],
    enrollmentYear: number
  ): FinancingBreakdown;

  projectAccountGrowth(
    account: EducationFinancingAccount,
    years: number
  ): FinancingProjection[];
}

export interface CareerOutcomesEngine {
  calculateOutcomes(
    input: DegreeAnalysisInput,
    degreeProgram?: DegreeProgram,
    networkPriority?: NetworkPriority
  ): CareerOutcomes;

  applyANIS(
    baseMetrics: BaseCareerMetrics,
    anisData: ANISData,
    networkPriority: NetworkPriority
  ): CareerOutcomes;
}

export interface BaseCareerMetrics {
  startSalary: number;
  salaryGrowth: number;
  placementRate: number;
  underemploymentRate: number;
}

export interface ANISData {
  anisScore: number;
  anisJobFactor: number;
  anisSalaryAlpha: number;
  anisGrowthBeta: number;
  anisUnderemployGamma: number;
}

export interface ROIEngine {
  calculateROI(
    totalCost: number,
    financingBreakdown: FinancingBreakdown,
    careerOutcomes: CareerOutcomes,
    debtProjection: DebtProjection
  ): ROIMetrics;

  calculateNPV(cashFlows: number[], discountRate: number): number;

  runScenarioAnalysis(
    baseAnalysis: DegreeAnalysis
  ): ScenarioAnalysis;
}

export interface GoalAlignmentEngine {
  calculateAlignment(
    degreeAnalysis: DegreeAnalysis,
    userGoals: any[] // Import from @/lib/goals/types
  ): {
    score: number;
    impacts: GoalImpact[];
  };
}

// ==================== ANIS SYSTEM ====================

export interface ANISCalculator {
  calculateANIS(metrics: NetworkMetrics): number;

  getANISFactors(
    anisScore: number,
    degreeType: DegreeType
  ): {
    jobFactor: number;
    salaryAlpha: number;
    growthBeta: number;
    underemployGamma: number;
  };
}

export interface NetworkMetrics {
  alumniCount: number;
  alumniInTargetRoles: number;
  alumniLeadershipPct: number;
  networkDensityScore: number;
  brandPremiumScore: number;
  placementPower: number; // % into target firms
  engagementScore: number; // Alumni org activity
}

// ==================== API RESPONSE TYPES ====================

export interface DegreeAnalysisResponse {
  success: boolean;
  data?: DegreeAnalysis;
  error?: string;
}

export interface DegreeComparisonResponse {
  success: boolean;
  data?: DegreeComparison;
  error?: string;
}

export interface FinancingPlanResponse {
  success: boolean;
  data?: EducationFinancingPlan;
  error?: string;
}

export interface SchoolSearchResponse {
  success: boolean;
  schools?: School[];
  error?: string;
}

export interface DegreeProgramSearchResponse {
  success: boolean;
  programs?: DegreeProgram[];
  error?: string;
}
