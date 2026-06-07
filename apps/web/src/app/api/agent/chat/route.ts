/**
 * POST /api/agent/chat — Sprint T migration.
 *
 * Migrated from hand-rolled guardOutgoing() (with a streaming bypass)
 * to createGovernedHandler. Streaming and non-streaming both flow
 * through the same gate: model output is BUFFERED server-side, run
 * through governance + character + injection, then released as SSE.
 *
 * The `?stream=true` URL parameter no longer bypasses the safety stack.
 */

import { createGovernedHandler } from '@/lib/governance/governed-route';
import { persistChatTurn } from '@/lib/chat/persistence';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const GRAPHRAG_WORKER_SECRET = process.env.GRAPHRAG_WORKER_SECRET;
// The graphrag-query Edge function runs behind the Supabase gateway with
// verify_jwt enabled, so every call needs a valid apikey/Authorization header
// or the gateway returns 401 (UNAUTHORIZED_NO_AUTH_HEADER) before the function
// runs — which previously made EVERY chat silently fall back. The anon key is
// the correct gateway credential; the function's real auth is x-worker-secret.
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ChatBody {
  message: string;
  conversation_id?: string;
  previous_messages?: Array<{ role: string; content: string }>;
}

/**
 * Accept the incoming conversation_id (a UUID) or mint a new one. The legacy
 * `conv_${timestamp}` format from the graphrag-query Edge Function is
 * rewritten to a fresh UUID so the chat.* tables can store it.
 */
function normalizeConversationId(incoming?: string): string {
  if (
    incoming &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)
  ) {
    return incoming;
  }
  return randomUUID();
}

export const POST = createGovernedHandler<ChatBody>({
  emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
  subjectKind: 'advisor_message',
  feature_key: 'chat',
  model_provider: 'gemini',
  // The graphrag-query edge function generates with gemini-2.5-flash
  // (supabase/functions/graphrag-query/index.ts:50). Declaring it here keeps
  // the pre-call cost estimate accurate (~352 micros/turn) instead of falling
  // back to the unmodeled ~$0.39 ceiling that exhausted the $1/day budget.
  model: 'gemini-2.5-flash',
  async produce({ request, body, user, accumulator }) {
    if (!body?.message) {
      throw new Error('message is required');
    }

    const url = new URL(request.url);
    const shouldStream = url.searchParams.get('stream') === 'true';
    // Stable UUID for this conversation across turns. Persisted to the
    // chat.* tables below so the chat page can list + resume.
    const conversation_id = normalizeConversationId(body.conversation_id);

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/graphrag-query`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    };
    if (GRAPHRAG_WORKER_SECRET) headers['x-worker-secret'] = GRAPHRAG_WORKER_SECRET;

    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: body.message,
        user_id: user.id,
        // Server-internal streaming for the SSE → factory accumulator
        // path; the factory decides what to release.
        stream: shouldStream,
        conversation_id,
        previous_messages: body.previous_messages,
      }),
    });

    if (!edgeResponse.ok) {
      throw new Error(`upstream ${edgeResponse.status}`);
    }

    // Non-streaming: read full JSON, feed text to governance.
    if (!shouldStream || !edgeResponse.body) {
      const json = await edgeResponse.json();
      const assistantText = typeof json.message === 'string' ? json.message : JSON.stringify(json);
      // Persist BOTH turns to chat.* so the user can resume / browse later.
      // Best-effort: never blocks the response.
      void persistChatTurn({
        user_id: user.id,
        conversation_id,
        user_message: body.message,
        assistant_message: assistantText,
        metadata: { sources: json.sources, edge_metadata: json.metadata },
      });
      return {
        text: assistantText,
        data: {
          conversation_id,
          timestamp: new Date().toISOString(),
          sources: json.sources,
          metadata: json.metadata,
        },
      };
    }

    // Streaming: drain SSE into the accumulator, then signal `streaming`
    // so the factory releases the post-governance text as a single SSE
    // payload. No client byte is emitted until governance passes.
    const reader = edgeResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      // Parse SSE `data: {json}` lines and extract token deltas.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (typeof evt.token === 'string') accumulator.append(evt.token);
          else if (typeof evt.delta === 'string') accumulator.append(evt.delta);
          else if (typeof evt.message === 'string') accumulator.append(evt.message);
        } catch {
          /* skip non-JSON SSE comment lines */
        }
      }
    }

    const finalText = accumulator.text();
    // Persist both turns from the streaming path too. Same best-effort.
    void persistChatTurn({
      user_id: user.id,
      conversation_id,
      user_message: body.message,
      assistant_message: finalText,
      metadata: { streamed: true },
    });
    return {
      text: finalText,
      data: { conversation_id },
      streaming: true,
    };
  },
});
