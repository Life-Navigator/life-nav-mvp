import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

// Risk calculation using Item Response Theory (IRT)
function calculateTheta(answers: any[]): number {
  // Simplified 2-Parameter Logistic Model (2PL)
  // theta = ability parameter (risk level)
  // a = discrimination parameter (how well question differentiates risk)
  // b = difficulty parameter (risk threshold)
  
  let theta = 0; // Initial estimate
  const maxIterations = 20;
  const convergenceCriterion = 0.001;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let firstDerivative = 0;
    let secondDerivative = 0;
    
    for (const answer of answers) {
      const a = answer.question.discriminationParameter || 1.0;
      const b = answer.question.difficultyParameter || 0.0;
      const response = answer.selectedOption.value; // 0-1 scale
      
      // Probability of positive response given theta
      const z = a * (theta - b);
      const p = 1 / (1 + Math.exp(-z));
      
      // Update derivatives
      firstDerivative += a * (response - p);
      secondDerivative -= a * a * p * (1 - p);
    }
    
    // Newton-Raphson update
    const deltaTheta = -firstDerivative / secondDerivative;
    theta += deltaTheta;
    
    // Check convergence
    if (Math.abs(deltaTheta) < convergenceCriterion) {
      break;
    }
  }
  
  // Normalize theta to 0-100 scale
  // Typical theta range is -3 to +3
  const normalizedTheta = ((theta + 3) / 6) * 100;
  return Math.max(0, Math.min(100, normalizedTheta));
}

// Calculate category-specific risk scores
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
    confidence: Math.min(95, 50 + (data.count * 5)), // Confidence increases with more questions
    questionCount: data.count
  }));
}

// Validation schemas
const startAssessmentSchema = z.object({
  type: z.enum(['FINANCIAL', 'HEALTH', 'CAREER', 'RELATIONSHIP', 'LIFESTYLE', 'COMPREHENSIVE']),
  questionnaireName: z.string().optional()
});

const submitAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
  responseTime: z.number().optional(), // Time taken to answer in seconds
  confidence: z.number().min(0).max(100).optional()
});

// GET /api/risk-assessment - Get assessment history or current assessment
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('id');
    const status = searchParams.get('status');

    if (assessmentId) {
      // Get specific assessment
      const assessment = await prisma.riskAssessment.findFirst({
        where: {
          id: assessmentId,
          userId: userId
        },
        include: {
          answers: {
            include: {
              question: true,
              selectedOption: true
            }
          },
          categoryScores: true,
          recommendations: {
            where: { isActive: true }
          }
        }
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      return NextResponse.json(assessment);
    }

    // Get assessment history
    const where: any = {
      userId: userId
    };

    if (status) where.status = status;

    const assessments = await prisma.riskAssessment.findMany({
      where,
      include: {
        categoryScores: true,
        _count: {
          select: {
            answers: true,
            recommendations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json(assessments);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessments' },
      { status: 500 }
    );
  }
}

// POST /api/risk-assessment - Start new assessment
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = startAssessmentSchema.parse(body);

    // Check for incomplete assessments
    const incompleteAssessment = await prisma.riskAssessment.findFirst({
      where: {
        userId: userId,
        status: 'IN_PROGRESS',
        deletedAt: null
      }
    });

    if (incompleteAssessment) {
      return NextResponse.json(
        { 
          error: 'Incomplete assessment exists',
          assessmentId: incompleteAssessment.id 
        },
        { status: 400 }
      );
    }

    // Create new assessment
    const assessment = await prisma.$transaction(async (tx) => {
      const newAssessment = await tx.riskAssessment.create({
        data: {
          userId: userId,
          type: validatedData.type,
          status: 'IN_PROGRESS',
          questionnaireName: validatedData.questionnaireName || `${validatedData.type} Risk Assessment`,
          totalQuestions: 0,
          completedQuestions: 0,
          overallScore: 0,
          riskLevel: 'UNKNOWN',
          theta: 0
        }
      });

      // Get questions for this assessment type
      const questions = await tx.assessmentQuestion.findMany({
        where: {
          category: validatedData.type === 'COMPREHENSIVE' ? undefined : validatedData.type,
          isActive: true
        },
        include: {
          options: {
            where: { isActive: true },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' },
        take: validatedData.type === 'COMPREHENSIVE' ? 50 : 20
      });

      // Update total questions count
      await tx.riskAssessment.update({
        where: { id: newAssessment.id },
        data: { totalQuestions: questions.length }
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'CREATE',
          entity: 'RiskAssessment',
          entityId: newAssessment.id,
          changes: JSON.stringify(validatedData),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return {
        ...newAssessment,
        questions
      };
    });

    return NextResponse.json(assessment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating assessment:', error);
    return NextResponse.json(
      { error: 'Failed to create assessment' },
      { status: 500 }
    );
  }
}