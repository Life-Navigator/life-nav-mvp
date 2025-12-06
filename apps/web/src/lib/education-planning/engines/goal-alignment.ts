/**
 * Goal Alignment Engine
 * Integrates education planning with LifeNavigator goals
 * Shows how degree choice accelerates or delays life goals
 */

import type {
  DegreeAnalysis,
  GoalImpact,
  GoalAlignmentEngine as IGoalAlignmentEngine,
} from '../types';

import type { Goal } from '@/lib/goals/types';

export class GoalAlignmentEngine implements IGoalAlignmentEngine {
  /**
   * Calculate goal alignment score and impact analysis
   */
  calculateAlignment(
    degreeAnalysis: DegreeAnalysis,
    userGoals: Goal[]
  ): {
    score: number;
    impacts: GoalImpact[];
  } {
    const impacts = this.analyzeGoalImpacts(degreeAnalysis, userGoals);

    // Calculate overall alignment score (0-100)
    const score = this.calculateAlignmentScore(impacts, userGoals);

    return { score, impacts };
  }

  /**
   * Analyze impact on each user goal
   */
  private analyzeGoalImpacts(
    degreeAnalysis: DegreeAnalysis,
    userGoals: Goal[]
  ): GoalImpact[] {
    return userGoals.map((goal) => {
      return this.analyzeGoalImpact(degreeAnalysis, goal);
    });
  }

  /**
   * Analyze impact on a single goal
   */
  private analyzeGoalImpact(
    degreeAnalysis: DegreeAnalysis,
    goal: Goal
  ): GoalImpact {
    const category = goal.category;
    const targetDate = new Date(goal.targetDate);
    const startDate = new Date(goal.startDate);
    const today = new Date();

    // Graduation year (assumed 4 years from enrollment)
    const graduationYear = today.getFullYear() + 4;
    const earlyCareerIncome = degreeAnalysis.careerOutcomes?.adjustedStartSalary || 0;
    const loanPayment = degreeAnalysis.debtProjection?.monthlyPayment || 0;
    const debtPaybackYears = degreeAnalysis.roiMetrics?.paybackPeriodYears || 0;

    let impactType: 'accelerates' | 'delays' | 'neutral' | 'blocks' = 'neutral';
    let yearsImpact = 0;
    let description = '';

    switch (category) {
      case 'retirement': {
        // Higher salary accelerates retirement savings
        // But debt delays ability to save
        const salaryBoost = earlyCareerIncome > 60000 ? 1 : 0; // Threshold
        const debtPenalty = debtPaybackYears > 10 ? -1 : 0;

        if (salaryBoost > debtPenalty) {
          impactType = 'accelerates';
          yearsImpact = 2;
          description = `Higher earning potential allows you to save ${Math.round(
            earlyCareerIncome * 0.15
          ).toLocaleString()}/year more for retirement, potentially retiring ${yearsImpact} years earlier.`;
        } else if (debtPenalty < 0) {
          impactType = 'delays';
          yearsImpact = -Math.round(debtPaybackYears / 2);
          description = `Significant student debt of $${Math.round(
            degreeAnalysis.financingBreakdown?.totalLoansNeeded || 0
          ).toLocaleString()} delays retirement savings by ${Math.abs(yearsImpact)} years.`;
        } else {
          description = 'Minimal impact on retirement timeline.';
        }
        break;
      }

      case 'purchase': {
        // Home purchase - Calculate how debt affects home buying capacity
        const dtiRatio = degreeAnalysis.debtProjection?.debtToIncomeRatio || 0;
        const monthlyDebtPayment = loanPayment;

        if (dtiRatio > 0.3) {
          // High DTI delays home purchase
          impactType = 'delays';
          yearsImpact = -Math.min(Math.round(debtPaybackYears), 5);
          description = `Debt-to-income ratio of ${Math.round(
            dtiRatio * 100
          )}% will likely delay home purchase by ${Math.abs(
            yearsImpact
          )} years. Monthly debt payments of $${Math.round(
            monthlyDebtPayment
          ).toLocaleString()} reduce mortgage qualification.`;
        } else if (earlyCareerIncome > 70000 && dtiRatio < 0.2) {
          // Strong income + low debt accelerates
          impactType = 'accelerates';
          yearsImpact = 2;
          description = `Strong salary of $${Math.round(
            earlyCareerIncome
          ).toLocaleString()} and manageable debt accelerates home purchase by ${yearsImpact} years.`;
        } else {
          description = 'Degree has neutral impact on home purchase timeline.';
        }
        break;
      }

      case 'education': // Kids' education / further education
        // Student debt impacts ability to save for children's education
        if (debtPaybackYears > 8) {
          impactType = 'delays';
          yearsImpact = -Math.round(debtPaybackYears / 3);
          description = `Your student loan obligations will delay your ability to save for children's education by approximately ${Math.abs(
            yearsImpact
          )} years.`;
        } else if (earlyCareerIncome > 80000) {
          impactType = 'accelerates';
          yearsImpact = 1;
          description = `High earning potential allows earlier start on education savings for children.`;
        } else {
          description = 'Moderate impact on future education savings capacity.';
        }
        break;

      case 'protection': {
        // Emergency fund, insurance - Debt reduces ability to build emergency fund
        const monthlyDiscretionary = earlyCareerIncome / 12 - loanPayment - 3000; // Assume $3k living expenses

        if (monthlyDiscretionary < 500) {
          impactType = 'delays';
          yearsImpact = -2;
          description = `Limited discretionary income of $${Math.round(
            monthlyDiscretionary
          )}/month delays building adequate emergency fund by ${Math.abs(yearsImpact)} years.`;
        } else if (monthlyDiscretionary > 2000) {
          impactType = 'accelerates';
          yearsImpact = 1;
          description = `Strong discretionary income allows faster emergency fund buildup.`;
        } else {
          description = 'Adequate capacity to build emergency fund on normal timeline.';
        }
        break;
      }

      case 'wealth': {
        // Investment, wealth building - High-paying degree accelerates, heavy debt delays
        const netWealthCapacity = earlyCareerIncome * 0.2 - loanPayment * 12;

        if (netWealthCapacity > 15000) {
          // Can invest $15k+/year
          impactType = 'accelerates';
          yearsImpact = 3;
          description = `Earning potential allows investing ~$${Math.round(
            netWealthCapacity
          ).toLocaleString()}/year, accelerating wealth building by ${yearsImpact} years.`;
        } else if (netWealthCapacity < 0) {
          impactType = 'delays';
          yearsImpact = -Math.round(debtPaybackYears);
          description = `Debt obligations prevent meaningful investment for ${Math.abs(
            yearsImpact
          )} years during loan repayment.`;
        } else {
          description = 'Moderate wealth-building capacity during early career.';
        }
        break;
      }

      case 'career':
        // Career goals are typically accelerated by degree
        impactType = 'accelerates';
        yearsImpact = 2;
        description = `Degree provides credentials and network to advance career ${yearsImpact} years faster than without degree.`;
        break;

      case 'lifestyle': {
        // Discretionary spending affected by debt burden
        const lifestyleDiscretionary = (earlyCareerIncome / 12 - loanPayment - 3000) * 0.3;

        if (lifestyleDiscretionary < 300) {
          impactType = 'delays';
          yearsImpact = -Math.min(Math.round(debtPaybackYears / 2), 5);
          description = `Limited discretionary income of $${Math.round(
            lifestyleDiscretionary
          )}/month delays lifestyle goals by ${Math.abs(yearsImpact)} years.`;
        } else if (lifestyleDiscretionary > 1000) {
          impactType = 'accelerates';
          yearsImpact = 1;
          description = `Strong income supports lifestyle goals with $${Math.round(
            lifestyleDiscretionary
          )}/month discretionary spending.`;
        } else {
          description = 'Moderate discretionary income for lifestyle goals.';
        }
        break;
      }

      default:
        description = 'Impact varies based on specific goal details.';
    }

    return {
      goalId: goal.id,
      goalName: goal.title,
      impactType,
      yearsImpact,
      description,
    };
  }

  /**
   * Calculate overall alignment score
   * Considers goal priorities and impact magnitudes
   */
  private calculateAlignmentScore(impacts: GoalImpact[], goals: Goal[]): number {
    if (impacts.length === 0) return 50; // Neutral

    let weightedScore = 0;
    let totalWeight = 0;

    impacts.forEach((impact) => {
      const goal = goals.find((g) => g.id === impact.goalId);
      if (!goal) return;

      // Weight based on goal priority
      let weight = 1;
      if (goal.priority === 'essential') weight = 3;
      else if (goal.priority === 'important') weight = 2;
      else weight = 1;

      // Score based on impact
      let impactScore = 50; // Neutral
      if (impact.impactType === 'accelerates') {
        impactScore = 50 + Math.min(impact.yearsImpact * 10, 50); // Up to 100
      } else if (impact.impactType === 'delays') {
        impactScore = 50 + Math.max(impact.yearsImpact * 10, -50); // Down to 0
      } else if (impact.impactType === 'blocks') {
        impactScore = 0;
      }

      weightedScore += impactScore * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;
  }

  /**
   * Generate summary of goal alignment
   */
  generateAlignmentSummary(
    score: number,
    impacts: GoalImpact[]
  ): string {
    const accelerated = impacts.filter((i) => i.impactType === 'accelerates');
    const delayed = impacts.filter((i) => i.impactType === 'delays');
    const blocked = impacts.filter((i) => i.impactType === 'blocks');

    let summary = '';

    if (score >= 75) {
      summary = `This degree strongly aligns with your life goals (${score}/100). `;
    } else if (score >= 60) {
      summary = `This degree moderately aligns with your life goals (${score}/100). `;
    } else if (score >= 40) {
      summary = `This degree has mixed impact on your life goals (${score}/100). `;
    } else {
      summary = `This degree may significantly delay your life goals (${score}/100). `;
    }

    if (accelerated.length > 0) {
      summary += `It accelerates ${accelerated.length} goal(s). `;
    }

    if (delayed.length > 0) {
      summary += `However, it delays ${delayed.length} goal(s). `;
    }

    if (blocked.length > 0) {
      summary += `⚠️ It may block ${blocked.length} critical goal(s). `;
    }

    return summary;
  }
}

// Singleton instance
export const goalAlignmentEngine = new GoalAlignmentEngine();
