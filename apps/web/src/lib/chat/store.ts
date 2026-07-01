/**
 * Chat Command Center data store — projects, threads, messages.
 *
 * Extends the existing `chat` schema (migration 111 + 164) via the public views
 * (chat_projects / chat_conversations / chat_messages). Writes use the service-role client (the views are
 * RLS-locked to owner-read + service-write) and ALWAYS filter by an explicit user_id obtained from the
 * authenticated session in the route — so a user can only ever touch their own rows. Reads do the same.
 *
 * Naming: a "thread" is a chat.conversations row (the schema predates the command center). Best-effort and
 * defensive: if the migration isn't applied yet, reads return [] rather than 500ing the UI.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface ChatProject {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatThread {
  id: string;
  project_id: string | null;
  title: string | null;
  mode: string;
  selected_agent: string | null;
  last_message_at: string;
  message_count: number;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent: string | null;
  citations: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function svc(): any {
  const s = createServiceRoleClient();
  if (!s) throw new Error('service_unavailable');
  return s;
}

export async function listProjects(userId: string): Promise<ChatProject[]> {
  try {
    const { data, error } = await svc()
      .from('chat_projects')
      .select('id, name, description, domain, created_at, updated_at')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(200);
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export async function createProject(
  userId: string,
  input: { name: string; description?: string | null; domain?: string | null }
): Promise<ChatProject | null> {
  const row = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.slice(0, 200),
    description: input.description ?? null,
    domain: input.domain ?? null,
  };
  const { data, error } = await svc().from('chat_projects').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function listThreads(
  userId: string,
  projectId?: string | null
): Promise<ChatThread[]> {
  try {
    let q = svc()
      .from('chat_conversations')
      .select(
        'id, project_id, title, mode, selected_agent, last_message_at, message_count, created_at'
      )
      .eq('user_id', userId)
      .is('archived_at', null);
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q.order('last_message_at', { ascending: false }).limit(200);
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export async function createThread(
  userId: string,
  input: {
    title?: string | null;
    mode?: string;
    selected_agent?: string | null;
    project_id?: string | null;
  }
): Promise<ChatThread | null> {
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    user_id: userId,
    title: input.title ?? null,
    mode: input.mode ?? 'advisor',
    selected_agent: input.selected_agent ?? null,
    project_id: input.project_id ?? null,
    last_message_at: now,
    updated_at: now,
    message_count: 0,
    metadata: {},
  };
  const { data, error } = await svc().from('chat_conversations').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getMessages(userId: string, threadId: string): Promise<ChatMessageRow[]> {
  try {
    const { data, error } = await svc()
      .from('chat_messages')
      .select('id, conversation_id, role, content, agent, citations, metadata, created_at')
      .eq('user_id', userId)
      .eq('conversation_id', threadId)
      .order('created_at', { ascending: true })
      .limit(500);
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

/** Append a (user, assistant) turn to a thread and bump its recency. Best-effort; never throws. */
async function bumpThread(sb: any, userId: string, threadId: string): Promise<void> {
  await sb
    .from('chat_conversations')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('user_id', userId);
}

/** Persist the USER message immediately — call this BEFORE the advisor request so the thread is never left
 *  empty (and is therefore reopenable/continuable) even if the advisor call times out or errors. */
export async function appendUserMessage(
  userId: string,
  threadId: string,
  content: string
): Promise<void> {
  try {
    const sb = svc();
    await sb.from('chat_messages').insert([
      {
        conversation_id: threadId,
        user_id: userId,
        role: 'user',
        content: (content || '').slice(0, 16_000),
        metadata: {},
      },
    ]);
    await bumpThread(sb, userId, threadId);
  } catch (e) {
    console.error('[chat store] appendUserMessage failed:', e);
  }
}

/** Persist the ASSISTANT message — no-op on empty text (a failed/empty advisor turn leaves no blank bubble). */
export async function appendAssistantMessage(
  userId: string,
  threadId: string,
  turn: {
    content: string;
    agent?: string | null;
    citations?: unknown[];
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!turn.content || !turn.content.trim()) return;
  try {
    const sb = svc();
    await sb.from('chat_messages').insert([
      {
        conversation_id: threadId,
        user_id: userId,
        role: 'assistant',
        content: turn.content.slice(0, 32_000),
        agent: turn.agent ?? null,
        citations: turn.citations ?? [],
        metadata: turn.metadata ?? {},
      },
    ]);
    await bumpThread(sb, userId, threadId);
  } catch (e) {
    console.error('[chat store] appendAssistantMessage failed:', e);
  }
}

/** Persist a full turn (user + assistant). Thin wrapper — prefer the granular helpers when the user message
 *  must be saved before the (fallible) advisor call. */
export async function appendTurn(
  userId: string,
  threadId: string,
  turn: {
    userMessage: string;
    assistantMessage: string;
    agent?: string | null;
    citations?: unknown[];
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await appendUserMessage(userId, threadId, turn.userMessage);
  await appendAssistantMessage(userId, threadId, {
    content: turn.assistantMessage,
    agent: turn.agent,
    citations: turn.citations,
    metadata: turn.metadata,
  });
}

/** Recent history for THIS thread, oldest-first, for cross-turn context sent to the advisor. Bounded. */
export async function recentHistory(
  userId: string,
  threadId: string,
  limit = 8
): Promise<Array<{ role: string; content: string }>> {
  const msgs = await getMessages(userId, threadId);
  return msgs.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}
