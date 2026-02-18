import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32 * 1024;

type IngestWebhookPayload = {
  job_id: string;
  user_id: string;
  document_id: string;
  domain: 'financial' | 'health' | 'career' | 'education' | 'other';
  task: 'extract_and_route';
  input: {
    bucket_id: string;
    storage_path: string;
    detected_file_type: string;
    checksum_sha256?: string | null;
  };
  attempt: number;
};

function safeCompare(secretA: string, secretB: string): boolean {
  const a = Buffer.from(secretA);
  const b = Buffer.from(secretB);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  const sharedSecret = process.env.INTERNAL_AGENT_WEBHOOK_SECRET;
  if (!sharedSecret) {
    return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('x-worker-secret');
  if (!providedSecret || !safeCompare(providedSecret, sharedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerId = request.headers.get('x-worker-id');
  const requestId = request.headers.get('x-request-id');
  if (!workerId || !requestId) {
    return NextResponse.json({ error: 'Missing x-worker-id or x-request-id' }, { status: 400 });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(requestId)) {
    return NextResponse.json({ error: 'x-request-id must be a UUID' }, { status: 400 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload exceeds 32KB limit' }, { status: 413 });
  }

  let payload: IngestWebhookPayload;
  try {
    payload = JSON.parse(raw) as IngestWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload?.job_id || !payload?.document_id || !payload?.user_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const { data: accepted, error: replayError } = await supabase.rpc('register_internal_request', {
    p_request_id: requestId,
    p_source: workerId,
    p_payload_hash: bodyHash,
    p_ttl_seconds: 86400,
  });
  if (replayError) {
    return NextResponse.json({ error: `Replay guard failed: ${replayError.message}` }, { status: 500 });
  }
  if (!accepted) {
    const { data: existing } = await supabase
      .schema('core')
      .from('ingestion_results')
      .select('id')
      .eq('job_id', payload.job_id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      replay: true,
      job_id: payload.job_id,
      result_ref: existing?.id || null,
    });
  }

  const { data: existingResult, error: existingError } = await supabase
    .schema('core')
    .from('ingestion_results')
    .select('id')
    .eq('job_id', payload.job_id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  // Forwarding is optional for MVP; default is no external dependency.
  if ((process.env.ENABLE_AGENT_FORWARDING || 'false').toLowerCase() === 'true') {
    const agentApiUrl = process.env.AGENT_API_URL;
    if (agentApiUrl) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.AGENT_INTERNAL_API_KEY) {
        headers['X-API-Key'] = process.env.AGENT_INTERNAL_API_KEY;
      }

      const forwardRes = await fetch(`${agentApiUrl}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `Ingest and summarize ${payload.domain} document for routing`,
          user_id: payload.user_id,
          agent_id: 'ingestion-orchestrator',
          context: payload,
        }),
      });

      if (!forwardRes.ok) {
        const txt = await forwardRes.text().catch(() => '');
        return NextResponse.json({ error: `Agent forward failed: ${txt}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    replay: false,
    job_id: payload.job_id,
    result_ref: existingResult?.id || null,
  });
}
