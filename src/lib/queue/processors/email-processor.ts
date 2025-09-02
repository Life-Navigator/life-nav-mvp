/**
 * Email Queue Processor
 * Processes email jobs from the queue
 */

import { Job } from 'bull';
import { EmailJobData, emailQueue } from '../queue-service';
import { emailService } from '../../email/email-service';

/**
 * Process email jobs
 */
export async function processEmailJob(job: Job<EmailJobData>) {
  const { to, subject, template, data, html, text } = job.data;

  try {
    console.log(`Processing email job ${job.id}: ${subject} to ${to}`);

    await emailService.send({
      to,
      subject,
      template,
      data,
      html,
      text,
    });

    console.log(`Email job ${job.id} completed successfully`);
    return { success: true, sentTo: to };
  } catch (error) {
    console.error(`Email job ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Start email processor
 */
export function startEmailProcessor(concurrency: number = 5) {
  emailQueue.process(concurrency, processEmailJob);
  console.log(`Email processor started with concurrency: ${concurrency}`);
}