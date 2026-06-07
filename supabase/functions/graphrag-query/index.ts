// ==========================================================================
// GraphRAG Query Handler
// Accepts a user question, runs hybrid search (Qdrant vector + Neo4j graph),
// fuses results with Reciprocal Rank Fusion, and generates a personalized
// answer via Gemini Flash — streamed back as SSE.
//
// PIPELINE PROXY: If GRAPHRAG_PIPELINE_URL is set, queries are proxied to
// the Python GraphRAG pipeline for richer results. Falls back to inline
// logic if the pipeline is unavailable.
// ==========================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  type FinanceAccount,
  type PersonalData,
  formatAuthoritativePersonal,
  buildMissingData,
} from './grounding.ts';
import { geminiFetch } from './retry.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QueryRequest = {
  query: string;
  user_id?: string;
  stream?: boolean;
  conversation_id?: string;
  previous_messages?: Array<{ role: string; content: string }>;
};

type SearchResult = {
  entity_id: string;
  entity_type: string;
  text: string;
  score: number;
  source: 'vector' | 'graph';
  metadata?: Record<string, unknown>;
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
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const GEMINI_GENERATE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_STREAM_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';

const VECTOR_TOP_K = 10;
const RRF_K = 60; // Reciprocal Rank Fusion constant

// ---------------------------------------------------------------------------
// Graph schema (used by NL→Cypher prompt)
// ---------------------------------------------------------------------------

const GRAPH_SCHEMA = `\
Node labels and properties:
- (:Person {tenant_id, user_id, name})
- (:Goal {entity_id, tenant_id, title, category, status, priority, target_value, target_unit, description})
- (:FinancialAccount {entity_id, tenant_id, account_name, account_type, institution, current_balance, currency})
- (:RiskAssessment {entity_id, tenant_id, overall_score, risk_level, assessment_type})
- (:CareerProfile {entity_id, tenant_id, current_title, current_employer, industry, years_experience})

Relationships:
- (Person)-[:HAS_GOAL]->(Goal)
- (Person)-[:HAS_ACCOUNT]->(FinancialAccount)
- (Person)-[:HAS_RISK_ASSESSMENT]->(RiskAssessment)
- (Person)-[:HAS_CAREER_PROFILE]->(CareerProfile)
- (Goal)-[:DEPENDS_ON]->(Goal)`;

const CYPHER_SYSTEM = `\
You are a Neo4j Cypher query generator for a personal life management app.
Given the user's natural-language question, produce ONE read-only Cypher query.

${GRAPH_SCHEMA}

RULES:
1. ALWAYS filter by tenant_id = $tenant_id (provided automatically).
2. Only read queries — no CREATE, MERGE, SET, DELETE.
3. RETURN human-readable columns.
4. Limit to 20 rows max.
5. Use OPTIONAL MATCH when a relationship may not exist.

Respond with ONLY a JSON object (no markdown, no explanation):
{"cypher": "MATCH ...", "params": {}}

$tenant_id is injected automatically — do NOT include it in params.
If the question cannot be answered from this schema, return:
{"cypher": null, "params": {}}`;

const ANSWER_SYSTEM = `\
You are Life Navigator, a personalized AI financial and life advisor.

Your context below is split into FOUR clearly labeled sections. They have
different jobs and different authority:

- CENTRAL_CONTEXT — shared policy, methodology, compliance and advice
  constraints. It governs HOW you answer (framing, allowed language, advice
  principles). It is the SAME for every user and NEVER contains this user's
  personal facts.
- AUTHORITATIVE_PERSONAL_FACTS — the user's ACTUAL situation across ALL domains,
  read directly from their secure systems of record: financial accounts,
  balances, APRs, institutions and liabilities; transactions; employer benefits
  and salary; retirement plans; goals; career profile and job applications;
  education and courses; simulation/scenario results; and prior chat sessions.
  This is the ONLY source of truth for ANY personal fact about the user.
- PERSONAL_CONTEXT — additional user-specific facts retrieved from their personal
  knowledge graph (enrichment). It is NOT the primary source; prefer
  AUTHORITATIVE_PERSONAL_FACTS for any concrete value.
- MISSING_DATA — categories of the user's data that are NOT available right now.

HARD RULES — you MUST follow these exactly:
1. Central guidance tells you HOW to answer. AUTHORITATIVE_PERSONAL_FACTS and
   PERSONAL_CONTEXT tell you WHAT is true about this user. Never mix these up.
2. ANY factual statement about this user's situation — money (balances, accounts,
   institutions, APRs, debts, income, net worth, transactions), goals, benefits,
   retirement, career/job applications, education/courses, simulation results, or
   what was said in prior chats — MUST come verbatim from AUTHORITATIVE_PERSONAL_FACTS
   (or, if explicitly present there, PERSONAL_CONTEXT). Do not change values, add
   items, or invent names/institutions/employers/schools.
3. If the user asks for ANY personal fact that is NOT in those sections (or is
   listed under MISSING_DATA, including a domain marked "NONE on file"), you MUST
   say you don't have that information for them yet and offer to help them add or
   connect it. Do NOT estimate it, infer it, or fill it in from an example.
4. NEVER fabricate personal data of ANY kind. Never use sample values, generic
   figures, well-known company/bank/school names, or details from CENTRAL_CONTEXT
   or your own training as if they were this user's. If you are not certain a
   detail came from AUTHORITATIVE_PERSONAL_FACTS, do not state it.
5. Never derive a personal fact from CENTRAL_CONTEXT. Central content is
   policy/education only — it never reports what this user has or did.
6. Use CENTRAL_CONTEXT for methodology and compliant, non-guaranteeing language
   (no "guaranteed", "will earn", "risk-free"). Be encouraging, realistic, and
   give concrete next steps grounded ONLY in the user's real data.`;

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

function hashQuery(query: string): string {
  // Simple djb2 hash for cache lookup
  const bytes = new TextEncoder().encode(query.trim().toLowerCase());
  let h = 5381;
  for (const b of bytes) h = ((h << 5) + h + b) >>> 0;
  return h.toString(16);
}

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

async function embedQuery(
  text: string,
  apiKey: string,
): Promise<number[]> {
  const resp = await geminiFetch(GEMINI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
  }, 'embed');
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Gemini embed ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.embedding.values as number[];
}

async function geminiGenerate(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const resp = await geminiFetch(GEMINI_GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    }),
  }, 'generate');
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Gemini generate ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Stream a Gemini answer. Returns a ReadableStream of text chunks.
 */
function geminiStream(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; parts: Array<{ text: string }> }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const resp = await geminiFetch(GEMINI_STREAM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: messages,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              topP: 0.9,
            },
          }),
        }, 'stream');

        if (!resp.ok || !resp.body) {
          const t = await resp.text().catch(() => '');
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `Gemini stream ${resp.status}: ${t}` })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') continue;

            try {
              const parsed = JSON.parse(json);
              const text =
                parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text })}\n\n`,
                  ),
                );
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: safeError(err) })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Qdrant vector search
// ---------------------------------------------------------------------------

async function qdrantSearch(
  url: string,
  apiKey: string,
  collection: string,
  vector: number[],
  tenantId: string,
): Promise<SearchResult[]> {
  const resp = await fetch(
    `${url}/collections/${collection}/points/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        vector,
        filter: {
          must: [{ key: 'tenant_id', match: { value: tenantId } }],
        },
        limit: VECTOR_TOP_K,
        with_payload: true,
        score_threshold: 0.3,
      }),
    },
  );

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error(`Qdrant search failed: ${resp.status} ${t}`);
    return [];
  }

  const data = await resp.json();
  return (data.result || []).map(
    (
      hit: {
        id: string;
        score: number;
        payload?: Record<string, unknown>;
      },
      idx: number,
    ) => ({
      entity_id: String(hit.id),
      entity_type: String(hit.payload?.entity_type || 'unknown'),
      text: String(hit.payload?.text || ''),
      score: hit.score,
      source: 'vector' as const,
      metadata: hit.payload,
    }),
  );
}

// ---------------------------------------------------------------------------
// Neo4j graph query (NL → Cypher via Gemini)
// ---------------------------------------------------------------------------

async function neo4jExec(
  url: string,
  user: string,
  pass: string,
  cypher: string,
  params: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  // Aura forbids the legacy `/db/{db}/tx/commit` endpoint (403 "Denied by
  // administrative rules") — always target the Query API v2. Accept either
  // a full Query API URL (NEO4J_QUERY_API_URL, e.g.
  // https://<host>/db/<db>/query/v2) or a base/bolt URL (NEO4J_HTTP_URL /
  // NEO4J_URI), normalizing the bolt scheme Aura hands out to https.
  const normalized = url
    .replace(/\/+$/, '')
    .replace(/^(neo4j\+s|neo4j\+ssc|neo4j|bolt\+s|bolt\+ssc|bolt):\/\//, 'https://');
  let endpoint: string;
  if (/\/db\/[^/]+\/query\/v2$/.test(normalized)) {
    endpoint = normalized;
  } else {
    // This Aura instance's single database is named after the dbid, not
    // "neo4j". Prefer the explicit secret, fall back to the host prefix.
    const host = normalized.split('://')[1] || '';
    const database =
      Deno.env.get('NEO4J_PERSONAL_DATABASE') || host.split('.')[0] || 'neo4j';
    endpoint = `${normalized}/db/${database}/query/v2`;
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
    },
    body: JSON.stringify({ statement: cypher, parameters: params }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Neo4j ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  // Query API v2 response shape: { data: { fields: [...], values: [[...]] } }
  const block = data.data || {};
  const fields: string[] = block.fields || [];
  const values: unknown[][] = block.values || [];
  return values.map((row) => {
    const record: Record<string, unknown> = {};
    fields.forEach((col, i) => (record[col] = row[i]));
    return record;
  });
}

async function graphSearch(
  query: string,
  tenantId: string,
  geminiKey: string,
  neo4jUrl: string,
  neo4jUser: string,
  neo4jPass: string,
): Promise<SearchResult[]> {
  // Step 1: NL → Cypher via Gemini. Graph context is OPTIONAL — if this Gemini
  // call transiently fails, degrade to no graph results rather than failing the
  // whole request (this was a leading cause of the chat 502s).
  let cypherJson: string;
  try {
    cypherJson = await geminiGenerate(geminiKey, CYPHER_SYSTEM, query);
  } catch (err) {
    console.warn('NL→Cypher generation failed; skipping graph search:', safeError(err));
    return [];
  }

  let parsed: { cypher: string | null; params: Record<string, unknown> };
  try {
    // Strip potential markdown code fences
    const cleaned = cypherJson
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse Cypher JSON:', cypherJson);
    return [];
  }

  if (!parsed.cypher) return [];

  // Step 2: Execute Cypher with tenant filter injected
  const params = { ...parsed.params, tenant_id: tenantId };
  try {
    const rows = await neo4jExec(
      neo4jUrl,
      neo4jUser,
      neo4jPass,
      parsed.cypher,
      params,
    );

    return rows.map((row, idx) => ({
      entity_id: String(row.entity_id || row.id || `graph_${idx}`),
      entity_type: String(row.entity_type || row.label || 'graph_result'),
      text: JSON.stringify(row),
      score: 1.0 - idx * 0.05, // Decreasing relevance by position
      source: 'graph' as const,
      metadata: row,
    }));
  } catch (err) {
    console.error('Neo4j query failed:', safeError(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion
// ---------------------------------------------------------------------------

function reciprocalRankFusion(
  ...rankings: SearchResult[][]
): SearchResult[] {
  const scores = new Map<string, { score: number; result: SearchResult }>();

  for (const ranking of rankings) {
    ranking.forEach((result, rank) => {
      const key = result.entity_id;
      const rrf = 1 / (RRF_K + rank + 1);
      const existing = scores.get(key);
      if (existing) {
        existing.score += rrf;
        // Keep the result with more text
        if (result.text.length > existing.result.text.length) {
          existing.result = { ...result, score: existing.score };
        } else {
          existing.result.score = existing.score;
        }
      } else {
        scores.set(key, { score: rrf, result: { ...result, score: rrf } });
      }
    });
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.result);
}

// ---------------------------------------------------------------------------
// Build answer context
// ---------------------------------------------------------------------------

// Central (shared policy/methodology) vector search. NO tenant filter — central
// knowledge is global and contains no personal data. Best-effort; returns [] on
// any failure so it can never break a request.
async function qdrantSearchCentral(
  url: string,
  apiKey: string,
  collection: string,
  vector: number[],
): Promise<SearchResult[]> {
  try {
    const resp = await fetch(`${url}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        vector,
        limit: 6,
        with_payload: true,
        score_threshold: 0.3,
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.result || []).map(
      (hit: { id: string; score: number; payload?: Record<string, unknown> }) => ({
        entity_id: String(hit.id),
        entity_type: String(hit.payload?.entity_type || 'policy'),
        text: String(
          hit.payload?.summary || hit.payload?.text || hit.payload?.title || '',
        ),
        score: hit.score,
        source: 'vector' as const,
        metadata: hit.payload,
      }),
    );
  } catch {
    return [];
  }
}

// PERSONAL_CONTEXT — enrichment facts from the user's personal graph/vector.
function buildPersonalContext(results: SearchResult[]): string {
  const header = '## PERSONAL_CONTEXT (user-specific enrichment from personal knowledge graph)';
  if (results.length === 0) {
    return `${header}\n(No additional personal context retrieved.)`;
  }
  const lines = results.slice(0, 15).map((r) => `- [${r.entity_type}] ${r.text}`);
  return `${header}\n${lines.join('\n')}`;
}

// CENTRAL_CONTEXT — shared policy/methodology (HOW to answer). No personal data.
//
// v1 NOTE (2026-06-06): the ln_central Qdrant collection is empty — no curated
// central corpus has been ingested. Telling the model to "consult
// CENTRAL_CONTEXT" while CENTRAL_CONTEXT is empty wastes tokens and risks
// confusing the model. Until the central seed corpus lands (audit recommends
// fiduciary stance / debt-before-invest / emergency reserve / compliance
// language / decision-framework primers), the function returns the empty string
// so no CENTRAL_CONTEXT block is appended at all. The system prompt's
// references to CENTRAL_CONTEXT remain in place but the model simply does not
// see the section. Re-enable by removing the early return when results > 0.
function buildCentralContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }
  const header =
    '## CENTRAL_CONTEXT (shared advice policy & methodology — governs HOW to answer, never WHAT the user has)';
  const lines = results.slice(0, 8).map((r) => `- ${r.text}`);
  return `${header}\n${lines.join('\n')}`;
}

// Deterministic, authoritative read from the finance system of record. Independent
// of async graph promotion, so personal balances are ALWAYS grounded when present.
// Returns null on fetch error (distinct from [] = user genuinely has no accounts).
// Generic bounded read of one user-scoped domain table. Returns null on error
// (distinct from [] = genuinely none), so the formatter can fail closed.
async function fetchDomain(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  schema: string,
  table: string,
  fields: string,
  userId: string,
  opts: { orderBy?: string; limit?: number; eq?: Record<string, unknown> } = {},
  // deno-lint-ignore no-explicit-any
): Promise<any[] | null> {
  try {
    let q = supabase.schema(schema).from(table).select(fields).eq('user_id', userId);
    if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) q = q.eq(k, v);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) {
      console.warn(`Authoritative ${schema}.${table} error:`, error.message);
      return null;
    }
    return data ?? [];
  } catch (e) {
    console.warn(`Authoritative ${schema}.${table} threw:`, safeError(e));
    return null;
  }
}

// Read EVERY authoritative personal domain in parallel (each bounded). This is
// the system of record for any personal fact — finances, goals, transactions,
// benefits, career, education, simulations, prior chats — so the model never
// has to (and is told never to) invent one.
async function fetchAuthoritativePersonal(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<PersonalData> {
  const [
    accounts,
    goals,
    transactions,
    benefits,
    retirement,
    career,
    jobApplications,
    education,
    courses,
    simulations,
    persona,
    sessions,
  ] = await Promise.all([
    fetchDomain(supabase, 'finance', 'financial_accounts',
      'account_name, account_type, institution_name, current_balance, available_balance, interest_rate, credit_limit, currency',
      userId, { eq: { is_active: true } }),
    fetchDomain(supabase, 'public', 'goals',
      'title, category, status, progress_percent, target_value, current_value, unit, target_date, priority',
      userId, { orderBy: 'updated_at', limit: 12 }),
    fetchDomain(supabase, 'finance', 'transactions',
      'transaction_date, amount, currency, description, merchant, category, transaction_type',
      userId, { orderBy: 'transaction_date', limit: 12 }),
    fetchDomain(supabase, 'finance', 'employer_benefits',
      'employer_name, salary, bonus_target, stock_grants, retirement_match_percent, health_benefits, is_current',
      userId, { orderBy: 'updated_at', limit: 4 }),
    fetchDomain(supabase, 'finance', 'retirement_plans',
      'plan_name, target_retirement_age, current_savings, monthly_contribution',
      userId, { orderBy: 'updated_at', limit: 3 }),
    fetchDomain(supabase, 'public', 'career_profiles',
      'current_title, current_company, industry, years_of_experience, desired_title, desired_salary_min, desired_salary_max, skills',
      userId, { orderBy: 'updated_at', limit: 2 }),
    fetchDomain(supabase, 'public', 'job_applications',
      'company, position, status, applied_date',
      userId, { orderBy: 'applied_date', limit: 8 }),
    fetchDomain(supabase, 'public', 'education_records',
      'institution_name, degree_type, field_of_study, gpa, status',
      userId, { orderBy: 'updated_at', limit: 5 }),
    fetchDomain(supabase, 'public', 'courses',
      'course_name, provider, status, progress_percent',
      userId, { orderBy: 'updated_at', limit: 8 }),
    fetchDomain(supabase, 'public', 'scenario_sim_runs',
      'created_at, status, overall_robustness_score, market_adjusted_probability, goals_simulated',
      userId, { orderBy: 'created_at', limit: 5 }),
    fetchDomain(supabase, 'public', 'user_persona_profile',
      'display_name, life_stage, profession, income_type',
      userId, { orderBy: 'updated_at', limit: 1 }),
    fetchDomain(supabase, 'public', 'ai_sessions',
      'title, session_type, message_count, last_message_at',
      userId, { orderBy: 'last_message_at', limit: 5 }),
  ]);
  return {
    accounts: accounts as FinanceAccount[] | null,
    goals, transactions, benefits, retirement, career,
    jobApplications, education, courses, simulations, persona, sessions,
  };
}

// Pure formatting helpers (formatAuthoritativePersonal, formatAuthoritativeFinance,
// buildMissingData, …) live in ./grounding.ts so they can be unit-tested.

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
    // --- Environment ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const neo4jUrl =
      Deno.env.get('NEO4J_QUERY_API_URL') || Deno.env.get('NEO4J_HTTP_URL');
    const neo4jUser = Deno.env.get('NEO4J_USERNAME');
    const neo4jPass = Deno.env.get('NEO4J_PASSWORD');
    const qdrantUrl = Deno.env.get('QDRANT_URL');
    const qdrantKey = Deno.env.get('QDRANT_API_KEY');
    const qdrantCollection =
      Deno.env.get('QDRANT_PERSONAL_COLLECTION') ||
      Deno.env.get('QDRANT_COLLECTION') ||
      'life_navigator';
    const qdrantCentralCollection =
      Deno.env.get('QDRANT_CENTRAL_COLLECTION') || 'ln_central';

    if (
      !geminiKey ||
      !neo4jUrl ||
      !neo4jUser ||
      !neo4jPass ||
      !qdrantUrl ||
      !qdrantKey
    ) {
      throw new Error('Missing required GraphRAG env vars');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- Authenticate caller ---
    let userId: string | null = null;

    // Option 1: Worker secret (service-to-service)
    const workerSecret = Deno.env.get('GRAPHRAG_WORKER_SECRET');
    const providedSecret = req.headers.get('x-worker-secret');
    if (workerSecret && providedSecret && constantTimeEqual(providedSecret, workerSecret)) {
      // Trusted caller — user_id must be in body
    } else {
      // Option 2: User JWT
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      const token = authHeader.slice(7);
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      userId = user.id;
    }

    // --- Parse request ---
    const body: QueryRequest = await req.json();
    const { query, stream = false, conversation_id, previous_messages } = body;
    userId = userId || body.user_id || null;

    if (!query || !userId) {
      return new Response(
        JSON.stringify({ error: 'query and user_id are required' }),
        {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // --- Check cache ---
    const qHash = hashQuery(query);
    const { data: cached } = await supabase
      .schema('graphrag')
      .from('query_cache')
      .select('response, sources, confidence')
      .eq('user_id', userId)
      .eq('query_hash', qHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached && !stream) {
      return new Response(JSON.stringify(cached.response), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- Try Python pipeline proxy first ---
    const pipelineUrl = Deno.env.get('GRAPHRAG_PIPELINE_URL');
    if (pipelineUrl) {
      try {
        const pipelineResp = await fetch(`${pipelineUrl}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': Deno.env.get('GRAPHRAG_WORKER_SECRET') || '',
          },
          body: JSON.stringify({
            query,
            user_id: userId,
            stream,
            conversation_id,
            previous_messages,
          }),
          signal: AbortSignal.timeout(55_000),
        });

        if (pipelineResp.ok) {
          const pipelineBody = await pipelineResp.text();
          return new Response(pipelineBody, {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': pipelineResp.headers.get('Content-Type') || 'application/json',
            },
            status: 200,
          });
        }
        // Pipeline returned non-200 — fall through to inline logic
        console.warn(`Pipeline returned ${pipelineResp.status}, falling back to inline`);
      } catch (pipelineErr) {
        // Pipeline unreachable — fall through to inline logic
        console.warn(`Pipeline proxy failed: ${safeError(pipelineErr)}, falling back to inline`);
      }
    }

    // --- Hybrid search (inline fallback) ---
    const startMs = Date.now();

    // Embed query — OPTIONAL. If embedding transiently fails, degrade to graph-
    // only (or no) context instead of failing the whole request with a 500.
    let queryVector: number[] | null = null;
    try {
      queryVector = await embedQuery(query, geminiKey);
    } catch (embedErr) {
      console.warn('Query embedding failed; skipping vector search:', safeError(embedErr));
    }

    // Parallel: vector search (if embedded) + graph search. Both are individually
    // resilient and return [] on failure, so neither can 500 the request.
    const [vectorResults, graphResults] = await Promise.all([
      queryVector
        ? qdrantSearch(qdrantUrl, qdrantKey, qdrantCollection, queryVector, userId)
        : Promise.resolve([]),
      graphSearch(query, userId, geminiKey, neo4jUrl, neo4jUser, neo4jPass),
    ]);

    // PERSONAL_CONTEXT — fuse personal graph + vector (enrichment).
    const fused = reciprocalRankFusion(vectorResults, graphResults);
    const personalContext = buildPersonalContext(fused);

    // CENTRAL_CONTEXT — shared policy/methodology (HOW to answer). Reuse the
    // already-computed query vector; no tenant filter. Best-effort.
    const centralResults = queryVector
      ? await qdrantSearchCentral(qdrantUrl, qdrantKey, qdrantCentralCollection, queryVector)
      : [];
    const centralContext = buildCentralContext(centralResults);

    // AUTHORITATIVE_PERSONAL_FACTS — deterministic, direct from the systems of
    // record across EVERY personal domain (finances, goals, transactions,
    // benefits, career, education, simulations, prior chats). Independent of
    // async graph promotion, so personal facts are grounded whenever they
    // exist. THIS is what prevents the model from inventing ANY personal fact.
    const personalData = await fetchAuthoritativePersonal(supabase, userId);
    const authoritativePersonal = formatAuthoritativePersonal(personalData);

    // --- Fetch user risk profile for personalization (part of PERSONAL_CONTEXT) ---
    const { data: riskProfile } = await supabase
      .from('risk_assessments')
      .select('overall_score, risk_level, assessment_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let riskContext = '';
    if (riskProfile) {
      riskContext = `\n- Risk Level: ${riskProfile.risk_level}; Overall Score: ${riskProfile.overall_score}/100; Assessment: ${riskProfile.assessment_type}`;
    }

    const missingData = buildMissingData(personalData);

    // Assemble the four labeled sections. Order: policy (how) → authoritative
    // facts (what) → personal enrichment → what's missing.
    const fullContext = [
      centralContext,
      authoritativePersonal,
      personalContext + riskContext,
      missingData,
    ].join('\n\n');

    // Build conversation messages
    const messages: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }> = [];

    // Include previous conversation for context
    if (previous_messages?.length) {
      for (const msg of previous_messages.slice(-6)) {
        messages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Current query with retrieved context
    messages.push({
      role: 'user',
      parts: [
        {
          text: `${fullContext}\n\n---\n\nUser question: ${query}`,
        },
      ],
    });

    // --- Generate answer ---
    if (stream) {
      const sseStream = geminiStream(geminiKey, ANSWER_SYSTEM, messages);

      return new Response(sseStream, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming: single response. Degrade gracefully instead of 500ing if
    // the (already-retried) generation fails, so the caller never sees a bare
    // upstream error.
    let answer = '';
    try {
      answer = await geminiGenerate(
        geminiKey,
        ANSWER_SYSTEM,
        `${fullContext}\n\n---\n\nUser question: ${query}`,
      );
    } catch (genErr) {
      console.warn('Answer generation failed after retries:', safeError(genErr));
    }
    if (!answer) {
      answer =
        "I'm having trouble reaching my reasoning engine at the moment. Your accounts are loaded and your dashboard brief is up to date — please ask again in a few seconds and I'll pick up right where we left off.";
    }

    const durationMs = Date.now() - startMs;

    const response = {
      message: answer,
      conversation_id: conversation_id || `conv_${crypto.randomUUID()}`,
      sources: fused.slice(0, 5).map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        score: r.score,
        source: r.source,
      })),
      metadata: {
        duration_ms: durationMs,
        vector_results: vectorResults.length,
        graph_results: graphResults.length,
        fused_results: fused.length,
      },
    };

    // --- Cache the response ---
    await supabase
      .schema('graphrag')
      .from('query_cache')
      .insert({
        user_id: userId,
        query_hash: qHash,
        query_text: query,
        response,
        sources: response.sources,
        confidence: fused.length > 0 ? fused[0].score : 0,
        duration_ms: durationMs,
      })
      .then(() => {}) // fire-and-forget
      .catch(() => {}); // ignore cache write failures

    return new Response(JSON.stringify(response), {
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
