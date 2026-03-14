/**
 * Follow-On Program Access Score (FPAS) Engine
 * Calculates probability of admission to graduate/professional programs
 * and expected value adjustments for students planning advanced degrees
 */

import type {
  DegreeProgram,
  StudentProfile,
  LongTermGoalType,
  ProgramTier,
  FPASMetrics,
} from '../types';

export interface FPASCalculation {
  fpasMultiplier: number; // 0.5-2.0
  admissionProbability: number; // 0.0-1.0
  expectedTierAdmission: string; // "top_10", "top_25", etc.
  reasoning: string;
}

export interface ExpectedValueOutcome {
  withGradSchool: {
    probability: number;
    lifetimeEarnings: number;
    roi: number;
  };
  withoutGradSchool: {
    probability: number;
    lifetimeEarnings: number;
    roi: number;
  };
  expectedValue: number;
  recommendation: string;
}

export class FPASEngine {
  /**
   * Calculate FPAS-adjusted admission probability
   */
  calculateAdmissionProbability(
    degreeProgram: DegreeProgram,
    studentProfile: StudentProfile,
    longTermGoalType: LongTermGoalType
  ): FPASCalculation {
    if (!studentProfile.hasLongTermGoal || longTermGoalType === 'none') {
      return {
        fpasMultiplier: 1.0,
        admissionProbability: 0,
        expectedTierAdmission: 'none',
        reasoning: 'No long-term graduate program goal specified.',
      };
    }

    // Get base FPAS score for this goal type
    const baseFPAS = this.getBaseFPAS(degreeProgram, longTermGoalType);

    // Get baseline admission rates by tier
    const baseRates = this.getBaseAdmissionRates(
      longTermGoalType,
      studentProfile.targetProgramTier || 'any'
    );

    // Calculate GPA adjustment factor
    const gpaAdjustment = this.calculateGPAAdjustment(studentProfile.targetGPA, longTermGoalType);

    // Calculate test score adjustment (if provided)
    const testScoreAdjustment = this.calculateTestScoreAdjustment(
      studentProfile.targetTestScore,
      longTermGoalType
    );

    // Combined probability calculation
    // P_accept = base_rate * FPAS * gpa_factor * test_factor
    const admissionProbability = Math.min(
      0.95, // Cap at 95%
      baseRates.baseRate * baseFPAS * gpaAdjustment * testScoreAdjustment
    );

    // Determine expected tier admission
    const expectedTier = this.determineExpectedTier(
      admissionProbability,
      longTermGoalType,
      baseFPAS
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      degreeProgram,
      longTermGoalType,
      baseFPAS,
      admissionProbability,
      expectedTier
    );

    return {
      fpasMultiplier: baseFPAS,
      admissionProbability,
      expectedTierAdmission: expectedTier,
      reasoning,
    };
  }

  /**
   * Calculate expected value considering grad school outcomes
   */
  calculateExpectedValue(
    undergradLifetimeEarnings: number,
    undergradROI: number,
    admissionProbability: number,
    longTermGoalType: LongTermGoalType,
    targetTier: ProgramTier
  ): ExpectedValueOutcome {
    // Get expected grad school outcomes
    const gradOutcomes = this.getGradSchoolOutcomes(longTermGoalType, targetTier);

    // Scenario 1: Get into grad school
    const withGradSchool = {
      probability: admissionProbability,
      lifetimeEarnings: gradOutcomes.lifetimeEarnings,
      roi: gradOutcomes.roi,
    };

    // Scenario 2: Don't get into grad school (undergrad only)
    const withoutGradSchool = {
      probability: 1 - admissionProbability,
      lifetimeEarnings: undergradLifetimeEarnings,
      roi: undergradROI,
    };

    // Expected value calculation
    const expectedValue =
      withGradSchool.probability * withGradSchool.lifetimeEarnings +
      withoutGradSchool.probability * withoutGradSchool.lifetimeEarnings;

    // Generate recommendation
    const recommendation = this.generateExpectedValueRecommendation(
      withGradSchool,
      withoutGradSchool,
      expectedValue,
      longTermGoalType
    );

    return {
      withGradSchool,
      withoutGradSchool,
      expectedValue,
      recommendation,
    };
  }

  /**
   * Get base FPAS score from degree program
   */
  private getBaseFPAS(degreeProgram: DegreeProgram, goalType: LongTermGoalType): number {
    switch (goalType) {
      case 'jd':
        return degreeProgram.fpasLawSchool || 1.0;
      case 'md':
        return degreeProgram.fpasMedSchool || 1.0;
      case 'mba':
        return degreeProgram.fpasMBA || 1.0;
      case 'phd':
        return degreeProgram.fpasPhD || 1.0;
      case 'masters':
        return degreeProgram.fpasMasters || 1.0;
      default:
        return 1.0;
    }
  }

  /**
   * Get baseline admission rates by program type and tier
   */
  private getBaseAdmissionRates(
    goalType: LongTermGoalType,
    tier: ProgramTier
  ): {
    baseRate: number;
    tierName: string;
  } {
    const rates: Record<
      LongTermGoalType,
      Record<ProgramTier, { baseRate: number; tierName: string }>
    > = {
      jd: {
        top_10: { baseRate: 0.15, tierName: 'T14 Law Schools' },
        top_25: { baseRate: 0.3, tierName: 'T50 Law Schools' },
        top_50: { baseRate: 0.5, tierName: 'T100 Law Schools' },
        any: { baseRate: 0.7, tierName: 'Any ABA Law School' },
      },
      md: {
        top_10: { baseRate: 0.05, tierName: 'Top 10 Medical Schools' },
        top_25: { baseRate: 0.1, tierName: 'Top 25 Medical Schools' },
        top_50: { baseRate: 0.2, tierName: 'Top 50 Medical Schools' },
        any: { baseRate: 0.41, tierName: 'Any MD Program' }, // National average
      },
      mba: {
        top_10: { baseRate: 0.12, tierName: 'M7 MBA Programs' },
        top_25: { baseRate: 0.25, tierName: 'T15 MBA Programs' },
        top_50: { baseRate: 0.4, tierName: 'T50 MBA Programs' },
        any: { baseRate: 0.6, tierName: 'Any MBA Program' },
      },
      phd: {
        top_10: { baseRate: 0.1, tierName: 'Top 10 PhD Programs' },
        top_25: { baseRate: 0.2, tierName: 'Top 25 PhD Programs' },
        top_50: { baseRate: 0.35, tierName: 'Top 50 PhD Programs' },
        any: { baseRate: 0.55, tierName: 'Any PhD Program' },
      },
      masters: {
        top_10: { baseRate: 0.15, tierName: 'Top 10 Masters Programs' },
        top_25: { baseRate: 0.3, tierName: 'Top 25 Masters Programs' },
        top_50: { baseRate: 0.5, tierName: 'Top 50 Masters Programs' },
        any: { baseRate: 0.7, tierName: 'Any Masters Program' },
      },
      none: {
        top_10: { baseRate: 0, tierName: 'None' },
        top_25: { baseRate: 0, tierName: 'None' },
        top_50: { baseRate: 0, tierName: 'None' },
        any: { baseRate: 0, tierName: 'None' },
      },
    };

    return rates[goalType]?.[tier] || { baseRate: 0, tierName: 'Unknown' };
  }

  /**
   * Calculate GPA adjustment factor
   * Higher GPA = higher multiplier
   */
  private calculateGPAAdjustment(targetGPA?: number, goalType?: LongTermGoalType): number {
    if (!targetGPA) return 1.0;

    // GPA thresholds by program type
    const thresholds: Record<string, { excellent: number; good: number; minimum: number }> = {
      jd: { excellent: 3.8, good: 3.5, minimum: 3.0 },
      md: { excellent: 3.9, good: 3.7, minimum: 3.5 },
      mba: { excellent: 3.7, good: 3.4, minimum: 3.0 },
      phd: { excellent: 3.9, good: 3.7, minimum: 3.3 },
      masters: { excellent: 3.7, good: 3.3, minimum: 3.0 },
    };

    const threshold = thresholds[goalType || 'masters'];
    if (!threshold) return 1.0;

    if (targetGPA >= threshold.excellent) return 1.5; // 50% boost
    if (targetGPA >= threshold.good) return 1.2; // 20% boost
    if (targetGPA >= threshold.minimum) return 1.0; // Neutral
    if (targetGPA >= threshold.minimum - 0.2) return 0.7; // Below minimum
    return 0.4; // Significantly below minimum
  }

  /**
   * Calculate test score adjustment factor
   */
  private calculateTestScoreAdjustment(
    testScore?: { testType: string; targetScore: number; percentile?: number },
    goalType?: LongTermGoalType
  ): number {
    if (!testScore || !testScore.percentile) return 1.0;

    const percentile = testScore.percentile;

    // Percentile-based multipliers
    if (percentile >= 95) return 1.6; // Top 5%
    if (percentile >= 90) return 1.4; // Top 10%
    if (percentile >= 80) return 1.2; // Top 20%
    if (percentile >= 70) return 1.1; // Top 30%
    if (percentile >= 50) return 1.0; // Median
    if (percentile >= 30) return 0.8; // Below median
    return 0.6; // Bottom 30%
  }

  /**
   * Determine expected tier admission based on probability
   */
  private determineExpectedTier(
    probability: number,
    goalType: LongTermGoalType,
    fpas: number
  ): string {
    if (probability >= 0.6) {
      if (fpas >= 1.5) return 'top_10';
      if (fpas >= 1.3) return 'top_25';
      return 'top_50';
    } else if (probability >= 0.4) {
      if (fpas >= 1.3) return 'top_25';
      return 'top_50';
    } else if (probability >= 0.2) {
      return 'top_50';
    }
    return 'any';
  }

  /**
   * Generate reasoning for FPAS calculation
   */
  private generateReasoning(
    degreeProgram: DegreeProgram,
    goalType: LongTermGoalType,
    fpas: number,
    probability: number,
    expectedTier: string
  ): string {
    const school = (degreeProgram as any).school
      ? (degreeProgram as any).school.name
      : 'this program';

    let reasoning = `${school} `;

    // FPAS assessment
    if (fpas >= 1.5) {
      reasoning += 'is a premier feeder school for ';
    } else if (fpas >= 1.2) {
      reasoning += 'has strong placement into ';
    } else if (fpas >= 1.0) {
      reasoning += 'provides standard access to ';
    } else {
      reasoning += 'has limited placement into ';
    }

    // Goal type
    const goalNames: Record<LongTermGoalType, string> = {
      jd: 'law schools',
      md: 'medical schools',
      mba: 'MBA programs',
      phd: 'PhD programs',
      masters: 'graduate programs',
      none: '',
    };
    reasoning += goalNames[goalType] + '. ';

    // Probability assessment
    if (probability >= 0.6) {
      reasoning += `You have a strong chance (${Math.round(
        probability * 100
      )}%) of admission to ${expectedTier.replace('_', ' ')} programs`;
    } else if (probability >= 0.4) {
      reasoning += `You have a moderate chance (${Math.round(
        probability * 100
      )}%) of admission to ${expectedTier.replace('_', ' ')} programs`;
    } else if (probability >= 0.2) {
      reasoning += `You have a fair chance (${Math.round(
        probability * 100
      )}%) of admission to ${expectedTier.replace('_', ' ')} programs`;
    } else {
      reasoning += `Admission to competitive programs may be challenging (${Math.round(
        probability * 100
      )}% probability)`;
    }

    reasoning += ' with your expected academic performance.';

    return reasoning;
  }

  /**
   * Get expected grad school outcomes by type and tier
   */
  private getGradSchoolOutcomes(
    goalType: LongTermGoalType,
    tier: ProgramTier
  ): {
    lifetimeEarnings: number;
    roi: number;
    additionalCost: number;
  } {
    // Simplified outcomes - would be much more detailed in production
    const outcomes: Record<
      LongTermGoalType,
      Record<ProgramTier, { lifetimeEarnings: number; roi: number; additionalCost: number }>
    > = {
      jd: {
        top_10: { lifetimeEarnings: 8000000, roi: 250, additionalCost: 300000 },
        top_25: { lifetimeEarnings: 6000000, roi: 180, additionalCost: 250000 },
        top_50: { lifetimeEarnings: 4500000, roi: 120, additionalCost: 220000 },
        any: { lifetimeEarnings: 3500000, roi: 80, additionalCost: 200000 },
      },
      md: {
        top_10: { lifetimeEarnings: 12000000, roi: 300, additionalCost: 400000 },
        top_25: { lifetimeEarnings: 10000000, roi: 280, additionalCost: 380000 },
        top_50: { lifetimeEarnings: 9000000, roi: 250, additionalCost: 360000 },
        any: { lifetimeEarnings: 8000000, roi: 220, additionalCost: 350000 },
      },
      mba: {
        top_10: { lifetimeEarnings: 10000000, roi: 400, additionalCost: 250000 },
        top_25: { lifetimeEarnings: 7000000, roi: 280, additionalCost: 200000 },
        top_50: { lifetimeEarnings: 5500000, roi: 180, additionalCost: 150000 },
        any: { lifetimeEarnings: 4500000, roi: 120, additionalCost: 100000 },
      },
      phd: {
        top_10: { lifetimeEarnings: 5000000, roi: 150, additionalCost: 50000 }, // Usually funded
        top_25: { lifetimeEarnings: 4200000, roi: 130, additionalCost: 50000 },
        top_50: { lifetimeEarnings: 3800000, roi: 110, additionalCost: 50000 },
        any: { lifetimeEarnings: 3200000, roi: 90, additionalCost: 50000 },
      },
      masters: {
        top_10: { lifetimeEarnings: 5500000, roi: 180, additionalCost: 120000 },
        top_25: { lifetimeEarnings: 4800000, roi: 150, additionalCost: 100000 },
        top_50: { lifetimeEarnings: 4200000, roi: 120, additionalCost: 80000 },
        any: { lifetimeEarnings: 3800000, roi: 100, additionalCost: 60000 },
      },
      none: {
        top_10: { lifetimeEarnings: 0, roi: 0, additionalCost: 0 },
        top_25: { lifetimeEarnings: 0, roi: 0, additionalCost: 0 },
        top_50: { lifetimeEarnings: 0, roi: 0, additionalCost: 0 },
        any: { lifetimeEarnings: 0, roi: 0, additionalCost: 0 },
      },
    };

    return (
      outcomes[goalType]?.[tier] || {
        lifetimeEarnings: 0,
        roi: 0,
        additionalCost: 0,
      }
    );
  }

  /**
   * Generate expected value recommendation
   */
  private generateExpectedValueRecommendation(
    withGrad: { probability: number; lifetimeEarnings: number; roi: number },
    withoutGrad: { probability: number; lifetimeEarnings: number; roi: number },
    expectedValue: number,
    goalType: LongTermGoalType
  ): string {
    const gradBoost = withGrad.lifetimeEarnings - withoutGrad.lifetimeEarnings;
    const percentBoost = ((gradBoost / withoutGrad.lifetimeEarnings) * 100).toFixed(0);

    let recommendation = `If you pursue ${goalType.toUpperCase()}, your expected lifetime earnings increase by $${Math.round(
      gradBoost
    ).toLocaleString()} (${percentBoost}% boost). `;

    if (withGrad.probability >= 0.6) {
      recommendation += `With a ${Math.round(
        withGrad.probability * 100
      )}% admission probability, this path is financially promising. `;
    } else if (withGrad.probability >= 0.4) {
      recommendation += `With a ${Math.round(
        withGrad.probability * 100
      )}% admission probability, this path carries moderate risk. `;
    } else {
      recommendation += `With only a ${Math.round(
        withGrad.probability * 100
      )}% admission probability, there's significant risk you end up with undergrad-only outcomes. `;
    }

    recommendation += `Expected value: $${Math.round(expectedValue).toLocaleString()}.`;

    return recommendation;
  }

  /**
   * Calculate tier-specific FPAS from metrics
   */
  calculateFPASFromMetrics(metrics: FPASMetrics, goalType: LongTermGoalType): number {
    let fpas = 1.0;

    switch (goalType) {
      case 'jd':
        if (metrics.lawT14Rate && metrics.lawT14Rate > 0.15) {
          fpas = 1.0 + (metrics.lawT14Rate - 0.15) * 3; // Scale up from baseline
        } else if (metrics.lawT50Rate && metrics.lawT50Rate > 0.3) {
          fpas = 1.0 + (metrics.lawT50Rate - 0.3) * 1.5;
        }
        break;

      case 'md':
        if (metrics.medTopTierRate && metrics.medTopTierRate > 0.1) {
          fpas = 1.0 + (metrics.medTopTierRate - 0.1) * 4;
        } else if (metrics.medMatchRate && metrics.medMatchRate > 0.85) {
          fpas = 1.0 + (metrics.medMatchRate - 0.85) * 2;
        }
        break;

      case 'mba':
        if (metrics.mbaM7Rate && metrics.mbaM7Rate > 0.12) {
          fpas = 1.0 + (metrics.mbaM7Rate - 0.12) * 4;
        } else if (metrics.mbaT15Rate && metrics.mbaT15Rate > 0.25) {
          fpas = 1.0 + (metrics.mbaT15Rate - 0.25) * 2;
        }
        break;

      case 'phd':
        if (metrics.phdTopProgramRate && metrics.phdTopProgramRate > 0.1) {
          fpas = 1.0 + (metrics.phdTopProgramRate - 0.1) * 3;
        }
        break;

      case 'masters':
        if (metrics.gradSchoolPlacementRate && metrics.gradSchoolPlacementRate > 0.5) {
          fpas = 1.0 + (metrics.gradSchoolPlacementRate - 0.5) * 1.5;
        }
        break;
    }

    // Cap at 2.0
    return Math.min(2.0, Math.max(0.5, fpas));
  }
}

// Singleton instance
export const fpasEngine = new FPASEngine();
