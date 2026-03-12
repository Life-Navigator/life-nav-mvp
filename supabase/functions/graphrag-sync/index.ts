// ==========================================================================
// GraphRAG Sync Worker
// Claims pending sync jobs from graphrag.sync_queue, generates Gemini
// embeddings, and upserts/deletes from Neo4j Aura + Qdrant Cloud.
// Triggered by cron or webhook after data changes.
// ==========================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SyncJob = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  source_table: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  neo4j_synced: boolean;
  qdrant_synced: boolean;
  sync_status: string;
  attempts: number;
  max_attempts: number;
};

type SyncConfig = {
  geminiKey: string;
  neo4jUrl: string;
  neo4jUser: string;
  neo4jPass: string;
  qdrantUrl: string;
  qdrantKey: string;
  qdrantCollection: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

const MAX_CLAIM = 50;
const JOB_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  if (ae.length !== be.length) return false;
  let diff = 0;
  for (let i = 0; i < ae.length; i++) diff |= ae[i] ^ be[i];
  return diff === 0;
}

function safeError(v: unknown): string {
  const raw = v instanceof Error ? v.message : String(v);
  return raw.length > 2000 ? raw.slice(0, 2000) : raw;
}

// ---------------------------------------------------------------------------
// Entity text builder (for Gemini embedding)
// ---------------------------------------------------------------------------

function buildEntityText(
  entityType: string,
  payload: Record<string, unknown>,
): string {
  const parts: string[] = [];

  switch (entityType) {
    case 'goal':
      parts.push(`Goal: ${payload.title || 'Untitled'}`);
      if (payload.category) parts.push(`Category: ${payload.category}`);
      if (payload.status) parts.push(`Status: ${payload.status}`);
      if (payload.priority) parts.push(`Priority: ${payload.priority}`);
      if (payload.target_value != null)
        parts.push(
          `Target: ${payload.target_value} ${payload.target_unit || ''}`.trim(),
        );
      if (payload.description)
        parts.push(`Description: ${payload.description}`);
      break;

    case 'financial_account':
      parts.push(
        `Financial Account: ${payload.account_name || 'Unknown'}`,
      );
      if (payload.account_type) parts.push(`Type: ${payload.account_type}`);
      if (payload.institution)
        parts.push(`Institution: ${payload.institution}`);
      if (payload.current_balance != null)
        parts.push(`Balance: ${payload.current_balance}`);
      break;

    case 'risk_assessment':
      parts.push('Risk Assessment');
      if (payload.overall_score != null)
        parts.push(`Overall Score: ${payload.overall_score}`);
      if (payload.risk_level) parts.push(`Risk Level: ${payload.risk_level}`);
      if (payload.assessment_type)
        parts.push(`Type: ${payload.assessment_type}`);
      break;

    case 'career_profile':
      parts.push('Career Profile');
      if (payload.current_title)
        parts.push(`Title: ${payload.current_title}`);
      if (payload.current_employer)
        parts.push(`Employer: ${payload.current_employer}`);
      if (payload.industry) parts.push(`Industry: ${payload.industry}`);
      if (payload.years_experience != null)
        parts.push(`Experience: ${payload.years_experience} years`);
      break;

    default:
      parts.push(JSON.stringify(payload).slice(0, 800));
  }

  return parts.join('. ');
}

// ---------------------------------------------------------------------------
// Neo4j helpers
// ---------------------------------------------------------------------------

const LABEL_MAP: Record<string, string> = {
  goal: 'Goal',
  financial_account: 'FinancialAccount',
  risk_assessment: 'RiskAssessment',
  career_profile: 'CareerProfile',
};

const REL_MAP: Record<string, string> = {
  goal: 'HAS_GOAL',
  financial_account: 'HAS_ACCOUNT',
  risk_assessment: 'HAS_RISK_ASSESSMENT',
  career_profile: 'HAS_CAREER_PROFILE',
};

/** Strip nested objects/arrays and nulls — Neo4j properties must be scalars. */
function scalarProps(
  payload: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v == null || typeof v === 'object') continue;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    )
      out[k] = v;
  }
  return out;
}

async function neo4jExec(
  url: string,
  user: string,
  pass: string,
  statements: Array<{
    statement: string;
    parameters?: Record<string, unknown>;
  }>,
): Promise<unknown[]> {
  const resp = await fetch(`${url}/db/neo4j/tx/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
    },
    body: JSON.stringify({ statements }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Neo4j HTTP ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  if (data.errors?.length) {
    throw new Error(`Neo4j: ${JSON.stringify(data.errors)}`);
  }
  return data.results;
}

// ---------------------------------------------------------------------------
// Qdrant helpers
// ---------------------------------------------------------------------------

async function qdrantUpsert(
  url: string,
  apiKey: string,
  collection: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  const resp = await fetch(
    `${url}/collections/${collection}/points?wait=true`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ points }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Qdrant upsert ${resp.status}: ${t}`);
  }
}

async function qdrantDelete(
  url: string,
  apiKey: string,
  collection: string,
  ids: string[],
): Promise<void> {
  const resp = await fetch(
    `${url}/collections/${collection}/points/delete?wait=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ points: ids }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Qdrant delete ${resp.status}: ${t}`);
  }
}

// ---------------------------------------------------------------------------
// Gemini embedding
// ---------------------------------------------------------------------------

async function embed(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(GEMINI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Gemini embed ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  return data.embedding.values as number[];
}

// ---------------------------------------------------------------------------
// Process one sync job
// ---------------------------------------------------------------------------

async function processJob(
  job: SyncJob,
  cfg: SyncConfig,
): Promise<{ neo4j: boolean; qdrant: boolean }> {
  const { entity_type, entity_id, user_id, operation, payload } = job;
  const label = LABEL_MAP[entity_type] || 'Entity';
  const rel = REL_MAP[entity_type] || 'HAS_ENTITY';

  // ---- DELETE ----
  if (operation === 'delete') {
    await neo4jExec(cfg.neo4jUrl, cfg.neo4jUser, cfg.neo4jPass, [
      {
        statement: `MATCH (n:${label} {entity_id: $eid, tenant_id: $tid}) DETACH DELETE n`,
        parameters: { eid: entity_id, tid: user_id },
      },
    ]);
    await qdrantDelete(cfg.qdrantUrl, cfg.qdrantKey, cfg.qdrantCollection, [
      entity_id,
    ]);
    return { neo4j: true, qdrant: true };
  }

  // ---- UPSERT ----
  const text = buildEntityText(entity_type, payload);
  const vector = await embed(text, cfg.geminiKey);
  const props = scalarProps(payload);

  // Neo4j: ensure Person node, upsert entity + relationship
  await neo4jExec(cfg.neo4jUrl, cfg.neo4jUser, cfg.neo4jPass, [
    {
      statement:
        'MERGE (p:Person {tenant_id: $tid, user_id: $uid}) RETURN p',
      parameters: { tid: user_id, uid: user_id },
    },
    {
      statement: `
        MATCH (p:Person {tenant_id: $tid})
        MERGE (n:${label} {entity_id: $eid, tenant_id: $tid})
        SET n += $props, n.updated_at = datetime()
        MERGE (p)-[:${rel}]->(n)
        RETURN n`,
      parameters: { tid: user_id, eid: entity_id, props },
    },
  ]);

  // Qdrant: upsert point
  await qdrantUpsert(cfg.qdrantUrl, cfg.qdrantKey, cfg.qdrantCollection, [
    {
      id: entity_id,
      vector,
      payload: {
        tenant_id: user_id,
        entity_type,
        entity_id,
        domain: entity_type,
        text,
        ...props,
      },
    },
  ]);

  return { neo4j: true, qdrant: true };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // --- Auth ---
    const workerSecret = Deno.env.get('GRAPHRAG_WORKER_SECRET');
    if (workerSecret) {
      const provided = req.headers.get('x-worker-secret');
      if (!provided || !constantTimeEqual(provided, workerSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    // --- Environment ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const neo4jUrl = Deno.env.get('NEO4J_HTTP_URL');
    const neo4jUser = Deno.env.get('NEO4J_USERNAME');
    const neo4jPass = Deno.env.get('NEO4J_PASSWORD');
    const qdrantUrl = Deno.env.get('QDRANT_URL');
    const qdrantKey = Deno.env.get('QDRANT_API_KEY');
    const qdrantCollection =
      Deno.env.get('QDRANT_COLLECTION') || 'life_navigator';

    if (
      !geminiKey ||
      !neo4jUrl ||
      !neo4jUser ||
      !neo4jPass ||
      !qdrantUrl ||
      !qdrantKey
    ) {
      throw new Error(
        'Missing required env vars: GEMINI_API_KEY, NEO4J_HTTP_URL, NEO4J_USERNAME, NEO4J_PASSWORD, QDRANT_URL, QDRANT_API_KEY',
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(
      Math.max(Number(body?.limit) || 25, 1),
      MAX_CLAIM,
    );

    // --- Claim jobs ---
    // NOTE: graphrag schema must be added to Supabase "Exposed schemas" in API settings.
    const { data: jobs, error: claimErr } = await supabase
      .schema('graphrag')
      .rpc('claim_sync_jobs', { p_limit: limit });

    if (claimErr) throw new Error(`Claim failed: ${claimErr.message}`);

    const claimed = (jobs || []) as SyncJob[];
    const summary = {
      claimed: claimed.length,
      completed: 0,
      failed: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    const cfg: SyncConfig = {
      geminiKey,
      neo4jUrl,
      neo4jUser,
      neo4jPass,
      qdrantUrl,
      qdrantKey,
      qdrantCollection,
    };

    // --- Process each job ---
    for (const job of claimed) {
      const started = Date.now();
      try {
        // Per-job timeout guard
        const result = await Promise.race([
          processJob(job, cfg),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Job timeout exceeded')),
              JOB_TIMEOUT_MS,
            ),
          ),
        ]);

        await supabase.schema('graphrag').rpc('complete_sync_job', {
          p_job_id: job.id,
          p_neo4j_synced: result.neo4j,
          p_qdrant_synced: result.qdrant,
        });

        summary.completed++;
        summary.details.push({
          job_id: job.id,
          entity_type: job.entity_type,
          operation: job.operation,
          status: 'completed',
          duration_ms: Date.now() - started,
        });
      } catch (err) {
        const errText = safeError(err);

        await supabase.schema('graphrag').rpc('complete_sync_job', {
          p_job_id: job.id,
          p_error: errText,
        });

        summary.failed++;
        summary.details.push({
          job_id: job.id,
          entity_type: job.entity_type,
          operation: job.operation,
          status: 'failed',
          error: errText,
          duration_ms: Date.now() - started,
        });
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: safeError(error) }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
