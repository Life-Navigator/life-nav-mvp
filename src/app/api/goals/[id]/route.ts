import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { z } from 'zod';

// Update goal schema
const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.enum(['CAREER', 'FINANCIAL', 'HEALTH', 'EDUCATION', 'PERSONAL', 'RELATIONSHIP', 'SPIRITUAL', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED']).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  isSpecific: z.boolean().optional(),
  isMeasurable: z.boolean().optional(),
  isAchievable: z.boolean().optional(),
  isRelevant: z.boolean().optional(),
  isTimeBound: z.boolean().optional()
});

// GET /api/goals/[id] - Get specific goal
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goal = await prisma.goal.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null
      },
      include: {
        benefits: {
          include: {
            lifeArea: true
          }
        },
        milestones: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' }
        },
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        reminders: {
          where: { isActive: true }
        },
        dependencies: {
          include: {
            dependsOnGoal: {
              select: { id: true, title: true, status: true, progressPercentage: true }
            }
          }
        },
        dependentGoals: {
          include: {
            goal: {
              select: { id: true, title: true, status: true }
            }
          }
        }
      }
    });

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Calculate analytics
    const analytics = {
      completedMilestones: goal.milestones.filter(m => m.isCompleted).length,
      totalMilestones: goal.milestones.length,
      daysSinceCreation: Math.floor((Date.now() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      daysUntilTarget: goal.targetDate 
        ? Math.floor((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      smartScore: [
        goal.isSpecific,
        goal.isMeasurable,
        goal.isAchievable,
        goal.isRelevant,
        goal.isTimeBound
      ].filter(Boolean).length * 20,
      totalBenefitImpact: goal.benefits.reduce((sum, b) => sum + b.impactScore, 0)
    };

    return NextResponse.json({
      ...goal,
      analytics
    });
  } catch (error) {
    console.error('Error fetching goal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goal' },
      { status: 500 }
    );
  }
}

// PUT /api/goals/[id] - Update goal
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateGoalSchema.parse(body);

    // Check if goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null
      }
    });

    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Update goal in transaction
    const updatedGoal = await prisma.$transaction(async (tx) => {
      // Update the goal
      const goal = await tx.goal.update({
        where: { id: params.id },
        data: {
          ...validatedData,
          targetDate: validatedData.targetDate !== undefined 
            ? (validatedData.targetDate ? new Date(validatedData.targetDate) : null)
            : undefined,
          updatedAt: new Date()
        }
      });

      // Create update entry if progress changed
      if (validatedData.progressPercentage !== undefined && 
          validatedData.progressPercentage !== existingGoal.progressPercentage) {
        await tx.goalUpdate.create({
          data: {
            goalId: params.id,
            updateText: `Progress updated to ${validatedData.progressPercentage}%`,
            progressPercentage: validatedData.progressPercentage
          }
        });
      }

      // Mark as completed if status changed to COMPLETED
      if (validatedData.status === 'COMPLETED' && existingGoal.status !== 'COMPLETED') {
        await tx.goal.update({
          where: { id: params.id },
          data: {
            completedAt: new Date(),
            progressPercentage: 100
          }
        });

        await tx.goalUpdate.create({
          data: {
            goalId: params.id,
            updateText: `Goal completed! 🎉`,
            progressPercentage: 100
          }
        });

        // Complete all milestones
        await tx.goalMilestone.updateMany({
          where: { 
            goalId: params.id,
            isCompleted: false
          },
          data: {
            isCompleted: true,
            completedAt: new Date()
          }
        });
      }

      // Log audit event
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE',
          entity: 'Goal',
          entityId: params.id,
          changes: JSON.stringify({
            before: existingGoal,
            after: validatedData
          }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return goal;
    });

    // Return updated goal with relations
    const goalWithRelations = await prisma.goal.findUnique({
      where: { id: params.id },
      include: {
        benefits: {
          include: { lifeArea: true }
        },
        milestones: true,
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    return NextResponse.json(goalWithRelations);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}

// DELETE /api/goals/[id] - Soft delete goal
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null
      }
    });

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Soft delete in transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete the goal
      await tx.goal.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedBy: session.user.id
        }
      });

      // Soft delete related entities
      await tx.goalMilestone.updateMany({
        where: { goalId: params.id },
        data: { deletedAt: new Date() }
      });

      await tx.goalBenefit.updateMany({
        where: { goalId: params.id },
        data: { deletedAt: new Date() }
      });

      await tx.goalReminder.updateMany({
        where: { goalId: params.id },
        data: { 
          isActive: false,
          deletedAt: new Date()
        }
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE',
          entity: 'Goal',
          entityId: params.id,
          changes: JSON.stringify({ goalTitle: goal.title }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });
    });

    return NextResponse.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}