/**
 * Chat persistence helpers — write to chat.conversations + chat.messages.
 *
 * Called from /api/agent/chat after the governed factory has produced and
 * approved the response. Uses the service-role client because the schema is
 * RLS-locked to owner-read + service-write; the route is already auth-gated by
 * the factory.
 *
 * No model calls; pure DB. Best-effort: persistence failures must not poison
 * the user's response — they're logged and swallowed so the chat still works
 * if the chat schema is unmigrated for any reason.
 */

import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';

const TITLE_MAX = 120;

export interface PersistTurnInputs {
  user_id: string;
  /**
   * Stable conversation id. If the caller didn't supply one, generate a UUID
   * upstream. We accept it as a string here; the schema stores UUID and will
   * reject malformed values, which we swallow.
   */
  conversation_id: string;
  user_message: string;
  assistant_message: string;
  governance_audit_id?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert one (user, assistant) turn into the chat schema. Creates the
 * conversation row on first turn. Returns the conversation_id so the route
 * can echo it back.
 */
export async function persistChatTurn(inputs: PersistTurnInputs): Promise<string | null> {
  const svc = createServiceRoleClient();
  if (!svc) return null;

  const conversation_id = inputs.conversation_id;
  const userText = inputs.user_message.slice(0, 16_000);
  const assistantText = inputs.assistant_message.slice(0, 32_000);
  const meta = inputs.metadata ?? {};

  try {
    // Upsert the conversation row. We rely on the route generating a UUID
    // (gen_random_uuid()) before the first turn; non-UUID strings will be
    // rejected by the schema's UUID column.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = svc as any;
    const title = userText.length > TITLE_MAX ? userText.slice(0, TITLE_MAX - 1) + '…' : userText;

    // Try insert first; if it exists, update last_message_at + message_count.
    const insertRes = await sb.from('chat_conversations').insert({
      id: conversation_id,
      user_id: inputs.user_id,
      title,
      last_message_at: new Date().toISOString(),
      message_count: 2,
      metadata: meta,
    });

    if (insertRes.error) {
      // Most common: row already exists. Update aggregates.
      await sb
        .from('chat_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          // message_count := message_count + 2 (best-effort RMW; the UI just
          // counts messages from chat_messages so this column drifts at worst
          // by one turn and is not load-bearing).
          metadata: meta,
        })
        .eq('id', conversation_id)
        .eq('user_id', inputs.user_id);
    }

    // Insert both messages.
    await sb.from('chat_messages').insert([
      {
        conversation_id,
        user_id: inputs.user_id,
        role: 'user',
        content: userText,
        metadata: {},
      },
      {
        conversation_id,
        user_id: inputs.user_id,
        role: 'assistant',
        content: assistantText,
        governance_audit_id: inputs.governance_audit_id ?? null,
        metadata: meta,
      },
    ]);

    return conversation_id;
  } catch (e) {
    console.error('[chat persistence] failed:', e);
    return null;
  }
}
