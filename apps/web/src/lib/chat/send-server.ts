import 'server-only';
import { CORE_API, token } from '@/app/api/life/_helper';
import { appendTurn } from './store';

export interface SendResult {
  status: number;
  assistant_message: string;
  citations: unknown[];
  agent: string | null;
  llm_status?: string;
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

  const r = await fetch(`${CORE_API}/v1/life/advisor/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: args.message,
      conversation_id: args.threadId ?? '',
      agent: args.agent ?? '',
    }),
    cache: 'no-store',
  });

  const turn = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const assistant = typeof turn.assistant_message === 'string' ? turn.assistant_message : '';
  const citations = Array.isArray(turn.citations) ? (turn.citations as unknown[]) : [];
  const answeredAgent = (typeof turn.agent === 'string' ? turn.agent : args.agent) ?? null;
  const llm_status = typeof turn.llm_status === 'string' ? turn.llm_status : undefined;
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

  if (args.threadId && assistant) {
    await appendTurn(args.userId, args.threadId, {
      userMessage: args.message,
      assistantMessage: assistant,
      agent: answeredAgent,
      citations,
      metadata: { llm_status },
    });
  }

  return {
    status: r.status,
    assistant_message: assistant,
    citations,
    agent: answeredAgent,
    llm_status,
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
