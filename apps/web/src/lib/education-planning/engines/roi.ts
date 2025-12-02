/**
 * ROI (Return on Investment) Engine
 * Calculates NPV, payback period, lifetime value, and scenario analysis
 */

import type {
  ROIMetrics,
  FinancingBreakdown,
  CareerOutcomes,
  DebtProjection,
  ScenarioAnalysis,
  Scenario,
  DegreeAnalysis,
  ROIEngine as IROIEngine,
} from '../types';

export class ROIEngine implements IROIEngine {
  private readonly DISCOUNT_RATE = 0.03; // 3% real discount rate
  private readonly ANALYSIS_YEARS = 30; // 30-year career analysis
  private readonly BASE_SALARY_NO_DEGREE = 35000; // Baseline without degree

  /**
   * Calculate comprehensive ROI metrics
   */
  calculateROI(
    totalCost: number,
    financingBreakdown: FinancingBreakdown,
    careerOutcomes: CareerOutcomes,
    debtProjection: DebtProjection
  ): ROIMetrics {
    // Calculate NPV of incremental earnings
    const npvIncrementalEarnings = this.calculateIncrementalEarningsNPV(
      careerOutcomes,
      totalCost
    );

    // Calculate payback period (when cumulative earnings - debt = 0)
    const paybackPeriodYears = this.calculatePaybackPeriod(
      careerOutcomes,
      financingBreakdown.totalLoansNeeded,
      debtProjection
    );

    // Calculate break-even year (when NPV becomes positive)
    const breakEvenYear = this.calculateBreakEvenYear(
      careerOutcomes,
      totalCost,
      debtProjection
    );

    // Calculate lifetime net value (NPV of earnings - total cost including interest)
    const lifetimeNetValue = this.calculateLifetimeNetValue(
      careerOutcomes,
      totalCost,
      debtProjection
    );

    // Calculate cumulative ROI over 30 years
    const totalLifetimeEarnings = this.calculateTotalEarnings(careerOutcomes, this.ANALYSIS_YEARS);
    const totalCostWithInterest = totalCost + (debtProjection.totalInterestPaid || 0);
    const cumulativeROI = ((lifetimeNetValue / totalCostWithInterest) * 100);

    return {
      paybackPeriodYears,
      lifetimeNetValue,
      npvIncrementalEarnings,
      breakEvenYear,
      cumulativeROI,
      totalLifetimeEarnings,
    };
  }

  /**
   * Calculate Net Present Value of cash flows
   */
  calculateNPV(cashFlows: number[], discountRate: number = this.DISCOUNT_RATE): number {
    return cashFlows.reduce((npv, cashFlow, year) => {
      return npv + cashFlow / Math.pow(1 + discountRate, year);
    }, 0);
  }

  /**
   * Calculate NPV of incremental earnings vs no degree
   */
  private calculateIncrementalEarningsNPV(
    careerOutcomes: CareerOutcomes,
    totalCost: number
  ): number {
    const cashFlows: number[] = [];

    // Year 0-3 (or program length): Negative cash flows (costs)
    const programLength = careerOutcomes.salaryProgression[0]?.year || 4;
    for (let i = 0; i < programLength; i++) {
      cashFlows.push(-totalCost / programLength);
    }

    // Post-graduation: Incremental earnings
    let yearsSinceGrad = 0;
    for (let year = programLength; year < this.ANALYSIS_YEARS; year++) {
      const degreeEarnings = this.projectSalary(
        careerOutcomes.adjustedStartSalary,
        careerOutcomes.adjustedSalaryGrowth,
        yearsSinceGrad
      );

      const noDegreeEarnings = this.projectSalary(
        this.BASE_SALARY_NO_DEGREE,
        0.02, // 2% growth for non-degree jobs
        yearsSinceGrad
      );

      const incrementalEarning = degreeEarnings - noDegreeEarnings;
      cashFlows.push(incrementalEarning);
      yearsSinceGrad++;
    }

    return this.calculateNPV(cashFlows);
  }

  /**
   * Calculate payback period (years to pay off debt)
   */
  private calculatePaybackPeriod(
    careerOutcomes: CareerOutcomes,
    totalLoanAmount: number,
    debtProjection: DebtProjection
  ): number {
    if (totalLoanAmount === 0) return 0;

    // Monthly payment from debt projection
    const monthlyPayment = debtProjection.monthlyPayment;
    if (!monthlyPayment) return 0;

    // Simple calculation: total debt / monthly payment
    return debtProjection.paybackPeriodMonths / 12;
  }

  /**
   * Calculate break-even year (when cumulative NPV becomes positive)
   */
  private calculateBreakEvenYear(
    careerOutcomes: CareerOutcomes,
    totalCost: number,
    debtProjection: DebtProjection
  ): number {
    let cumulativeNPV = -totalCost;
    let yearsSinceGrad = 0;
    const programLength = 4; // Assume 4 years

    for (let year = 1; year <= this.ANALYSIS_YEARS; year++) {
      if (year <= programLength) {
        // Still in school - accumulating costs
        continue;
      }

      const salary = this.projectSalary(
        careerOutcomes.adjustedStartSalary,
        careerOutcomes.adjustedSalaryGrowth,
        yearsSinceGrad
      );

      // Net earnings (after loan payments if applicable)
      let netEarnings = salary;
      if (debtProjection.monthlyPayment && yearsSinceGrad < debtProjection.paybackPeriodMonths / 12) {
        netEarnings -= debtProjection.monthlyPayment * 12;
      }

      // Discount to present value
      const discountedEarnings = netEarnings / Math.pow(1 + this.DISCOUNT_RATE, year);
      cumulativeNPV += discountedEarnings;

      if (cumulativeNPV >= 0) {
        return year;
      }

      yearsSinceGrad++;
    }

    return this.ANALYSIS_YEARS; // Didn't break even in analysis period
  }

  /**
   * Calculate lifetime net value (NPV)
   */
  private calculateLifetimeNetValue(
    careerOutcomes: CareerOutcomes,
    totalCost: number,
    debtProjection: DebtProjection
  ): number {
    const totalLifetimeEarnings = this.calculateTotalEarnings(
      careerOutcomes,
      this.ANALYSIS_YEARS
    );

    // NPV of earnings
    const earningsNPV = this.calculateEarningsNPV(careerOutcomes, this.ANALYSIS_YEARS);

    // Total cost including interest
    const totalCostWithInterest = totalCost + (debtProjection.totalInterestPaid || 0);

    return earningsNPV - totalCostWithInterest;
  }

  /**
   * Calculate NPV of earnings stream
   */
  private calculateEarningsNPV(careerOutcomes: CareerOutcomes, years: number): number {
    const cashFlows: number[] = [];

    for (let year = 0; year < years; year++) {
      if (year < careerOutcomes.salaryProgression.length) {
        cashFlows.push(careerOutcomes.salaryProgression[year].salary);
      } else {
        // Project beyond 10 years
        const lastSalary = careerOutcomes.salaryProgression[
          careerOutcomes.salaryProgression.length - 1
        ].salary;
        const additionalYears = year - careerOutcomes.salaryProgression.length;
        const projectedSalary = lastSalary * Math.pow(
          1 + careerOutcomes.adjustedSalaryGrowth,
          additionalYears
        );
        cashFlows.push(projectedSalary);
      }
    }

    return this.calculateNPV(cashFlows);
  }

  /**
   * Calculate total earnings over period
   */
  private calculateTotalEarnings(careerOutcomes: CareerOutcomes, years: number): number {
    let total = 0;

    for (let year = 0; year < years; year++) {
      if (year < careerOutcomes.salaryProgression.length) {
        total += careerOutcomes.salaryProgression[year].salary;
      } else {
        // Project beyond 10 years
        const lastSalary = careerOutcomes.salaryProgression[
          careerOutcomes.salaryProgression.length - 1
        ].salary;
        const additionalYears = year - careerOutcomes.salaryProgression.length;
        const projectedSalary = lastSalary * Math.pow(
          1 + careerOutcomes.adjustedSalaryGrowth,
          additionalYears
        );
        total += projectedSalary;
      }
    }

    return total;
  }

  /**
   * Project salary for a given year
   */
  private projectSalary(startingSalary: number, growthRate: number, year: number): number {
    return startingSalary * Math.pow(1 + growthRate, year);
  }

  /**
   * Run scenario analysis with different assumptions
   */
  runScenarioAnalysis(baseAnalysis: DegreeAnalysis): ScenarioAnalysis {
    // Conservative: Lower salary growth, higher inflation, lower placement
    const conservative = this.runScenario(
      baseAnalysis,
      {
        salaryGrowth: baseAnalysis.careerOutcomes!.adjustedSalaryGrowth * 0.7,
        placementRate: baseAnalysis.careerOutcomes!.adjustedPlacementRate * 0.9,
        inflationRate: 0.035,
      },
      'Conservative'
    );

    // Base: Expected case
    const base = this.runScenario(
      baseAnalysis,
      {
        salaryGrowth: baseAnalysis.careerOutcomes!.adjustedSalaryGrowth,
        placementRate: baseAnalysis.careerOutcomes!.adjustedPlacementRate,
        inflationRate: 0.03,
      },
      'Base'
    );

    // Optimistic: Higher growth, better placement
    const optimistic = this.runScenario(
      baseAnalysis,
      {
        salaryGrowth: baseAnalysis.careerOutcomes!.adjustedSalaryGrowth * 1.3,
        placementRate: Math.min(0.98, baseAnalysis.careerOutcomes!.adjustedPlacementRate * 1.1),
        inflationRate: 0.025,
      },
      'Optimistic'
    );

    return { conservative, base, optimistic };
  }

  /**
   * Run single scenario with specific assumptions
   */
  private runScenario(
    baseAnalysis: DegreeAnalysis,
    assumptions: {
      salaryGrowth: number;
      placementRate: number;
      inflationRate: number;
    },
    name: string
  ): Scenario {
    // Adjust career outcomes
    const adjustedOutcomes: CareerOutcomes = {
      ...baseAnalysis.careerOutcomes!,
      adjustedSalaryGrowth: assumptions.salaryGrowth,
      adjustedPlacementRate: assumptions.placementRate,
    };

    // Recalculate ROI with adjusted outcomes
    const roiMetrics = this.calculateROI(
      baseAnalysis.totalCostOfAttendance,
      baseAnalysis.financingBreakdown!,
      adjustedOutcomes,
      baseAnalysis.debtProjection!
    );

    // Risk adjustment based on deviation from base
    const riskAdjustment = name === 'Conservative' ? -0.15 : name === 'Optimistic' ? 0.15 : 0;

    return {
      name,
      assumptions,
      roi: roiMetrics.cumulativeROI,
      paybackYears: roiMetrics.paybackPeriodYears,
      netValue: roiMetrics.lifetimeNetValue,
      riskAdjustment,
    };
  }

  /**
   * Calculate debt service burden as % of salary
   */
  calculateDebtServiceRatio(
    monthlyPayment: number,
    annualSalary: number
  ): number {
    const annualPayment = monthlyPayment * 12;
    return (annualPayment / annualSalary) * 100;
  }

  /**
   * Calculate loan payment using standard amortization formula
   */
  calculateLoanPayment(
    principal: number,
    annualInterestRate: number,
    years: number
  ): {
    monthlyPayment: number;
    totalInterest: number;
    totalRepayment: number;
  } {
    if (principal === 0) {
      return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0 };
    }

    const monthlyRate = annualInterestRate / 12;
    const numPayments = years * 12;

    // Monthly payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalRepayment = monthlyPayment * numPayments;
    const totalInterest = totalRepayment - principal;

    return {
      monthlyPayment,
      totalInterest,
      totalRepayment,
    };
  }
}

// Singleton instance
export const roiEngine = new ROIEngine();
