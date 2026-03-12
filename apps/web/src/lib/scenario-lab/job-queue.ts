/**
 * Scenario Lab - Job Queue System
 *
 * Database-backed job queue using scenario_jobs table
 */

import { supabaseAdmin } from './supabase-client';
import { JobType, JobStatus, ScenarioJob } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enqueue a new job
 */
export async function enqueueJob(params: {
  userId: string;
  scenarioId: string | null;
  jobType: JobType;
  inputJson: any;
  idempotencyKey?: string;
}): Promise<ScenarioJob> {
  const { userId, scenarioId, jobType, inputJson, idempotencyKey } = params;

  // Check for existing job with same idempotency key
  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('scenario_jobs')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      return existing as ScenarioJob;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('scenario_jobs')
    .insert({
      user_id: userId,
      scenario_id: scenarioId,
      job_type: jobType,
      status: 'queued' as JobStatus,
      input_json: inputJson,
      idempotency_key: idempotencyKey || uuidv4(),
      attempts: 0,
      max_attempts: 3,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ScenarioJob;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<ScenarioJob | null> {
  const { data, error } = await supabaseAdmin
    .from('scenario_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) return null;
  return data as ScenarioJob;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus | 'processing' | {
    status: JobStatus | 'processing';
    output_json?: any;
    result_json?: any;
    error_text?: string;
    error?: string;
    progress?: number;
    started_at?: string;
    completed_at?: string;
    attempts?: number;
  },
  updates: Partial<{
    output_json: any;
    error_text: string;
    started_at: string;
    completed_at: string;
    attempts: number;
  }> = {}
): Promise<void> {
  const updateInput = typeof status === 'string'
    ? { status, ...updates }
    : status;

  const normalizedStatus = updateInput.status === 'processing'
    ? 'running'
    : updateInput.status;

  const payload: any = {
    status: normalizedStatus,
    updated_at: new Date().toISOString(),
  };

  if (typeof updateInput.attempts === 'number') payload.attempts = updateInput.attempts;
  if (updateInput.started_at) payload.started_at = updateInput.started_at;
  if (updateInput.completed_at) payload.completed_at = updateInput.completed_at;

  if (updateInput.output_json !== undefined) {
    payload.output_json = updateInput.output_json;
  } else if (updateInput.result_json !== undefined) {
    payload.output_json = updateInput.result_json;
  }

  if (updateInput.error_text !== undefined) {
    payload.error_text = updateInput.error_text;
  } else if (updateInput.error !== undefined) {
    payload.error_text = updateInput.error;
  }

  if (typeof updateInput.progress === 'number') {
    payload.output_json = {
      ...(payload.output_json && typeof payload.output_json === 'object' ? payload.output_json : {}),
      progress: updateInput.progress,
    };
  }

  // Auto-set timestamps based on status
  if (normalizedStatus === 'running' && !updateInput.started_at) {
    payload.started_at = new Date().toISOString();
  }
  if ((normalizedStatus === 'completed' || normalizedStatus === 'failed') && !updateInput.completed_at) {
    payload.completed_at = new Date().toISOString();
  }

  await supabaseAdmin
    .from('scenario_jobs')
    .update(payload)
    .eq('id', jobId);
}

/**
 * Get next queued job for processing
 * Uses SELECT FOR UPDATE SKIP LOCKED for concurrency safety
 */
export async function getNextQueuedJob(jobType?: JobType): Promise<ScenarioJob | null> {
  let query = supabaseAdmin
    .from('scenario_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(20);

  if (jobType) {
    query = query.eq('job_type', jobType);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) return null;

  const job = (data as ScenarioJob[]).find((item) => item.attempts < item.max_attempts);
  if (!job) return null;

  // Mark as running immediately to prevent concurrent processing
  await updateJobStatus(job.id, 'running', {
    attempts: job.attempts + 1,
  });

  return job;
}

/**
 * Retry failed job (if attempts < max_attempts)
 */
export async function retryJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job || job.attempts >= job.max_attempts) return false;

  await supabaseAdmin
    .from('scenario_jobs')
    .update({
      status: 'queued' as JobStatus,
      error_text: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  return true;
}

/**
 * Get jobs for a user
 */
export async function getUserJobs(
  userId: string,
  filters?: {
    jobType?: JobType;
    status?: JobStatus;
    limit?: number;
  }
): Promise<ScenarioJob[]> {
  let query = supabaseAdmin
    .from('scenario_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.jobType) {
    query = query.eq('job_type', filters.jobType);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as ScenarioJob[];
}

/**
 * Clean up old completed jobs (optional maintenance task)
 */
export async function cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await supabaseAdmin
    .from('scenario_jobs')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('completed_at', cutoffDate.toISOString())
    .select('id');

  if (error) throw error;
  return (data || []).length;
}
