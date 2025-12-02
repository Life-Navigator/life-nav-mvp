/**
 * Career Outcomes Engine
 * Calculates career outcomes with Alumni Network Impact Score (ANIS) adjustments
 */

import type {
  CareerOutcomes,
  DegreeAnalysisInput,
  DegreeProgram,
  NetworkPriority,
  DegreeType,
  SalaryProjection,
  BaseCareerMetrics,
  ANISData,
  CareerOutcomesEngine as ICareerOutcomesEngine,
  ANISCalculator as IANISCalculator,
  NetworkMetrics,
} from '../types';

import {
  NETWORK_CRITICAL_DEGREES,
  NETWORK_IMPORTANT_DEGREES,
  NETWORK_LOW_DEGREES,
} from '../types';

/**
 * Alumni Network Impact Score (ANIS) Calculator
 * Quantifies alumni network and brand strength
 */
export class ANISCalculator implements IANISCalculator {
  /**
   * Calculate ANIS from network metrics
   * Returns score in range 0.8 - 1.5 (1.0 = average)
   */
  calculateANIS(metrics: NetworkMetrics): number {
    // Weighted components of ANIS
    const weights = {
      alumniReach: 0.2, // Network size & density
      placementPower: 0.3, // % into target firms
      leadershipInfluence: 0.2, // % in senior roles
      brandPremium: 0.15, // Market perception
      engagement: 0.15, // Active alumni support
    };

    // Normalize each component to 0-1 scale
    const alumniReachScore = this.normalizeAlumniReach(
      metrics.alumniCount,
      metrics.networkDensityScore
    );
    const placementScore = metrics.placementPower / 100; // Already percentage
    const leadershipScore = metrics.alumniLeadershipPct / 100;
    const brandScore = metrics.brandPremiumScore / 100;
    const engagementScore = metrics.engagementScore / 100;

    // Calculate weighted average (0-1 scale)
    const normalizedScore =
      alumniReachScore * weights.alumniReach +
      placementScore * weights.placementPower +
      leadershipScore * weights.leadershipInfluence +
      brandScore * weights.brandPremium +
      engagementScore * weights.engagement;

    // Map to 0.8-1.5 range
    // 0.0 → 0.8 (weak network)
    // 0.5 → 1.0 (average)
    // 1.0 → 1.5 (elite network)
    const anisScore = 0.8 + normalizedScore * 0.7;

    return Math.max(0.8, Math.min(1.5, anisScore));
  }

  /**
   * Normalize alumni reach based on absolute count and density
   */
  private normalizeAlumniReach(alumniCount: number, densityScore: number): number {
    // Log scale for alumni count (10k = 0.5, 100k = 1.0)
    const countScore = Math.min(1.0, Math.log10(alumniCount / 10000) + 0.5);

    // Density already 0-1 scale
    const density = densityScore / 100;

    // Average of both
    return (countScore + density) / 2;
  }

  /**
   * Get ANIS multiplier factors based on degree type
   * Different degree types have different sensitivity to network effects
   */
  getANISFactors(
    anisScore: number,
    degreeType: DegreeType
  ): {
    jobFactor: number;
    salaryAlpha: number;
    growthBeta: number;
    underemployGamma: number;
  } {
    const networkImportance = this.getNetworkImportance(degreeType);

    // ANIS deviation from neutral (1.0)
    const delta = anisScore - 1.0;

    let jobFactor: number;
    let salaryAlpha: number;
    let growthBeta: number;
    let underemployGamma: number;

    switch (networkImportance) {
      case 'high':
        // Network-critical degrees (JD, MBA, MD)
        // High sensitivity to network effects
        jobFactor = 1.0 + delta * 0.8; // 0.84 - 1.40
        salaryAlpha = 0.5; // 50% of delta applies to salary
        growthBeta = 0.4; // 40% applies to growth rate
        underemployGamma = 0.6; // Strong effect on reducing underemployment
        break;

      case 'medium':
        // Network-important degrees (Bachelors, Masters, some STEM)
        // Moderate sensitivity
        jobFactor = 1.0 + delta * 0.5; // 0.90 - 1.25
        salaryAlpha = 0.3; // 30% to salary
        growthBeta = 0.25; // 25% to growth
        underemployGamma = 0.4; // Moderate effect
        break;

      case 'low':
        // Network-low degrees (Associates, Certificates, vocational)
        // Low sensitivity - skill matters more than network
        jobFactor = 1.0 + delta * 0.2; // 0.96 - 1.10
        salaryAlpha = 0.1; // 10% to salary
        growthBeta = 0.1; // 10% to growth
        underemployGamma = 0.2; // Weak effect
        break;

      default:
        jobFactor = 1.0;
        salaryAlpha = 0.0;
        growthBeta = 0.0;
        underemployGamma = 0.0;
    }

    return {
      jobFactor,
      salaryAlpha,
      growthBeta,
      underemployGamma,
    };
  }

  /**
   * Determine network importance category for degree type
   */
  private getNetworkImportance(degreeType: DegreeType): 'high' | 'medium' | 'low' {
    if (NETWORK_CRITICAL_DEGREES.includes(degreeType)) {
      return 'high';
    } else if (NETWORK_IMPORTANT_DEGREES.includes(degreeType)) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

/**
 * Career Outcomes Engine
 */
export class CareerOutcomesEngine implements ICareerOutcomesEngine {
  private anisCalculator: ANISCalculator;

  constructor() {
    this.anisCalculator = new ANISCalculator();
  }

  /**
   * Calculate career outcomes with ANIS adjustments
   */
  calculateOutcomes(
    input: DegreeAnalysisInput,
    degreeProgram?: DegreeProgram,
    networkPriority: NetworkPriority = 'medium'
  ): CareerOutcomes {
    // Base metrics from input or degree program
    const baseMetrics: BaseCareerMetrics = {
      startSalary: input.expectedStartSalary,
      salaryGrowth: input.expectedSalaryGrowth,
      placementRate: input.expectedJobPlacementRate,
      underemploymentRate: degreeProgram?.underemploymentRate || 0.15, // 15% default
    };

    // If no degree program or ANIS score is 1.0, return base metrics
    if (!degreeProgram || degreeProgram.anisScore === 1.0) {
      return this.buildCareerOutcomes(baseMetrics);
    }

    // Apply ANIS adjustments
    const anisData: ANISData = {
      anisScore: degreeProgram.anisScore,
      anisJobFactor: degreeProgram.anisJobFactor,
      anisSalaryAlpha: degreeProgram.anisSalaryAlpha,
      anisGrowthBeta: degreeProgram.anisGrowthBeta,
      anisUnderemployGamma: degreeProgram.anisUnderemployGamma,
    };

    return this.applyANIS(baseMetrics, anisData, networkPriority);
  }

  /**
   * Apply ANIS adjustments to base career metrics
   */
  applyANIS(
    baseMetrics: BaseCareerMetrics,
    anisData: ANISData,
    networkPriority: NetworkPriority
  ): CareerOutcomes {
    // User network priority affects how heavily ANIS is applied
    const priorityMultiplier = this.getNetworkPriorityMultiplier(networkPriority);

    // Job Placement Rate adjustment
    const adjustedPlacementRate = Math.min(
      0.98, // Cap at 98%
      baseMetrics.placementRate * anisData.anisJobFactor * priorityMultiplier
    );

    // Starting Salary adjustment
    // Formula: start_salary_effective = start_salary_base * (1 + alpha * (ANIS - 1))
    const salaryMultiplier =
      1 + anisData.anisSalaryAlpha * (anisData.anisScore - 1) * priorityMultiplier;
    const adjustedStartSalary = baseMetrics.startSalary * salaryMultiplier;

    // Salary Growth Rate adjustment
    const growthMultiplier =
      1 + anisData.anisGrowthBeta * (anisData.anisScore - 1) * priorityMultiplier;
    const adjustedSalaryGrowth = baseMetrics.salaryGrowth * growthMultiplier;

    // Underemployment Rate adjustment (inverse - higher ANIS = lower underemployment)
    const underemploymentDivisor =
      1 + anisData.anisUnderemployGamma * (anisData.anisScore - 1) * priorityMultiplier;
    const adjustedUnderemploymentRate = Math.max(
      0.02, // Floor at 2%
      baseMetrics.underemploymentRate / underemploymentDivisor
    );

    return this.buildCareerOutcomes({
      startSalary: adjustedStartSalary,
      salaryGrowth: adjustedSalaryGrowth,
      placementRate: adjustedPlacementRate,
      underemploymentRate: adjustedUnderemploymentRate,
    });
  }

  /**
   * Get multiplier based on user's network priority setting
   */
  private getNetworkPriorityMultiplier(priority: NetworkPriority): number {
    switch (priority) {
      case 'high':
        return 1.0; // Full ANIS effect
      case 'medium':
        return 0.7; // 70% of ANIS effect
      case 'low':
        return 0.4; // 40% of ANIS effect
      default:
        return 0.7;
    }
  }

  /**
   * Build full career outcomes with salary progression
   */
  private buildCareerOutcomes(metrics: BaseCareerMetrics): CareerOutcomes {
    // Project salary over 10 years
    const salaryProgression: SalaryProjection[] = [];
    let currentSalary = metrics.startSalary;
    let cumulativeEarnings = 0;

    for (let year = 1; year <= 10; year++) {
      cumulativeEarnings += currentSalary;

      salaryProgression.push({
        year,
        salary: currentSalary,
        cumulativeEarnings,
      });

      // Apply growth for next year
      currentSalary *= 1 + metrics.salaryGrowth;
    }

    return {
      adjustedStartSalary: metrics.startSalary,
      adjustedSalaryGrowth: metrics.salaryGrowth,
      adjustedPlacementRate: metrics.placementRate,
      adjustedUnderemploymentRate: metrics.underemploymentRate,
      salaryProgression,
    };
  }

  /**
   * Calculate expected value of career outcomes
   * Factors in placement probability and underemployment risk
   */
  calculateExpectedValue(outcomes: CareerOutcomes): number {
    const fullEmploymentValue =
      outcomes.salaryProgression[outcomes.salaryProgression.length - 1].cumulativeEarnings;

    // Adjust for placement rate
    const placementAdjusted = fullEmploymentValue * outcomes.adjustedPlacementRate;

    // Adjust for underemployment (assume 60% salary if underemployed)
    const underemploymentPenalty =
      fullEmploymentValue * outcomes.adjustedUnderemploymentRate * 0.4;

    return placementAdjusted - underemploymentPenalty;
  }
}

// Singleton instances
export const anisCalculator = new ANISCalculator();
export const careerOutcomesEngine = new CareerOutcomesEngine();
