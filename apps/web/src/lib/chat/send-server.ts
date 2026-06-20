import 'server-only';
import { CORE_API, token } from '@/app/api/life/_helper';
import { appendTurn } from './store';

export interface SendResult {
  status: number;
  assistant_message: string;
  citations: unknown[];
  agent: string | null;
  llm_status?: string;
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
  };
}
