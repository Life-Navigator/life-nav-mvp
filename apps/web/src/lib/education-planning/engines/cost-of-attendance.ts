/**
 * Cost of Attendance (COA) Engine
 * Multi-year cost projections with inflation modeling
 */

import type {
  YearlyCost,
  DegreeAnalysisInput,
  CostOfAttendanceEngine as ICostOfAttendanceEngine,
} from '../types';

export class CostOfAttendanceEngine implements ICostOfAttendanceEngine {
  /**
   * Calculate total cost of attendance with year-by-year breakdown
   */
  calculateTotalCOA(input: DegreeAnalysisInput): YearlyCost[] {
    const programLength = input.customProgramLength || 4;
    const tuitionInflation = input.tuitionInflation || 0.03;
    const coaInflation = input.coaInflation || 0.025;

    const yearlyCosts: YearlyCost[] = [];

    for (let year = 1; year <= programLength; year++) {
      // Apply inflation to each cost component
      const tuition = this.applyInflation(input.tuition, year, tuitionInflation);
      const fees = this.applyInflation(input.fees, year, tuitionInflation);
      const roomBoard = this.applyInflation(input.roomBoard, year, coaInflation);
      const books = this.applyInflation(input.books, year, coaInflation);
      const otherExpenses = this.applyInflation(input.otherExpenses, year, coaInflation);

      const totalCOA = tuition + fees + roomBoard + books + otherExpenses;

      // Financial aid (assumed constant for now, could add growth)
      const scholarships = input.scholarships || 0;
      const grants = input.grants || 0;

      const netCost = Math.max(0, totalCOA - scholarships - grants);

      yearlyCosts.push({
        year,
        tuition,
        fees,
        roomBoard,
        books,
        otherExpenses,
        totalCOA,
        scholarships,
        grants,
        netCost,
      });
    }

    return yearlyCosts;
  }

  /**
   * Apply compound inflation to a base cost
   */
  applyInflation(baseCost: number, year: number, inflationRate: number): number {
    // Year 1 = no inflation (base year)
    // Year 2 = one year of inflation, etc.
    return baseCost * Math.pow(1 + inflationRate, year - 1);
  }

  /**
   * Calculate total COA across all years
   */
  getTotalCOA(yearlyCosts: YearlyCost[]): number {
    return yearlyCosts.reduce((sum, year) => sum + year.totalCOA, 0);
  }

  /**
   * Calculate total net cost (after aid) across all years
   */
  getTotalNetCost(yearlyCosts: YearlyCost[]): number {
    return yearlyCosts.reduce((sum, year) => sum + year.netCost, 0);
  }

  /**
   * Project costs with different inflation scenarios
   */
  projectWithScenarios(
    input: DegreeAnalysisInput
  ): {
    conservative: YearlyCost[];
    base: YearlyCost[];
    optimistic: YearlyCost[];
  } {
    // Conservative: Higher inflation
    const conservative = this.calculateTotalCOA({
      ...input,
      tuitionInflation: (input.tuitionInflation || 0.03) * 1.5, // 4.5%
      coaInflation: (input.coaInflation || 0.025) * 1.3, // 3.25%
    });

    // Base: Expected inflation
    const base = this.calculateTotalCOA(input);

    // Optimistic: Lower inflation
    const optimistic = this.calculateTotalCOA({
      ...input,
      tuitionInflation: (input.tuitionInflation || 0.03) * 0.7, // 2.1%
      coaInflation: (input.coaInflation || 0.025) * 0.8, // 2%
    });

    return { conservative, base, optimistic };
  }

  /**
   * Calculate average yearly cost
   */
  getAverageYearlyCost(yearlyCosts: YearlyCost[]): number {
    const total = this.getTotalCOA(yearlyCosts);
    return total / yearlyCosts.length;
  }

  /**
   * Get cost breakdown by category
   */
  getCostBreakdown(yearlyCosts: YearlyCost[]): {
    tuition: number;
    fees: number;
    roomBoard: number;
    books: number;
    otherExpenses: number;
    totalAid: number;
  } {
    const breakdown = yearlyCosts.reduce(
      (acc, year) => ({
        tuition: acc.tuition + year.tuition,
        fees: acc.fees + year.fees,
        roomBoard: acc.roomBoard + year.roomBoard,
        books: acc.books + year.books,
        otherExpenses: acc.otherExpenses + year.otherExpenses,
        totalAid: acc.totalAid + year.scholarships + year.grants,
      }),
      {
        tuition: 0,
        fees: 0,
        roomBoard: 0,
        books: 0,
        otherExpenses: 0,
        totalAid: 0,
      }
    );

    return breakdown;
  }
}

// Singleton instance
export const costOfAttendanceEngine = new CostOfAttendanceEngine();
