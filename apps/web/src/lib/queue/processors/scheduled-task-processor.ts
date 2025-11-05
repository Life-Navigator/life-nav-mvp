/**
 * Scheduled Task Processor
 * Processes scheduled tasks from the queue
 */

import { Job } from 'bull';
import { ScheduledTaskJobData, scheduledTaskQueue } from '../queue-service';
import { emailService } from '../../email/email-service';
import { db } from '../../db';

/**
 * Process scheduled task jobs
 */
export async function processScheduledTaskJob(job: Job<ScheduledTaskJobData>) {
  const { type, userId, data } = job.data;

  try {
    console.log(`Processing scheduled task ${job.id}: ${type}`);

    switch (type) {
      case 'reminder':
        await processReminder(userId!, data);
        break;
      case 'report':
        await generateReport(userId!, data);
        break;
      case 'cleanup':
        await performCleanup(data);
        break;
      case 'sync':
        await performSync(userId!, data);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    console.log(`Scheduled task ${job.id} completed successfully`);
    return { success: true, type };
  } catch (error) {
    console.error(`Scheduled task ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Process reminder tasks
 */
async function processReminder(userId: string, data: any) {
  // Get user's goals and send reminders
  const goals = await db.goal.findMany({
    where: {
      userId,
      status: 'active',
      reminderEnabled: true,
    },
  });

  if (goals.length > 0) {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      await emailService.sendGoalReminderEmail(user.email, {
        name: user.name || 'User',
        goals: goals.map(g => ({
          title: g.title,
          description: g.description,
          targetDate: g.targetDate,
          progress: g.progress,
        })),
      });
    }
  }
}

/**
 * Generate reports
 */
async function generateReport(userId: string, data: any) {
  const reportType = data?.type || 'weekly';
  
  // Get user data for report
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      goals: {
        where: {
          status: 'active',
        },
      },
      riskAssessment: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (user) {
    // Generate report content
    const reportData = {
      name: user.name || 'User',
      period: reportType,
      goals: user.goals,
      riskScore: user.riskAssessment[0]?.score,
      // Add more report data as needed
    };

    // Send report email
    await emailService.send({
      to: user.email,
      subject: `Your ${reportType} LifeNavigator Report`,
      template: 'report',
      data: reportData,
    });
  }
}

/**
 * Perform cleanup tasks
 */
async function performCleanup(data: any) {
  const daysToKeep = data?.daysToKeep || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // Clean old notifications
  await db.notification.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
      read: true,
    },
  });

  // Clean old sessions
  await db.session.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });

  // Clean old revoked tokens
  await db.revokedToken.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Cleanup completed for data older than ${daysToKeep} days`);
}

/**
 * Perform sync tasks
 */
async function performSync(userId: string, data: any) {
  // TODO: Implement sync with external services
  // For example, sync with financial institutions, health providers, etc.
  console.log(`Syncing data for user ${userId}`);
  
  // Placeholder for sync logic
  return Promise.resolve();
}

/**
 * Start scheduled task processor
 */
export function startScheduledTaskProcessor(concurrency: number = 5) {
  scheduledTaskQueue.process(concurrency, processScheduledTaskJob);
  console.log(`Scheduled task processor started with concurrency: ${concurrency}`);
}

/**
 * Schedule default tasks
 */
export async function scheduleDefaultTasks() {
  // Schedule daily cleanup at 2 AM
  await scheduledTaskQueue.addScheduled(
    {
      type: 'cleanup',
      data: { daysToKeep: 30 },
    },
    '0 2 * * *', // Cron expression for 2 AM daily
    {
      jobId: 'daily-cleanup',
    }
  );

  // Schedule weekly reports on Sundays at 9 AM
  await scheduledTaskQueue.addScheduled(
    {
      type: 'report',
      data: { type: 'weekly' },
    },
    '0 9 * * 0', // Cron expression for Sunday 9 AM
    {
      jobId: 'weekly-report',
    }
  );

  console.log('Default scheduled tasks configured');
}