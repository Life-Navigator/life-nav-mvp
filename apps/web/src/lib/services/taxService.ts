import { 
  FilingStatus,
  PayFrequency,
  W4FormData,
  IncomeDetails,
  DeductionDetails,
  CreditDetails,
  WithholdingResult,
  TaxBracket,
  TaxBrackets,
  TaxEstimate
} from '@/types/tax';

// 2024 federal income tax brackets
const federalTaxBrackets2024: TaxBrackets = {
  single: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 609350 },
    { rate: 37, min: 609350, max: null }
  ],
  married_jointly: [
    { rate: 10, min: 0, max: 23200 },
    { rate: 12, min: 23200, max: 94300 },
    { rate: 22, min: 94300, max: 201050 },
    { rate: 24, min: 201050, max: 383900 },
    { rate: 32, min: 383900, max: 487450 },
    { rate: 35, min: 487450, max: 731200 },
    { rate: 37, min: 731200, max: null }
  ],
  married_separately: [
    { rate: 10, min: 0, max: 11600 },
    { rate: 12, min: 11600, max: 47150 },
    { rate: 22, min: 47150, max: 100525 },
    { rate: 24, min: 100525, max: 191950 },
    { rate: 32, min: 191950, max: 243725 },
    { rate: 35, min: 243725, max: 365600 },
    { rate: 37, min: 365600, max: null }
  ],
  head_of_household: [
    { rate: 10, min: 0, max: 16550 },
    { rate: 12, min: 16550, max: 63100 },
    { rate: 22, min: 63100, max: 100500 },
    { rate: 24, min: 100500, max: 191950 },
    { rate: 32, min: 191950, max: 243700 },
    { rate: 35, min: 243700, max: 609350 },
    { rate: 37, min: 609350, max: null }
  ]
};

// 2024 standard deduction amounts
const standardDeduction2024 = {
  single: 14600,
  married_jointly: 29200,
  married_separately: 14600,
  head_of_household: 21900
};

// 2024 FICA tax rates
const ficaTaxRates = {
  socialSecurity: {
    rate: 6.2, // 6.2%
    wageBase: 168600 // wage base limit for 2024
  },
  medicare: {
    rate: 1.45, // 1.45%
    additionalRate: 0.9, // 0.9% additional Medicare tax on wages over threshold
    threshold: {
      single: 200000,
      married_jointly: 250000,
      married_separately: 125000,
      head_of_household: 200000
    }
  }
};

// Pay period multipliers to convert to annual amounts
const payPeriodMultipliers: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  quarterly: 4,
  annually: 1
};

/**
 * Tax calculation service
 */
export const taxService = {
  /**
   * Calculate federal income tax withholding based on W-4 and income details
   */
  calculateWithholding(
    w4Data: W4FormData,
    incomeDetails: IncomeDetails
  ): WithholdingResult {
    const { filingStatus } = w4Data;
    const { salary, payFrequency, preTaxDeductions = 0 } = incomeDetails;
    
    // Calculate pay period gross income
    const payPeriodGrossIncome = salary;
    
    // Calculate annual gross income
    const annualGrossIncome = salary * payPeriodMultipliers[payFrequency];
    
    // Calculate taxable income (after pre-tax deductions and adjustments)
    const payPeriodTaxableIncome = Math.max(0, payPeriodGrossIncome - preTaxDeductions);
    const annualTaxableIncome = payPeriodTaxableIncome * payPeriodMultipliers[payFrequency];
    
    // Calculate federal withholding using annual tax and dividing by pay periods
    const annualTax = this.calculateIncomeTax(annualTaxableIncome, filingStatus);
    const federalWithholding = annualTax / payPeriodMultipliers[payFrequency];
    
    // Calculate FICA taxes (Social Security and Medicare)
    let socialSecurityTax = payPeriodGrossIncome * (ficaTaxRates.socialSecurity.rate / 100);
    const medicareTax = payPeriodGrossIncome * (ficaTaxRates.medicare.rate / 100);
    
    // Check for Social Security wage base limit (applied on a cumulative basis)
    const annualSocialSecurityWages = Math.min(annualGrossIncome, ficaTaxRates.socialSecurity.wageBase);
    socialSecurityTax = (annualSocialSecurityWages / payPeriodMultipliers[payFrequency]) * (ficaTaxRates.socialSecurity.rate / 100);
    
    // Calculate total taxes and net income
    const totalTaxes = federalWithholding + socialSecurityTax + medicareTax;
    const netIncome = payPeriodGrossIncome - totalTaxes;
    
    // Annual projections
    const annualTaxes = totalTaxes * payPeriodMultipliers[payFrequency];
    const annualNetIncome = annualGrossIncome - annualTaxes;
    const effectiveTaxRate = (annualTaxes / annualGrossIncome) * 100;
    
    return {
      payPeriodGrossIncome,
      federalWithholding,
      socialSecurityTax,
      medicareTax,
      totalTaxes,
      netIncome,
      annualProjection: {
        annualGrossIncome,
        annualTaxes,
        annualNetIncome,
        effectiveTaxRate
      }
    };
  },
  
  /**
   * Calculate income tax based on taxable income and filing status
   */
  calculateIncomeTax(
    taxableIncome: number,
    filingStatus: FilingStatus
  ): number {
    // Get appropriate tax brackets
    const brackets = federalTaxBrackets2024[filingStatus];
    
    let tax = 0;
    let remainingIncome = taxableIncome;
    
    // Calculate tax for each bracket
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const min = bracket.min;
      const max = bracket.max;
      const rate = bracket.rate / 100; // convert percentage to decimal
      
      if (remainingIncome <= 0) break;
      
      // Calculate taxable amount in this bracket
      let taxableInThisBracket;
      if (max === null) {
        // This is the highest bracket
        taxableInThisBracket = remainingIncome;
      } else {
        // Calculate amount taxed in this bracket
        taxableInThisBracket = Math.min(remainingIncome, max - min);
      }
      
      // Add tax for this bracket
      tax += taxableInThisBracket * rate;
      
      // Update remaining income
      remainingIncome -= taxableInThisBracket;
    }
    
    return tax;
  },
  
  /**
   * Calculate marginal tax rate based on income
   */
  calculateMarginalRate(
    taxableIncome: number,
    filingStatus: FilingStatus
  ): number {
    // Get appropriate tax brackets
    const brackets = federalTaxBrackets2024[filingStatus];
    
    // Find the bracket that applies to the income
    for (let i = brackets.length - 1; i >= 0; i--) {
      const bracket = brackets[i];
      if (taxableIncome > bracket.min) {
        return bracket.rate;
      }
    }
    
    return brackets[0].rate; // Default to lowest bracket
  },
  
  /**
   * Calculate a comprehensive tax estimate
   */
  calculateTaxEstimate(
    income: IncomeDetails,
    deductions: DeductionDetails,
    credits: CreditDetails,
    filingStatus: FilingStatus,
    taxYear: number = 2024,
    withholdingToDate: number = 0
  ): TaxEstimate {
    // Calculate total income
    const annualSalary = income.salary * payPeriodMultipliers[income.payFrequency];
    const selfEmploymentIncome = income.selfEmploymentIncome || 0;
    const investmentIncome = income.investmentIncome || 0;
    const otherIncome = income.otherIncome || 0;
    
    const totalIncome = annualSalary + selfEmploymentIncome + investmentIncome + otherIncome;
    
    // Calculate adjustments to income
    const retirement401k = income.retirement401k || 0;
    const traditionalIRA = income.traditionalIRA || 0;
    const hsa = income.hsa || 0;
    const preTaxDeductions = income.preTaxDeductions || 0;
    
    const adjustedGrossIncome = totalIncome - (retirement401k + traditionalIRA + hsa + preTaxDeductions);
    
    // Calculate deductions
    let totalDeductions = 0;
    
    if (deductions.useStandardDeduction) {
      totalDeductions = standardDeduction2024[filingStatus];
    } else {
      const itemizedDeductions = (
        (deductions.mortgageInterest || 0) +
        (deductions.propertyTaxes || 0) +
        (deductions.charitableDonations || 0) +
        (deductions.medicalExpenses || 0) +
        (deductions.studentLoanInterest || 0) +
        (deductions.otherDeductions || 0)
      );
      
      // Use the higher of standard or itemized deductions
      totalDeductions = Math.max(itemizedDeductions, standardDeduction2024[filingStatus]);
    }
    
    // Calculate taxable income
    const taxableIncome = Math.max(0, adjustedGrossIncome - totalDeductions);
    
    // Calculate income tax
    const incomeTax = this.calculateIncomeTax(taxableIncome, filingStatus);
    
    // Calculate self-employment tax (if applicable)
    let selfEmploymentTax = 0;
    if (selfEmploymentIncome > 0) {
      const selfEmploymentTaxableIncome = selfEmploymentIncome * 0.9235; // 92.35% of self-employment income
      const socialSecurityTax = Math.min(selfEmploymentTaxableIncome, ficaTaxRates.socialSecurity.wageBase) * (ficaTaxRates.socialSecurity.rate * 2) / 100;
      const medicareTax = selfEmploymentTaxableIncome * (ficaTaxRates.medicare.rate * 2) / 100;
      selfEmploymentTax = socialSecurityTax + medicareTax;
    }
    
    // Calculate FICA taxes on salary
    const socialSecurityTax = Math.min(annualSalary, ficaTaxRates.socialSecurity.wageBase) * ficaTaxRates.socialSecurity.rate / 100;
    const medicareTax = annualSalary * ficaTaxRates.medicare.rate / 100;
    
    // Calculate tax credits
    const totalCredits = (
      (credits.childTaxCredit || 0) +
      (credits.childAndDependentCare || 0) +
      (credits.educationCredits || 0) +
      (credits.energyCredits || 0) +
      (credits.otherCredits || 0)
    );
    
    // Calculate total tax liability
    const totalTaxLiability = Math.max(0, incomeTax + selfEmploymentTax - totalCredits);
    
    // Calculate refund or amount owed
    const estimatedRefundOrOwed = withholdingToDate - totalTaxLiability;
    
    // Calculate marginal and effective tax rates
    const marginalTaxRate = this.calculateMarginalRate(taxableIncome, filingStatus);
    const effectiveTaxRate = totalTaxLiability / totalIncome * 100;
    
    // Tax breakdown
    const taxBreakdown = {
      federalIncomeTax: incomeTax,
      selfEmploymentTax,
      socialSecurityTax,
      medicareTax,
      stateTax: 0, // Not calculated in this version
      localTax: 0, // Not calculated in this version
    };
    
    return {
      totalIncome,
      adjustedGrossIncome,
      totalDeductions,
      taxableIncome,
      incomeTax,
      selfEmploymentTax,
      totalCredits,
      totalTaxLiability,
      withholdingToDate,
      estimatedRefundOrOwed,
      marginalTaxRate,
      effectiveTaxRate,
      taxBreakdown
    };
  }
};