/**
 * Queue Service
 * Handles background job processing with Bull
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import { redisClient } from '../cache/redis-client';

export interface QueueConfig {
  name: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: JobOptions;
}

/**
 * Base Queue Service
 */
export class QueueService<T = any> {
  private queue: Queue<T>;
  private name: string;

  constructor(config: QueueConfig) {
    this.name = config.name;
    this.queue = new Bull(config.name, {
      redis: config.redis,
      defaultJobOptions: config.defaultJobOptions || {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Setup default event handlers
   */
  private setupEventHandlers() {
    this.queue.on('completed', (job: Job<T>) => {
      console.log(`Job ${job.id} completed in queue ${this.name}`);
    });

    this.queue.on('failed', (job: Job<T>, err: Error) => {
      console.error(`Job ${job.id} failed in queue ${this.name}:`, err);
    });

    this.queue.on('stalled', (job: Job<T>) => {
      console.warn(`Job ${job.id} stalled in queue ${this.name}`);
    });
  }

  /**
   * Add a job to the queue
   */
  async add(data: T, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add(data, options);
  }

  /**
   * Add a delayed job to the queue
   */
  async addDelayed(data: T, delay: number, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add(data, {
      ...options,
      delay,
    });
  }

  /**
   * Add a scheduled job to the queue
   */
  async addScheduled(data: T, cron: string, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add(data, {
      ...options,
      repeat: {
        cron,
      },
    });
  }

  /**
   * Process jobs
   */
  process(concurrency: number, processor: (job: Job<T>) => Promise<any>) {
    this.queue.process(concurrency, processor);
  }

  /**
   * Get queue status
   */
  async getStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 3600000) {
    await this.queue.clean(grace, 'completed');
    await this.queue.clean(grace, 'failed');
  }

  /**
   * Pause the queue
   */
  async pause() {
    await this.queue.pause();
  }

  /**
   * Resume the queue
   */
  async resume() {
    await this.queue.resume();
  }

  /**
   * Close the queue
   */
  async close() {
    await this.queue.close();
  }

  /**
   * Get the underlying Bull queue
   */
  getQueue(): Queue<T> {
    return this.queue;
  }
}

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

/**
 * Email Queue
 */
export interface EmailJobData {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

export const emailQueue = new QueueService<EmailJobData>({
  name: 'email',
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Notification Queue
 */
export interface NotificationJobData {
  userId: string;
  type: 'push' | 'in-app' | 'sms';
  title: string;
  message: string;
  data?: Record<string, any>;
}

export const notificationQueue = new QueueService<NotificationJobData>({
  name: 'notification',
  redis: redisConfig,
});

/**
 * Data Processing Queue
 */
export interface DataProcessingJobData {
  type: 'import' | 'export' | 'analysis' | 'report';
  userId: string;
  data: any;
  options?: Record<string, any>;
}

export const dataProcessingQueue = new QueueService<DataProcessingJobData>({
  name: 'data-processing',
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    timeout: 300000, // 5 minutes
  },
});

/**
 * Scheduled Tasks Queue
 */
export interface ScheduledTaskJobData {
  type: 'reminder' | 'report' | 'cleanup' | 'sync';
  userId?: string;
  data?: any;
}

export const scheduledTaskQueue = new QueueService<ScheduledTaskJobData>({
  name: 'scheduled-tasks',
  redis: redisConfig,
});

/**
 * AI Processing Queue
 */
export interface AIProcessingJobData {
  type: 'recommendation' | 'analysis' | 'prediction';
  userId: string;
  module: 'financial' | 'career' | 'education' | 'healthcare';
  data: any;
}

export const aiProcessingQueue = new QueueService<AIProcessingJobData>({
  name: 'ai-processing',
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    timeout: 600000, // 10 minutes
  },
});

/**
 * File Processing Queue
 */
export interface FileProcessingJobData {
  type: 'upload' | 'download' | 'resize' | 'convert';
  userId: string;
  fileUrl: string;
  options?: Record<string, any>;
}

export const fileProcessingQueue = new QueueService<FileProcessingJobData>({
  name: 'file-processing',
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    timeout: 180000, // 3 minutes
  },
});

/**
 * Export convenience functions
 */
export const addEmailJob = (data: EmailJobData, options?: JobOptions) => 
  emailQueue.add(data, options);

export const addNotificationJob = (data: NotificationJobData, options?: JobOptions) => 
  notificationQueue.add(data, options);

export const addDataProcessingJob = (data: DataProcessingJobData, options?: JobOptions) => 
  dataProcessingQueue.add(data, options);

export const addScheduledTask = (data: ScheduledTaskJobData, cron: string, options?: JobOptions) => 
  scheduledTaskQueue.addScheduled(data, cron, options);

export const addAIProcessingJob = (data: AIProcessingJobData, options?: JobOptions) => 
  aiProcessingQueue.add(data, options);

export const addFileProcessingJob = (data: FileProcessingJobData, options?: JobOptions) =>
  fileProcessingQueue.add(data, options);

/**
 * Virus Scan Queue
 */
export interface VirusScanJobData {
  fileId: string;
  fileUrl: string;
  userId: string;
  domain: string;
  originalFilename: string;
  scanMode: 'sync' | 'async';
  buffer?: number[]; // Optional for sync mode with small files
  priority?: 'high' | 'normal' | 'low';
}

export const virusScanQueue = new QueueService<VirusScanJobData>({
  name: 'virus-scan',
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    timeout: 120000, // 2 minutes
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: false, // Keep failed jobs for investigation
  },
});

/**
 * Add virus scan job with priority handling
 */
export const addVirusScanJob = async (
  data: VirusScanJobData,
  options?: JobOptions
) => {
  const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
  return virusScanQueue.add(data, { ...options, priority });
};