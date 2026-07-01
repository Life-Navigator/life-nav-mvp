import 'server-only';
import { CORE_API, token } from '@/app/api/life/_helper';
import { appendUserMessage, appendAssistantMessage } from './store';

export interface SendResult {
  status: number;
  assistant_message: string;
  citations: unknown[];
  agent: string | null;
  degraded?: boolean; // advisor produced no text; user message still persisted + thread continuable
  llm_status?: string;
  handoff?: unknown; // cross-agent in-chat handoff metadata (from → target advisor)
  reasoning?: unknown; // {tradeoffs, what_we_know, what_we_still_need} — for the evidence drawer
  goals?: string[]; // relevant goal chips (candidate_goals)
  risks?: string[]; // detected risk chips (context_panel.top_risks)
  // RELEASE_HARDENING observability passthrough (item 1/2) — lets the live regression + dashboards confirm
  // the LLM actually ran on the deployed non-root path and attribute any fallback to a cause.
  model?: string;
  provider?: string;
  provider_called?: boolean;
  fallback_cause?: string;
  route_path?: string;
  latency_ms?: number;
}

/**
 * One advisor turn for the Command Center. Routes to core-api /v1/life/advisor/chat in advisor mode
 * (NEVER discovery), passing the selected agent and the thread id (so the backend threads cross-turn
 * context, bounded — we do not resend the whole user universe). Persists the (user, assistant) turn with
 * agent + citations when a thread is supplied. Both Relationship Manager and direct-agent selections come
 * through here; the `agent` field decides which persona/grounding the backend uses.
 */
export async function sendAdvisorTurn(args: {
  userId: string;
  threadId: string | null;
  message: string;
  agent?: string | null;
}): Promise<SendResult> {
  const t = await token();
  if (!t) throw new Error('unauthorized');

  // CONTINUITY: persist the user message FIRST — before the (fallible) advisor call — so the thread is never
  // left empty and can always be reopened/continued, even if the advisor times out or errors.
  if (args.threadId) {
    await appendUserMessage(args.userId, args.threadId, args.message);
  }

  // The advisor call may throw (network/timeout) or return a non-200; either way we still return a normal
  // result carrying the thread_id (so the client never forks a duplicate thread) with an empty assistant.
  // A hard client-side deadline (below the Vercel function limit) turns a slow/hung turn into a clean degrade
  // instead of a platform 504 — the user always gets a bounded response. ONE bounded retry for a FAST transient
  // failure only (immediate network error / 5xx), never for a timeout (retrying a slow turn just hangs again).
  const DEADLINE_MS = Number(process.env.ADVISOR_CLIENT_TIMEOUT_MS || 55_000);
  const attempt = async (
    budgetMs: number
  ): Promise<{ status: number; turn: Record<string, unknown>; threw: boolean }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), budgetMs);
    try {
      const r = await fetch(`${CORE_API}/v1/life/advisor/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: args.message,
          conversation_id: args.threadId ?? '',
          agent: args.agent ?? '',
        }),
        cache: 'no-store',
        signal: ctrl.signal,
      });
      const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: r.status, turn: body, threw: false };
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      console.error(
        `[advisor] core-api request ${aborted ? 'timed out' : 'failed'}:`,
        aborted ? `${budgetMs}ms` : e
      );
      return { status: aborted ? 504 : 502, turn: {}, threw: true };
    } finally {
      clearTimeout(timer);
    }
  };

  const started = Date.now();
  let { status, turn, threw } = await attempt(DEADLINE_MS);
  let retry_count = 0;
  const elapsed = Date.now() - started;
  const gotText = typeof turn.assistant_message === 'string' && turn.assistant_message.length > 0;
  // Retry only a FAST transient failure (returned quickly), not a timeout — and only if there's budget left.
  if (!gotText && (threw || status >= 500) && status !== 504 && elapsed < 10_000) {
    const remaining = DEADLINE_MS - elapsed - 1_000;
    if (remaining > 5_000) {
      retry_count = 1;
      console.warn('[advisor] transient failure — one bounded retry', {
        status,
        elapsed_ms: elapsed,
      });
      ({ status, turn, threw } = await attempt(remaining));
    }
  }
  const assistant = typeof turn.assistant_message === 'string' ? turn.assistant_message : '';
  const citations = Array.isArray(turn.citations) ? (turn.citations as unknown[]) : [];
  const answeredAgent = (typeof turn.agent === 'string' ? turn.agent : args.agent) ?? null;
  const llm_status = typeof turn.llm_status === 'string' ? turn.llm_status : undefined;
  // Cross-agent in-chat handoff metadata (from → target advisor) so the UI can show the routing chip.
  const handoff =
    turn.handoff && typeof turn.handoff === 'object'
      ? (turn.handoff as Record<string, unknown>)
      : undefined;
  // Surfacing payloads for the premium chat UI (drawer + chips) — never injected into the message text.
  const reasoning =
    turn.reasoning && typeof turn.reasoning === 'object' ? turn.reasoning : undefined;
  const goals = Array.isArray(turn.candidate_goals)
    ? (turn.candidate_goals as Array<Record<string, unknown>>)
        .map((g) => (typeof g?.goal === 'string' ? g.goal : ''))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const panel =
    turn.context_panel && typeof turn.context_panel === 'object'
      ? (turn.context_panel as Record<string, unknown>)
      : {};
  const risks = Array.isArray(panel.top_risks)
    ? (panel.top_risks as unknown[])
        .map((r) => String(r))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  // The user message was already persisted above; now persist the assistant reply (no-op if it's empty, so a
  // failed advisor turn leaves the user's message in the thread with no blank assistant bubble).
  if (args.threadId) {
    await appendAssistantMessage(args.userId, args.threadId, {
      content: assistant,
      agent: answeredAgent,
      citations,
      metadata: { llm_status },
    });
  }

  // Reliability observability (no PII): one structured line per turn so degraded/timeout turns are diagnosable.
  const outcome = assistant ? 'success' : status === 504 ? 'timeout' : 'degraded';
  console.log(
    'advisor_turn_reliability ' +
      JSON.stringify({
        thread_id: args.threadId,
        agent: answeredAgent,
        status,
        outcome,
        retry_count,
        aborted: threw && status === 504,
        duration_ms: Date.now() - started,
        assistant_len: assistant.length,
      })
  );

  return {
    status,
    // The advisor produced no text (timeout/error/empty) — the UI shows a retry affordance instead of a blank
    // bubble, but the user's message is already saved and the thread is continuable.
    degraded: !assistant,
    assistant_message: assistant,
    citations,
    agent: answeredAgent,
    llm_status,
    handoff,
    reasoning,
    goals,
    risks,
    model: typeof turn.model === 'string' ? turn.model : undefined,
    provider: typeof turn.provider === 'string' ? turn.provider : undefined,
    provider_called: typeof turn.provider_called === 'boolean' ? turn.provider_called : undefined,
    fallback_cause: typeof turn.fallback_cause === 'string' ? turn.fallback_cause : undefined,
    route_path: typeof turn.route_path === 'string' ? turn.route_path : undefined,
    latency_ms: typeof turn.latency_ms === 'number' ? turn.latency_ms : undefined,
  };
}
