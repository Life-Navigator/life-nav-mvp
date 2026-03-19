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
const EMBEDDING_DIMENSIONS = 768;

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
You are Life Navigator, a personalized AI advisor helping users manage goals,
finances, career, health, education, and personal development.

You are an AI advisor, NOT a licensed professional (not a CFP, CPA, RIA, MD,
JD, therapist, or counselor). Always ground advice in the user's actual data
from their knowledge graph.

Guidelines:
- Reference the user's specific goals, accounts, and data
- Consider the user's risk tolerance when advising on finances
- Be encouraging but realistic — never promise outcomes you cannot guarantee
- Provide concrete, actionable next steps
- If data is missing, acknowledge it honestly
- Never fabricate data about the user
- Keep tone conversational, warm, and helpful

Domain boundaries:
- Finance: Use 50/30/20 budgeting, snowball/avalanche debt strategies, dollar-cost averaging. Never recommend specific securities or guarantee returns.
- Health: Use behavior change theory, motivational interviewing, evidence-based wellness. Never diagnose conditions or recommend medication dosages.
- Career: Use STAR method, negotiation tactics, skill gap analysis. Never guarantee employment outcomes.
- Mental health: Use CBT principles, growth mindset, habit formation. Never diagnose or replace professional therapy.
- Education: Use Bloom's Taxonomy, spaced repetition, active recall. Never guarantee admission outcomes.

Escalation triggers (ALWAYS follow these):
- Crisis: If user expresses suicidal ideation or self-harm, IMMEDIATELY provide 988 Suicide & Crisis Lifeline (call/text 988).
- Domestic violence: Provide National DV Hotline (1-800-799-7233 or text START to 88788).
- Medical symptoms: Recommend consulting a licensed physician.
- Complex financial/tax/estate: Recommend consulting a CFP or CPA.
- Legal matters: Recommend consulting a licensed attorney.

Prohibited behaviors:
- Never fabricate or hallucinate data about the user
- Never guarantee returns, employment, or medical outcomes
- Never recommend specific securities, diagnose conditions, or give legal advice
- Never skip escalation triggers`;

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
  const resp = await fetch(GEMINI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });
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
  const resp = await fetch(GEMINI_GENERATE_URL, {
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
  });
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
        const resp = await fetch(GEMINI_STREAM_URL, {
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
        });

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
  const resp = await fetch(`${url}/db/neo4j/tx/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
    },
    body: JSON.stringify({
      statements: [{ statement: cypher, parameters: params }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Neo4j ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  if (data.errors?.length) {
    throw new Error(`Neo4j: ${JSON.stringify(data.errors)}`);
  }

  // Flatten results into record array
  const result = data.results?.[0];
  if (!result) return [];

  const columns: string[] = result.columns || [];
  return (result.data || []).map(
    (row: { row: unknown[] }) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => (record[col] = row.row[i]));
      return record;
    },
  );
}

async function graphSearch(
  query: string,
  tenantId: string,
  geminiKey: string,
  neo4jUrl: string,
  neo4jUser: string,
  neo4jPass: string,
): Promise<SearchResult[]> {
  // Step 1: NL → Cypher via Gemini
  const cypherJson = await geminiGenerate(
    geminiKey,
    CYPHER_SYSTEM,
    query,
  );

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

function buildContext(results: SearchResult[]): string {
  if (results.length === 0) return 'No relevant data found in the knowledge graph.';

  const sections: string[] = ['## User Data from Knowledge Graph\n'];

  for (const r of results.slice(0, 15)) {
    sections.push(`- [${r.entity_type}] ${r.text}`);
  }

  return sections.join('\n');
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
    // --- Environment ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    // Neo4j Aura HTTPS Query API URL (port 443, not 7473)
    // Example: https://xxxxx.databases.neo4j.io
    const neo4jUrl = Deno.env.get('NEO4J_QUERY_API_URL');
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
        'Missing required env vars: GEMINI_API_KEY, NEO4J_QUERY_API_URL, NEO4J_USERNAME, NEO4J_PASSWORD, QDRANT_URL, QDRANT_API_KEY',
      );
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

    // Embed query
    const queryVector = await embedQuery(query, geminiKey);

    // Parallel: vector search + graph search
    const [vectorResults, graphResults] = await Promise.all([
      qdrantSearch(qdrantUrl, qdrantKey, qdrantCollection, queryVector, userId),
      graphSearch(query, userId, geminiKey, neo4jUrl, neo4jUser, neo4jPass),
    ]);

    // Fuse with RRF
    const fused = reciprocalRankFusion(vectorResults, graphResults);
    const context = buildContext(fused);

    // --- Fetch user risk profile for personalization ---
    const { data: riskProfile } = await supabase
      .from('risk_assessments')
      .select('overall_score, risk_level, assessment_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let riskContext = '';
    if (riskProfile) {
      riskContext = `\n\n## User Risk Profile\n- Risk Level: ${riskProfile.risk_level}\n- Overall Score: ${riskProfile.overall_score}/100\n- Assessment Type: ${riskProfile.assessment_type}`;
    }

    const fullContext = context + riskContext;

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

    // Non-streaming: single response
    const answer = await geminiGenerate(
      geminiKey,
      ANSWER_SYSTEM,
      `${fullContext}\n\n---\n\nUser question: ${query}`,
    );

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
