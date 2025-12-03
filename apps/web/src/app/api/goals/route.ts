import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schemas
const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(['CAREER', 'FINANCIAL', 'HEALTH', 'EDUCATION', 'PERSONAL', 'RELATIONSHIP', 'SPIRITUAL', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED']).default('DRAFT'),
  targetDate: z.string().datetime().optional(),
  isSpecific: z.boolean().default(false),
  isMeasurable: z.boolean().default(false),
  isAchievable: z.boolean().default(false),
  isRelevant: z.boolean().default(false),
  isTimeBound: z.boolean().default(false),
  benefits: z.array(z.object({
    lifeAreaId: z.string(),
    impactScore: z.number().min(1).max(10),
    description: z.string().optional()
  })).optional(),
  milestones: z.array(z.object({
    title: z.string(),
    targetDate: z.string().datetime(),
    description: z.string().optional()
  })).optional()
});

// GET /api/goals - List user goals
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {
      userId
    };

    if (category) where.category = category;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        include: {
          benefits: true,
          milestones: {
            orderBy: { targetDate: 'asc' }
          },
          updates: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          reminders: {
            where: {
              isActive: true,
              nextReminderDate: { gte: new Date() }
            }
          },
          dependencies: {
            include: {
              dependsOnGoal: {
                select: { id: true, title: true, status: true }
              }
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.goal.count({ where })
    ]);

    // Calculate progress for each goal
    const goalsWithProgress = goals.map(goal => {
      const totalMilestones = goal.milestones.length;
      const completedMilestones = goal.milestones.filter(m => m.isCompleted).length;
      const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

      // Calculate SMART score
      const smartScore = [
        goal.isSpecific,
        goal.isMeasurable,
        goal.isAchievable,
        goal.isRelevant,
        goal.isTimeBound
      ].filter(Boolean).length * 20;

      // Calculate total benefit impact
      const totalBenefitImpact = goal.benefits.reduce((sum, b) => sum + b.impactScore, 0);

      return {
        ...goal,
        progress,
        smartScore,
        totalBenefitImpact,
        isOverdue: goal.targetDate && new Date(goal.targetDate) < new Date() && goal.status !== 'COMPLETED'
      };
    });

    return NextResponse.json({
      goals: goalsWithProgress,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

// POST /api/goals - Create new goal
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createGoalSchema.parse(body);

    // Start a transaction to create goal with related data
    const goal = await prisma.$transaction(async (tx) => {
      // Create the goal
      const newGoal = await tx.goal.create({
        data: {
          userId,
          title: validatedData.title,
          description: validatedData.description,
          category: validatedData.category,
          priority: validatedData.priority,
          status: validatedData.status,
          targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null,
          isSpecific: validatedData.isSpecific,
          isMeasurable: validatedData.isMeasurable,
          isAchievable: validatedData.isAchievable,
          isRelevant: validatedData.isRelevant,
          isTimeBound: validatedData.isTimeBound,
          progress: 0
        }
      });

      // Create benefits if provided
      if (validatedData.benefits && validatedData.benefits.length > 0) {
        await tx.goalBenefit.createMany({
          data: validatedData.benefits.map(benefit => ({
            goalId: newGoal.id,
            lifeAreaId: benefit.lifeAreaId,
            impactScore: benefit.impactScore,
            description: benefit.description
          }))
        });
      }

      // Create milestones if provided
      if (validatedData.milestones && validatedData.milestones.length > 0) {
        await tx.goalMilestone.createMany({
          data: validatedData.milestones.map((milestone, index) => ({
            goalId: newGoal.id,
            title: milestone.title,
            description: milestone.description,
            targetDate: new Date(milestone.targetDate),
            order: index + 1,
            isCompleted: false
          }))
        });
      }

      // Create initial update entry
      await tx.goalUpdate.create({
        data: {
          goalId: newGoal.id,
          updateType: 'status_change',
          content: `Goal created: ${newGoal.title}`,
          newValue: 0
        }
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Goal',
          entityId: newGoal.id,
          changes: JSON.stringify(validatedData),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      // Return the complete goal with relations
      return await tx.goal.findUnique({
        where: { id: newGoal.id },
        include: {
          benefits: true,
          milestones: true,
          updates: true
        }
      });
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}