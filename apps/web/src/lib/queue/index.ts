/**
 * Queue System Initialization
 * Exports all queue services and processors
 */

export * from './queue-service';
export * from './processors/email-processor';
export * from './processors/notification-processor';
export * from './processors/scheduled-task-processor';

import { startEmailProcessor } from './processors/email-processor';
import { startNotificationProcessor } from './processors/notification-processor';
import { startScheduledTaskProcessor, scheduleDefaultTasks } from './processors/scheduled-task-processor';

/**
 * Initialize all queue processors
 */
export async function initializeQueues() {
  try {
    // Start processors
    startEmailProcessor(5);
    startNotificationProcessor(10);
    startScheduledTaskProcessor(5);

    // Schedule default tasks
    await scheduleDefaultTasks();

    console.log('All queue processors initialized successfully');
  } catch (error) {
    console.error('Failed to initialize queue processors:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown all queues
 */
export async function shutdownQueues() {
  const { 
    emailQueue, 
    notificationQueue, 
    scheduledTaskQueue,
    dataProcessingQueue,
    aiProcessingQueue,
    fileProcessingQueue
  } = await import('./queue-service');

  await Promise.all([
    emailQueue.close(),
    notificationQueue.close(),
    scheduledTaskQueue.close(),
    dataProcessingQueue.close(),
    aiProcessingQueue.close(),
    fileProcessingQueue.close(),
  ]);

  console.log('All queues shut down gracefully');
}