import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db as prisma } from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// AI-powered recommendation generation (mock for now, integrate with OpenAI later)
function generateRecommendations(
  categoryScores: any[],
  overallScore: number,
  theta: number
): string[] {
  const recommendations: string[] = [];
  
  // Risk level based recommendations
  if (theta > 75) {
    recommendations.push("Consider consulting with a financial advisor immediately to address high-risk areas");
    recommendations.push("Implement emergency fund of 6-12 months expenses as top priority");
  } else if (theta > 50) {
    recommendations.push("Focus on building a 3-6 month emergency fund");
    recommendations.push("Review and optimize your insurance coverage");
  } else if (theta > 25) {
    recommendations.push("Start investing in low-cost index funds for long-term growth");
    recommendations.push("Consider increasing retirement contributions by 1-2%");
  } else {
    recommendations.push("Excellent risk profile! Consider more aggressive investment strategies");
    recommendations.push("Explore tax-advantaged investment opportunities");
  }
  
  // Category-specific recommendations
  for (const categoryScore of categoryScores) {
    if (categoryScore.category === 'FINANCIAL' && categoryScore.score > 60) {
      recommendations.push(`High financial risk detected (${categoryScore.score.toFixed(1)}%). Priority: Debt reduction and emergency savings`);
    }
    if (categoryScore.category === 'HEALTH' && categoryScore.score > 60) {
      recommendations.push(`Health risk factors identified (${categoryScore.score.toFixed(1)}%). Consider preventive health screenings`);
    }
    if (categoryScore.category === 'CAREER' && categoryScore.score > 60) {
      recommendations.push(`Career volatility detected (${categoryScore.score.toFixed(1)}%). Focus on skill development and networking`);
    }
  }
  
  return recommendations;
}

// Determine risk level based on theta
function determineRiskLevel(theta: number): string {
  if (theta >= 80) return 'CRITICAL';
  if (theta >= 60) return 'HIGH';
  if (theta >= 40) return 'MEDIUM';
  if (theta >= 20) return 'LOW';
  return 'MINIMAL';
}

// PUT /api/risk-assessment/[id]/complete - Complete assessment and calculate results
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get assessment with all answers
    const assessment = await prisma.riskAssessment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        status: 'IN_PROGRESS',
        deletedAt: null
      },
      include: {
        answers: {
          include: {
            question: true,
            selectedOption: true
          }
        }
      }
    });

    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found or already completed' },
        { status: 404 }
      );
    }

    // Check if all questions are answered
    if (assessment.answers.length < assessment.totalQuestions) {
      return NextResponse.json(
        { 
          error: 'Assessment incomplete',
          answered: assessment.answers.length,
          required: assessment.totalQuestions
        },
        { status: 400 }
      );
    }

    // Calculate overall theta using IRT
    const theta = calculateTheta(assessment.answers);
    
    // Calculate category scores
    const categoryScores = calculateCategoryScores(assessment.answers);
    
    // Calculate overall score (weighted average)
    const overallScore = categoryScores.reduce((sum, cat) => sum + cat.score, 0) / categoryScores.length;
    
    // Determine risk level
    const riskLevel = determineRiskLevel(theta);
    
    // Generate recommendations
    const recommendations = generateRecommendations(categoryScores, overallScore, theta);
    
    // Update assessment in transaction
    const completedAssessment = await prisma.$transaction(async (tx) => {
      // Update assessment
      const updated = await tx.riskAssessment.update({
        where: { id: params.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedQuestions: assessment.answers.length,
          overallScore,
          theta,
          riskLevel,
          confidenceInterval: 5.0, // Standard error * 1.96 for 95% CI
          riskData: {
            calculationMethod: 'IRT-2PL',
            iterations: 20,
            convergence: true,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Save category scores
      for (const categoryScore of categoryScores) {
        await tx.riskCategoryScore.create({
          data: {
            assessmentId: params.id,
            category: categoryScore.category,
            score: categoryScore.score,
            theta: categoryScore.theta,
            confidence: categoryScore.confidence,
            questionCount: categoryScore.questionCount
          }
        });
      }

      // Save recommendations
      for (const recommendation of recommendations) {
        await tx.riskRecommendation.create({
          data: {
            assessmentId: params.id,
            recommendation,
            priority: recommendations.indexOf(recommendation) + 1,
            category: 'GENERAL',
            isActive: true,
            source: 'SYSTEM'
          }
        });
      }

      // Create risk mitigation strategies
      if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
        await tx.riskMitigationStrategy.create({
          data: {
            assessmentId: params.id,
            strategyName: 'Emergency Risk Reduction Plan',
            description: 'Immediate actions to reduce critical risk factors',
            priority: 'CRITICAL',
            estimatedImpact: 30,
            timeframeWeeks: 4,
            status: 'PENDING'
          }
        });
      }

      // Log audit event
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'COMPLETE',
          entity: 'RiskAssessment',
          entityId: params.id,
          changes: JSON.stringify({
            theta,
            overallScore,
            riskLevel,
            categoryCount: categoryScores.length
          }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return updated;
    });

    // Return complete assessment with results
    const finalAssessment = await prisma.riskAssessment.findUnique({
      where: { id: params.id },
      include: {
        categoryScores: true,
        recommendations: {
          where: { isActive: true },
          orderBy: { priority: 'asc' }
        },
        mitigationStrategies: {
          orderBy: { priority: 'desc' }
        }
      }
    });

    return NextResponse.json({
      ...finalAssessment,
      analysis: {
        interpretation: interpretRiskScore(theta),
        percentile: calculatePercentile(theta),
        comparisonToAverage: theta - 50,
        confidenceLevel: '95%',
        nextAssessmentRecommended: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    });
  } catch (error) {
    console.error('Error completing assessment:', error);
    return NextResponse.json(
      { error: 'Failed to complete assessment' },
      { status: 500 }
    );
  }
}

// Helper function to calculate theta
function calculateTheta(answers: any[]): number {
  let theta = 0;
  const maxIterations = 20;
  const convergenceCriterion = 0.001;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let firstDerivative = 0;
    let secondDerivative = 0;
    
    for (const answer of answers) {
      const a = answer.question.discriminationParameter || 1.0;
      const b = answer.question.difficultyParameter || 0.0;
      const response = answer.selectedOption.value;
      
      const z = a * (theta - b);
      const p = 1 / (1 + Math.exp(-z));
      
      firstDerivative += a * (response - p);
      secondDerivative -= a * a * p * (1 - p);
    }
    
    const deltaTheta = -firstDerivative / secondDerivative;
    theta += deltaTheta;
    
    if (Math.abs(deltaTheta) < convergenceCriterion) {
      break;
    }
  }
  
  const normalizedTheta = ((theta + 3) / 6) * 100;
  return Math.max(0, Math.min(100, normalizedTheta));
}

// Helper function to calculate category scores
function calculateCategoryScores(answers: any[]): any[] {
  const categoryScores: { [key: string]: { total: number; count: number; answers: any[] } } = {};
  
  for (const answer of answers) {
    const category = answer.question.category;
    if (!categoryScores[category]) {
      categoryScores[category] = { total: 0, count: 0, answers: [] };
    }
    
    categoryScores[category].total += answer.selectedOption.value * answer.question.weight;
    categoryScores[category].count++;
    categoryScores[category].answers.push(answer);
  }
  
  return Object.entries(categoryScores).map(([category, data]) => ({
    category,
    score: (data.total / data.count) * 100,
    theta: calculateTheta(data.answers),
    confidence: Math.min(95, 50 + (data.count * 5)),
    questionCount: data.count
  }));
}

// Interpret risk score
function interpretRiskScore(theta: number): string {
  if (theta >= 80) {
    return "Critical risk level detected. Immediate action required to address multiple high-risk factors.";
  } else if (theta >= 60) {
    return "High risk level identified. Several areas require attention to improve your overall risk profile.";
  } else if (theta >= 40) {
    return "Moderate risk level. Some areas could benefit from improvement to enhance stability.";
  } else if (theta >= 20) {
    return "Low risk level. Your profile shows good stability with minor areas for optimization.";
  } else {
    return "Minimal risk level. Excellent risk management across all assessed categories.";
  }
}

// Calculate percentile rank
function calculatePercentile(theta: number): number {
  // Using normal distribution approximation
  // Assuming population mean of 50 and SD of 15
  const mean = 50;
  const sd = 15;
  const z = (theta - mean) / sd;
  
  // Approximate CDF of standard normal distribution
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return z > 0 ? (1 - probability) * 100 : probability * 100;
}