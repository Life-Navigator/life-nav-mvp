/**
 * Degree Analysis Service
 * Orchestrates all engines to perform comprehensive degree analysis
 * (Degree Decision Matrix)
 */

import { PrismaClient } from '@prisma/client';
import type {
  DegreeAnalysisInput,
  DegreeAnalysis,
  YearlyCost,
  FinancingBreakdown,
  DebtProjection,
  CareerOutcomes,
  ROIMetrics,
  ScenarioAnalysis,
  AIAnalysis,
  RiskLevel,
} from '../types';

import { costOfAttendanceEngine } from '../engines/cost-of-attendance';
import { financingWaterfallEngine } from '../engines/financing-waterfall';
import { careerOutcomesEngine } from '../engines/career-outcomes';
import { roiEngine } from '../engines/roi';
import { goalAlignmentEngine } from '../engines/goal-alignment';

export class DegreeAnalysisService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Create a comprehensive degree analysis
   * This is the main entry point for the Degree Decision Matrix
   */
  async analyzeDegree(
    userId: string,
    input: DegreeAnalysisInput
  ): Promise<DegreeAnalysis> {
    // 1. Fetch student profile and associated data
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { id: input.studentProfileId },
      include: {
        financingAccounts: {
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!studentProfile || studentProfile.userId !== userId) {
      throw new Error('Student profile not found or unauthorized');
    }

    // 2. Fetch degree program data (if specified)
    let degreeProgram;
    if (input.degreeProgramId) {
      degreeProgram = await this.prisma.degreeProgram.findUnique({
        where: { id: input.degreeProgramId },
        include: {
          school: true,
        },
      });
    }

    // 3. Run Cost of Attendance Engine
    const yearlyCosts = costOfAttendanceEngine.calculateTotalCOA(input);
    const totalCostOfAttendance = costOfAttendanceEngine.getTotalCOA(yearlyCosts);

    // 4. Run Financing Waterfall Engine
    const financingBreakdown = financingWaterfallEngine.applyWaterfall(
      yearlyCosts,
      studentProfile.financingAccounts,
      studentProfile.enrollmentYear
    );

    // 5. Calculate Debt Projection
    const debtProjection = this.calculateDebtProjection(financingBreakdown);

    // 6. Run Career Outcomes Engine (with ANIS if degree program available)
    const careerOutcomes = careerOutcomesEngine.calculateOutcomes(
      input,
      degreeProgram || undefined,
      input.networkPriority
    );

    // 7. Run ROI Engine
    const roiMetrics = roiEngine.calculateROI(
      totalCostOfAttendance,
      financingBreakdown,
      careerOutcomes,
      debtProjection
    );

    // 8. Run Scenario Analysis
    // Build partial DegreeAnalysis for scenario input
    const partialAnalysis: any = {
      careerOutcomes,
      totalCostOfAttendance,
      financingBreakdown,
      debtProjection,
      roiMetrics,
    };
    const scenarios = roiEngine.runScenarioAnalysis(partialAnalysis);

    // 9. Calculate Goal Alignment (fetch user goals)
    const userGoals = await this.prisma.goal.findMany({
      where: { userId },
    });

    const goalAlignment = goalAlignmentEngine.calculateAlignment(
      partialAnalysis as DegreeAnalysis,
      userGoals
    );

    // 10. Generate AI Analysis
    const aiAnalysis = this.generateAIAnalysis(
      input,
      totalCostOfAttendance,
      financingBreakdown,
      debtProjection,
      careerOutcomes,
      roiMetrics,
      goalAlignment.score
    );

    // 11. Save to database
    const degreeAnalysis = await this.prisma.degreeAnalysis.create({
      data: {
        userId,
        studentProfileId: input.studentProfileId,
        schoolId: input.schoolId,
        degreeProgramId: input.degreeProgramId,

        // Custom overrides
        customSchoolName: input.customSchoolName,
        customDegreeName: input.customDegreeName,
        customDegreeType: input.customDegreeType,
        customProgramLength: input.customProgramLength,

        // Cost inputs
        tuition: input.tuition,
        fees: input.fees,
        roomBoard: input.roomBoard,
        books: input.books,
        otherExpenses: input.otherExpenses,
        tuitionInflation: input.tuitionInflation || 0.03,
        coaInflation: input.coaInflation || 0.025,

        // Financial aid
        scholarships: input.scholarships || 0,
        grants: input.grants || 0,

        // Career inputs
        expectedStartSalary: input.expectedStartSalary,
        expectedSalaryGrowth: input.expectedSalaryGrowth,
        expectedJobPlacementRate: input.expectedJobPlacementRate,
        targetRegion: input.targetRegion,

        // Network preference
        networkPriority: input.networkPriority || 'medium',

        // === RESULTS ===

        // COA Results
        totalCostOfAttendance,
        yearlyBreakdown: JSON.stringify(yearlyCosts),

        // Financing Results
        total529Used: financingBreakdown.total529Used,
        totalCustodialUsed: financingBreakdown.totalCustodialUsed,
        totalSavingsUsed: financingBreakdown.totalSavingsUsed,
        totalCashFlowUsed: financingBreakdown.totalCashFlowUsed,
        totalLoansNeeded: financingBreakdown.totalLoansNeeded,
        loanBreakdown: JSON.stringify(financingBreakdown.loanBreakdown),

        // Debt Projections
        monthlyPayment: debtProjection.monthlyPayment,
        paybackPeriodMonths: debtProjection.paybackPeriodMonths,
        totalInterestPaid: debtProjection.totalInterestPaid,
        debtToIncomeRatio: debtProjection.debtToIncomeRatio,

        // Career Outcomes
        adjustedStartSalary: careerOutcomes.adjustedStartSalary,
        adjustedSalaryGrowth: careerOutcomes.adjustedSalaryGrowth,
        adjustedPlacementRate: careerOutcomes.adjustedPlacementRate,
        adjustedUnderemploymentRate: careerOutcomes.adjustedUnderemploymentRate,

        // ROI
        paybackPeriodYears: roiMetrics.paybackPeriodYears,
        lifetimeNetValue: roiMetrics.lifetimeNetValue,
        npvIncrementalEarnings: roiMetrics.npvIncrementalEarnings,

        // Scenarios
        conservativeScenario: JSON.stringify(scenarios.conservative),
        baseScenario: JSON.stringify(scenarios.base),
        optimisticScenario: JSON.stringify(scenarios.optimistic),

        // Goal Alignment
        goalAlignmentScore: goalAlignment.score,
        goalImpactAnalysis: JSON.stringify(goalAlignment.impacts),

        // AI Analysis
        aiSummary: aiAnalysis.summary,
        aiWarnings: JSON.stringify(aiAnalysis.warnings),
        aiSuggestions: JSON.stringify(aiAnalysis.suggestions),
        riskLevel: aiAnalysis.riskLevel,
      },
    });

    // Return full analysis object with parsed JSON
    return {
      ...degreeAnalysis,
      yearlyBreakdown: yearlyCosts,
      loanBreakdown: financingBreakdown.loanBreakdown,
      financingBreakdown,
      debtProjection,
      careerOutcomes,
      roiMetrics,
      scenarios,
      goalAlignmentScore: goalAlignment.score,
      goalImpactAnalysis: goalAlignment.impacts,
      aiAnalysis,
    } as any;
  }

  /**
   * Calculate debt projection from loan breakdown
   */
  private calculateDebtProjection(
    financingBreakdown: FinancingBreakdown
  ): DebtProjection {
    if (financingBreakdown.totalLoansNeeded === 0) {
      return {
        totalLoanAmount: 0,
        monthlyPayment: 0,
        paybackPeriodMonths: 0,
        totalInterestPaid: 0,
        debtToIncomeRatio: 0,
        totalRepaymentAmount: 0,
      };
    }

    // Calculate weighted average interest rate
    const loans = financingBreakdown.loanBreakdown;
    const totalPrincipal = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const weightedRate = loans.reduce(
      (sum, loan) => sum + (loan.amount / totalPrincipal) * loan.interestRate,
      0
    );

    // Standard 10-year repayment
    const repaymentYears = 10;
    const loanPayment = roiEngine.calculateLoanPayment(
      totalPrincipal,
      weightedRate,
      repaymentYears
    );

    return {
      totalLoanAmount: totalPrincipal,
      monthlyPayment: loanPayment.monthlyPayment,
      paybackPeriodMonths: repaymentYears * 12,
      totalInterestPaid: loanPayment.totalInterest,
      debtToIncomeRatio: 0, // Will be calculated after career outcomes
      totalRepaymentAmount: loanPayment.totalRepayment,
    };
  }

  /**
   * Generate AI-powered analysis summary
   */
  private generateAIAnalysis(
    input: DegreeAnalysisInput,
    totalCost: number,
    financingBreakdown: FinancingBreakdown,
    debtProjection: DebtProjection,
    careerOutcomes: CareerOutcomes,
    roiMetrics: ROIMetrics,
    goalAlignmentScore: number
  ): AIAnalysis {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let riskLevel: RiskLevel = 'low';
    let worthItScore = 50;

    // Calculate key metrics
    const debtToIncomeRatio =
      debtProjection.totalLoanAmount / careerOutcomes.adjustedStartSalary;
    const paybackPeriod = roiMetrics.paybackPeriodYears;
    const lifetimeROI = roiMetrics.cumulativeROI;

    // === RISK ASSESSMENT ===

    // Critical Warning: Extreme debt-to-income ratio
    if (debtToIncomeRatio > 2.0) {
      warnings.push(
        `⚠️ CRITICAL: Your total debt (${Math.round(
          debtProjection.totalLoanAmount
        ).toLocaleString()}) is ${Math.round(
          debtToIncomeRatio
        )}x your expected starting salary. This is financially dangerous.`
      );
      riskLevel = 'extreme';
      worthItScore -= 30;
    } else if (debtToIncomeRatio > 1.5) {
      warnings.push(
        `⚠️ WARNING: Debt-to-income ratio of ${debtToIncomeRatio.toFixed(
          1
        )}x is very high. Monthly payments will strain your budget.`
      );
      riskLevel = riskLevel === 'extreme' ? 'extreme' : 'high';
      worthItScore -= 20;
    } else if (debtToIncomeRatio > 1.0) {
      warnings.push(
        `Debt-to-income ratio of ${debtToIncomeRatio.toFixed(
          1
        )}x is elevated. Budget carefully during repayment.`
      );
      if (riskLevel === 'low') riskLevel = 'medium';
      worthItScore -= 10;
    }

    // Payback period warning
    if (paybackPeriod > 15) {
      warnings.push(
        `Long payback period of ${Math.round(
          paybackPeriod
        )} years will delay other life goals significantly.`
      );
      if (riskLevel === 'low') riskLevel = 'medium';
    } else if (paybackPeriod > 20) {
      warnings.push(
        `⚠️ Payback period of ${Math.round(
          paybackPeriod
        )} years is excessive. Consider cheaper alternatives.`
      );
      riskLevel = riskLevel === 'low' ? 'high' : riskLevel;
      worthItScore -= 15;
    }

    // Placement rate warning
    if (careerOutcomes.adjustedPlacementRate < 0.7) {
      warnings.push(
        `Low job placement rate (${Math.round(
          careerOutcomes.adjustedPlacementRate * 100
        )}%) increases risk of unemployment or underemployment.`
      );
      if (riskLevel === 'low') riskLevel = 'medium';
      worthItScore -= 15;
    }

    // Underemployment warning
    if (careerOutcomes.adjustedUnderemploymentRate > 0.25) {
      warnings.push(
        `High underemployment rate (${Math.round(
          careerOutcomes.adjustedUnderemploymentRate * 100
        )}%) means significant risk of working outside your field.`
      );
      worthItScore -= 10;
    }

    // Negative lifetime ROI
    if (lifetimeROI < 0) {
      warnings.push(
        `⚠️ CRITICAL: Negative lifetime ROI. You may never financially recover from this degree.`
      );
      riskLevel = 'extreme';
      worthItScore -= 40;
    } else if (lifetimeROI < 50) {
      warnings.push(
        `Low lifetime ROI (${Math.round(lifetimeROI)}%) suggests weak financial return on investment.`
      );
      if (riskLevel === 'low') riskLevel = 'medium';
      worthItScore -= 15;
    }

    // === SUGGESTIONS ===

    // Financing suggestions
    if (financingBreakdown.totalLoansNeeded > totalCost * 0.5) {
      suggestions.push(
        `Consider increasing savings by $${Math.round(
          financingBreakdown.totalLoansNeeded * 0.3
        ).toLocaleString()} to reduce loan burden by 30%.`
      );
    }

    if (financingBreakdown.total529Used === 0 && financingBreakdown.totalLoansNeeded > 0) {
      suggestions.push(
        `Open a 529 plan now to benefit from tax-advantaged growth and reduce future loan needs.`
      );
    }

    // School cost suggestions
    const costPerYear = totalCost / (input.customProgramLength || 4);
    if (costPerYear > 50000) {
      suggestions.push(
        `At $${Math.round(
          costPerYear
        ).toLocaleString()}/year, consider more affordable alternatives with similar outcomes.`
      );
    }

    // Income suggestions
    if (careerOutcomes.adjustedStartSalary < 50000 && debtProjection.totalLoanAmount > 40000) {
      suggestions.push(
        `Starting salary of $${Math.round(
          careerOutcomes.adjustedStartSalary
        ).toLocaleString()} may not justify ${Math.round(
          debtProjection.totalLoanAmount
        ).toLocaleString()} in debt. Explore higher-paying alternatives or reduce costs.`
      );
    }

    // Network suggestions
    if (input.networkPriority === 'low' && input.degreeProgramId) {
      suggestions.push(
        `This program has a strong alumni network. Consider increasing your network priority to benefit from career connections.`
      );
    }

    // Goal alignment
    if (goalAlignmentScore < 40) {
      suggestions.push(
        `Low goal alignment score (${goalAlignmentScore}/100) suggests this degree may not serve your life goals well. Review impact on specific goals.`
      );
    }

    // === WORTH IT SCORE ===
    // Start at 50, adjust based on factors

    // Positive factors
    if (lifetimeROI > 200) worthItScore += 20;
    else if (lifetimeROI > 100) worthItScore += 10;

    if (paybackPeriod < 5) worthItScore += 15;
    else if (paybackPeriod < 8) worthItScore += 10;

    if (goalAlignmentScore > 75) worthItScore += 15;
    else if (goalAlignmentScore > 60) worthItScore += 10;

    if (careerOutcomes.adjustedPlacementRate > 0.9) worthItScore += 10;

    // Cap at 0-100
    worthItScore = Math.max(0, Math.min(100, worthItScore));

    // === SUMMARY ===
    let summary = '';

    if (worthItScore >= 80) {
      summary = `This is an excellent degree choice. `;
    } else if (worthItScore >= 65) {
      summary = `This is a solid degree choice with good financial prospects. `;
    } else if (worthItScore >= 50) {
      summary = `This degree is financially viable but requires careful planning. `;
    } else if (worthItScore >= 35) {
      summary = `This degree carries significant financial risk. `;
    } else {
      summary = `⚠️ This degree is financially dangerous for your situation. `;
    }

    summary += `Total cost of $${Math.round(
      totalCost
    ).toLocaleString()} will require $${Math.round(
      financingBreakdown.totalLoansNeeded
    ).toLocaleString()} in loans. `;

    summary += `Expected starting salary of $${Math.round(
      careerOutcomes.adjustedStartSalary
    ).toLocaleString()} leads to ${Math.round(
      paybackPeriod
    )}-year payback period. `;

    summary += `Lifetime ROI: ${Math.round(lifetimeROI)}%. `;

    summary += `Goal alignment: ${goalAlignmentScore}/100.`;

    return {
      summary,
      warnings,
      suggestions,
      riskLevel,
      worthItScore,
    };
  }

  /**
   * Get existing degree analysis
   */
  async getDegreeAnalysis(
    userId: string,
    analysisId: string
  ): Promise<DegreeAnalysis | null> {
    const analysis = await this.prisma.degreeAnalysis.findFirst({
      where: {
        id: analysisId,
        userId,
      },
      include: {
        school: true,
        degreeProgram: true,
        studentProfile: true,
      },
    });

    if (!analysis) return null;

    // Parse JSON fields
    return {
      ...analysis,
      yearlyBreakdown: analysis.yearlyBreakdown
        ? JSON.parse(analysis.yearlyBreakdown)
        : [],
      loanBreakdown: analysis.loanBreakdown ? JSON.parse(analysis.loanBreakdown) : [],
      conservativeScenario: analysis.conservativeScenario
        ? JSON.parse(analysis.conservativeScenario)
        : null,
      baseScenario: analysis.baseScenario ? JSON.parse(analysis.baseScenario) : null,
      optimisticScenario: analysis.optimisticScenario
        ? JSON.parse(analysis.optimisticScenario)
        : null,
      goalImpactAnalysis: analysis.goalImpactAnalysis
        ? JSON.parse(analysis.goalImpactAnalysis)
        : [],
      aiWarnings: analysis.aiWarnings ? JSON.parse(analysis.aiWarnings) : [],
      aiSuggestions: analysis.aiSuggestions ? JSON.parse(analysis.aiSuggestions) : [],
    } as any;
  }

  /**
   * List all degree analyses for a student profile
   */
  async listDegreeAnalyses(
    userId: string,
    studentProfileId: string
  ): Promise<DegreeAnalysis[]> {
    const analyses = await this.prisma.degreeAnalysis.findMany({
      where: {
        userId,
        studentProfileId,
      },
      include: {
        school: true,
        degreeProgram: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return analyses.map((analysis) => ({
      ...analysis,
      yearlyBreakdown: analysis.yearlyBreakdown
        ? JSON.parse(analysis.yearlyBreakdown)
        : [],
      goalImpactAnalysis: analysis.goalImpactAnalysis
        ? JSON.parse(analysis.goalImpactAnalysis)
        : [],
      aiWarnings: analysis.aiWarnings ? JSON.parse(analysis.aiWarnings) : [],
      aiSuggestions: analysis.aiSuggestions ? JSON.parse(analysis.aiSuggestions) : [],
    })) as any[];
  }

  /**
   * Delete degree analysis
   */
  async deleteDegreeAnalysis(userId: string, analysisId: string): Promise<void> {
    await this.prisma.degreeAnalysis.deleteMany({
      where: {
        id: analysisId,
        userId,
      },
    });
  }
}
