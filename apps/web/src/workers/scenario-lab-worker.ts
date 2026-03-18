/**
 * Scenario Lab Background Worker
 *
 * Polls scenario_jobs table for queued jobs and processes them.
 * Handles: OCR, SIMULATE, PDF job types
 *
 * Run with: node --loader ts-node/esm src/workers/scenario-lab-worker.ts
 * Or deploy as Cloud Run job with cron trigger
 */

import { getNextQueuedJob, updateJobStatus } from '../lib/scenario-lab/job-queue';
import type { ScenarioJob } from '../lib/scenario-lab/types';

// Environment configuration
const POLL_INTERVAL_MS = parseInt(process.env.SCENARIO_WORKER_POLL_INTERVAL_MS || '5000', 10);
const MAX_CONCURRENT_JOBS = parseInt(process.env.SCENARIO_WORKER_MAX_CONCURRENT_JOBS || '3', 10);

let activeJobs = 0;
let isShuttingDown = false;

/**
 * Main worker loop
 * Polls for jobs and processes them concurrently
 */
async function workerLoop() {
  console.log('[Worker] Starting Scenario Lab worker...');
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[Worker] Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);

  while (!isShuttingDown) {
    try {
      // Check if we can pick up more jobs
      if (activeJobs < MAX_CONCURRENT_JOBS) {
        const job = await getNextQueuedJob();

        if (job) {
          console.log(`[Worker] Picked up job ${job.id} (${job.job_type})`);
          activeJobs++;

          // Process job concurrently (don't await)
          processJob(job)
            .catch((error) => {
              console.error(`[Worker] Error processing job ${job.id}:`, error);
            })
            .finally(() => {
              activeJobs--;
              console.log(`[Worker] Job ${job.id} finished. Active jobs: ${activeJobs}`);
            });
        } else {
          // No jobs available, sleep
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } else {
        // Max concurrent jobs reached, sleep
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error('[Worker] Error in worker loop:', error);
      // Sleep before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log('[Worker] Worker shutting down...');
}

/**
 * Process a single job based on job_type
 */
async function processJob(job: ScenarioJob): Promise<void> {
  try {
    console.log(`[Worker] Processing job ${job.id} (${job.job_type})`);

    // Update status to processing
    await updateJobStatus(job.id, {
      status: 'processing',
      started_at: new Date().toISOString(),
    });

    // Dispatch to appropriate processor
    let result: any;

    switch (job.job_type) {
      case 'OCR':
        result = await processOCRJob(job);
        break;

      case 'SIMULATE':
        result = await processSimulationJob(job);
        break;

      case 'PDF':
        result = await processPDFJob(job);
        break;

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark as completed
    await updateJobStatus(job.id, {
      status: 'completed',
      progress: 100,
      result_json: result,
      completed_at: new Date().toISOString(),
    });

    console.log(`[Worker] Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Mark as failed
    await updateJobStatus(job.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completed_at: new Date().toISOString(),
    });
  }
}

/**
 * OCR Job Processor
 * Extracts fields from uploaded documents
 */
async function processOCRJob(job: ScenarioJob): Promise<any> {
  console.log(`[Worker] Processing OCR job ${job.id}`);

  const input = job.input_json as {
    document_id: string;
    storage_bucket: string;
    storage_path: string;
    mime_type: string;
    filename: string;
    document_type?: string;
  };

  const { document_id, storage_bucket, storage_path, mime_type } = input;

  console.log(`[Worker] OCR extraction for document ${document_id}, path: ${storage_path}`);

  // Import dependencies
  const { supabaseAdmin } = await import('../lib/scenario-lab/supabase-client');
  const { updateJobStatus } = await import('../lib/scenario-lab/job-queue');

  try {
    // Update document status
    await (supabaseAdmin as any)
      .from('scenario_documents')
      .update({ ocr_status: 'processing' })
      .eq('id', document_id);

    // Fetch user_id from document (needed for Edge Function call)
    const { data: doc } = await (supabaseAdmin as any)
      .from('scenario_documents')
      .select('user_id')
      .eq('id', document_id)
      .single();

    if (!doc) {
      throw new Error('Document not found');
    }

    // Update job progress
    await updateJobStatus(job.id, {
      status: 'processing',
      progress: 25,
    });

    // Call document-ocr Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const ocrResponse = await fetch(`${supabaseUrl}/functions/v1/document-ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        document_id,
        document_source: 'scenario_lab',
        storage_bucket,
        storage_path,
        mime_type,
        document_type: input.document_type,
        user_id: doc.user_id,
      }),
    });

    if (!ocrResponse.ok) {
      const errorBody = await ocrResponse.text().catch(() => '');
      throw new Error(`document-ocr Edge Function error (${ocrResponse.status}): ${errorBody}`);
    }

    const extractionResult = await ocrResponse.json();

    if (!extractionResult.success) {
      throw new Error(extractionResult.error || 'Extraction failed');
    }

    console.log(
      `[Worker] Extracted ${extractionResult.extracted_fields.length} fields in ${extractionResult.duration_ms}ms`
    );

    // Update job progress
    await updateJobStatus(job.id, {
      status: 'processing',
      progress: 75,
    });

    // Delete prior extracted fields for this document (idempotency)
    await (supabaseAdmin as any)
      .from('scenario_extracted_fields')
      .delete()
      .eq('document_id', document_id);

    // Insert extracted fields
    if (extractionResult.extracted_fields.length > 0) {
      const fieldsToInsert = extractionResult.extracted_fields.map((field) => ({
        document_id,
        user_id: doc.user_id,
        field_key: field.field_key,
        field_value: field.field_value,
        field_type: field.field_type,
        confidence_score: field.confidence_score,
        extraction_method: extractionResult.extraction_method,
        source_page: field.source_page || null,
        source_bbox: null, // Not implemented in MVP
        source_text: field.source_text || null,
        was_redacted: (field as any).was_redacted || false,
        redaction_reason: (field as any).redaction_reason || null,
        approval_status: 'pending',
      }));

      const { error: insertError } = await (supabaseAdmin as any)
        .from('scenario_extracted_fields')
        .insert(fieldsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert fields: ${insertError.message}`);
      }
    }

    // Update document status
    await (supabaseAdmin as any)
      .from('scenario_documents')
      .update({
        ocr_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    console.log(
      `[Worker] OCR completed, ${extractionResult.extracted_fields.length} fields stored`
    );

    return {
      document_id,
      pages_total: extractionResult.pages_total,
      pages_processed: extractionResult.pages_processed,
      fields_extracted: extractionResult.extracted_fields.length,
      extraction_method: extractionResult.extraction_method,
      duration_ms: extractionResult.duration_ms,
    };
  } catch (error) {
    console.error(`[Worker] OCR extraction failed:`, error);

    // Mark document as failed
    await (supabaseAdmin as any)
      .from('scenario_documents')
      .update({
        ocr_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    throw error;
  }
}

/**
 * Simulation Job Processor
 * Runs Monte Carlo simulation
 */
async function processSimulationJob(job: ScenarioJob): Promise<any> {
  console.log(`[Worker] Processing simulation job ${job.id}`);

  const input = job.input_json as { version_id: string; iterations: number; seed: number };
  const { version_id, iterations, seed } = input;

  console.log(
    `[Worker] Running simulation for version ${version_id}, ${iterations} iterations, seed ${seed}`
  );

  // Import simulator engine
  const { runSimulation, calculateInputsHash } =
    await import('../lib/scenario-lab/simulator/engine');
  const { supabaseAdmin } = await import('../lib/scenario-lab/supabase-client');

  // Run simulation
  const result = await runSimulation(version_id, {
    iterations,
    seed,
    model_version: '1.0',
  });

  console.log(
    `[Worker] Simulation completed in ${result.duration_ms}ms, analyzed ${result.goals.length} goals`
  );

  // Fetch inputs for hash
  const { data: inputs } = await (supabaseAdmin as any)
    .from('scenario_inputs')
    .select('*')
    .eq('version_id', version_id);

  const inputsHash = inputs ? calculateInputsHash(inputs) : '';

  // Store simulation run
  const { data: simRun, error: simError } = await (supabaseAdmin as any)
    .from('scenario_sim_runs')
    .insert({
      version_id,
      iterations,
      seed,
      model_version: result.model_version,
      inputs_hash: inputsHash,
      duration_ms: result.duration_ms,
    })
    .select()
    .single();

  if (simError || !simRun) {
    throw new Error(`Failed to store simulation run: ${simError?.message}`);
  }

  // Store goal snapshots
  const goalSnapshots = result.goals.map((goal) => ({
    sim_run_id: simRun.id,
    goal_id: goal.goal_id,
    probability: goal.probability,
    p10: goal.p10,
    p50: goal.p50,
    p90: goal.p90,
    status: goal.status,
    top_drivers: goal.top_drivers,
    top_risks: goal.top_risks,
  }));

  const { error: snapshotsError } = await (supabaseAdmin as any)
    .from('scenario_goal_snapshots')
    .insert(goalSnapshots);

  if (snapshotsError) {
    throw new Error(`Failed to store goal snapshots: ${snapshotsError.message}`);
  }

  console.log(`[Worker] Stored ${goalSnapshots.length} goal snapshots`);

  return {
    sim_run_id: simRun.id,
    version_id,
    iterations,
    duration_ms: result.duration_ms,
    goals_analyzed: result.goals.length,
  };
}

/**
 * PDF Job Processor
 * Generates PDF reports
 */
async function processPDFJob(job: ScenarioJob): Promise<any> {
  console.log(`[Worker] Processing PDF job ${job.id}`);

  const input = job.input_json as {
    scenario_id: string;
    version_id: string;
    report_id: string;
  };

  const { scenario_id, version_id, report_id } = input;

  console.log(`[Worker] Generating PDF for scenario ${scenario_id}, version ${version_id}`);

  // Import dependencies
  const { supabaseAdmin, createAuditLog } = await import('../lib/scenario-lab/supabase-client');
  const { renderScenarioReportPDF } = await import('../lib/scenario-lab/pdf/renderer');

  try {
    // Update report status
    await (supabaseAdmin as any)
      .from('scenario_reports')
      .update({ status: 'processing' })
      .eq('id', report_id);

    // Step 1: Fetch scenario data
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('*')
      .eq('id', scenario_id)
      .single();

    if (scenarioError || !scenario) {
      throw new Error(`Failed to fetch scenario: ${scenarioError?.message}`);
    }

    // Step 2: Fetch version data
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('*')
      .eq('id', version_id)
      .single();

    if (versionError || !version) {
      throw new Error(`Failed to fetch version: ${versionError?.message}`);
    }

    // Step 3: Fetch approved inputs only
    const { data: inputs, error: inputsError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .select('*')
      .eq('version_id', version_id);

    if (inputsError) {
      throw new Error(`Failed to fetch inputs: ${inputsError?.message}`);
    }

    // Step 4: Fetch latest simulation results
    const { data: latestSim } = await (supabaseAdmin as any)
      .from('scenario_sim_runs')
      .select('id')
      .eq('version_id', version_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let simulationResults = null;
    if (latestSim) {
      const { data: goalSnapshots } = await (supabaseAdmin as any)
        .from('scenario_goal_snapshots')
        .select('*')
        .eq('sim_run_id', latestSim.id);

      if (goalSnapshots && goalSnapshots.length > 0) {
        simulationResults = {
          goals: goalSnapshots.map((g) => ({
            goal_name: g.goal_id || 'Goal',
            p10: g.p10 || 0,
            p50: g.p50 || 0,
            p90: g.p90 || 0,
            status: g.status || 'Unknown',
            top_drivers: g.top_drivers || [],
            top_risks: g.top_risks || [],
          })),
        };
      }
    }

    // Step 5: Fetch plan data
    const { data: plan, error: planError } = await (supabaseAdmin as any)
      .from('plans')
      .select('*')
      .eq('scenario_version_id', version_id)
      .single();

    if (planError || !plan) {
      throw new Error(`Failed to fetch plan: ${planError?.message}`);
    }

    // Step 6: Fetch phases
    const { data: phases, error: phasesError } = await (supabaseAdmin as any)
      .from('plan_phases')
      .select('*')
      .eq('plan_id', plan.id)
      .order('phase_number', { ascending: true });

    if (phasesError) {
      throw new Error(`Failed to fetch phases: ${phasesError?.message}`);
    }

    // Step 7: Fetch tasks
    const { data: tasks, error: tasksError } = await (supabaseAdmin as any)
      .from('plan_tasks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('task_number', { ascending: true });

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError?.message}`);
    }

    // Step 8: Prepare PDF data
    const pdfData = {
      scenario: {
        name: scenario.name,
        description: scenario.description,
        status: scenario.status,
        committed_at: scenario.committed_at || new Date().toISOString(),
      },
      version: {
        version_number: version.version_number,
        name: version.name || `Version ${version.version_number}`,
        created_at: version.created_at,
      },
      inputs:
        inputs?.map((input) => ({
          field_name: input.field_name,
          field_value: input.field_value,
          category: input.category || 'other',
          source: input.source || 'User Input',
        })) || [],
      simulation: simulationResults,
      plan: {
        name: plan.name,
        description: plan.description || '',
        created_at: plan.created_at,
      },
      phases:
        phases?.map((phase) => ({
          phase_number: phase.phase_number,
          name: phase.name,
          description: phase.description || '',
          start_date: phase.start_date,
          end_date: phase.end_date,
        })) || [],
      tasks:
        tasks?.map((task) => ({
          phase_number: task.phase_number,
          task_number: task.task_number,
          title: task.title,
          description: task.description || '',
          category: task.category,
          priority: task.priority,
          status: task.status,
          due_date: task.due_date,
          estimated_hours: task.estimated_hours,
          rationale: task.rationale,
        })) || [],
      metadata: {
        reportId: report_id,
        generatedAt: new Date().toISOString(),
      },
    };

    console.log(`[Worker] Rendering PDF with ${pdfData.tasks.length} tasks...`);

    // Step 9: Generate PDF
    const pdfBuffer = await renderScenarioReportPDF(pdfData);

    console.log(`[Worker] PDF generated, size: ${pdfBuffer.length} bytes`);

    // Step 10: Upload to storage
    const storagePath = `${scenario.user_id}/${scenario_id}/${report_id}.pdf`;

    const { error: uploadError } = await (supabaseAdmin as any).storage
      .from('scenario-reports')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    console.log(`[Worker] PDF uploaded to ${storagePath}`);

    // Step 11: Count pages (approximate: 1 page per 1000 tasks + base pages)
    const estimatedPages = Math.max(6, Math.ceil(pdfData.tasks.length / 15) + 5);

    // Step 12: Update report record
    await (supabaseAdmin as any)
      .from('scenario_reports')
      .update({
        status: 'completed',
        storage_path: storagePath,
        file_size: pdfBuffer.length,
        page_count: estimatedPages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report_id);

    // Step 13: Audit log
    await createAuditLog({
      user_id: scenario.user_id,
      action: 'report.generated',
      resource_type: 'scenario_report',
      resource_id: report_id,
      metadata: {
        scenario_id,
        version_id,
        file_size: pdfBuffer.length,
        page_count: estimatedPages,
        storage_path: storagePath,
      },
    });

    console.log(`[Worker] PDF report generated successfully: ${report_id}`);

    return {
      report_id,
      scenario_id,
      version_id,
      file_size: pdfBuffer.length,
      page_count: estimatedPages,
      storage_path: storagePath,
    };
  } catch (error) {
    console.error(`[Worker] PDF generation failed:`, error);

    // Mark report as failed
    await (supabaseAdmin as any)
      .from('scenario_reports')
      .update({
        status: 'failed',
        error_text: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq('id', report_id);

    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = () => {
    console.log('[Worker] Received shutdown signal');
    isShuttingDown = true;

    // Wait for active jobs to complete (max 30 seconds)
    const timeout = setTimeout(() => {
      console.log('[Worker] Force shutdown after timeout');
      process.exit(0);
    }, 30000);

    const checkInterval = setInterval(() => {
      if (activeJobs === 0) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        console.log('[Worker] All jobs completed, exiting');
        process.exit(0);
      }
    }, 1000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Entry point
 */
if (require.main === module) {
  setupShutdownHandlers();
  workerLoop().catch((error) => {
    console.error('[Worker] Fatal error:', error);
    process.exit(1);
  });
}

export { workerLoop, processJob };
