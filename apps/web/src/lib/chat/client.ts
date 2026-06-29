/**
 * Command Center browser client — projects, threads, messages, send. Thin fetch wrappers over the
 * /api/chat/* routes so the dashboard surface and the floating chat share ONE client (no duplication).
 */
import type { AgentInfo } from './agents';
import { AGENT_FALLBACK } from './agents';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
}

export interface Thread {
  id: string;
  project_id: string | null;
  title: string | null;
  mode: string;
  selected_agent: string | null;
  last_message_at: string;
  message_count: number;
}

export interface Citation {
  kind?: string;
  domain?: string | null;
  label?: string | null;
  value?: string | null;
  sourceTable?: string | null;
  recordId?: string | null;
  confidence?: number | null;
  updatedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent: string | null;
  citations: Citation[];
}

export interface Reasoning {
  tradeoffs?: { option?: string; benefit?: string; cost?: string }[];
  what_we_know?: string[];
  what_we_still_need?: string[];
}

export interface Handoff {
  response_type: 'handoff' | 'handoff_choice';
  from_agent?: string;
  from_name?: string;
  target_agent?: string;
  target_name?: string;
  target_domain?: string;
  reason?: string;
  options?: string[];
}

export interface SendResult {
  assistant_message: string;
  citations: Citation[];
  agent: string | null;
  thread_id?: string | null;
  llm_status?: string;
  reasoning?: Reasoning | null;
  goals?: string[];
  risks?: string[];
  handoff?: Handoff | null;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`http_${res.status}`);
  return (await res.json()) as T;
}

export const chatClient = {
  async listAgents(): Promise<AgentInfo[]> {
    try {
      const { agents } = await jsonOrThrow<{ agents: AgentInfo[] }>(
        await fetch('/api/chat/agents', { cache: 'no-store' })
      );
      return agents?.length ? agents : AGENT_FALLBACK;
    } catch {
      return AGENT_FALLBACK;
    }
  },

  async listProjects(): Promise<Project[]> {
    const { projects } = await jsonOrThrow<{ projects: Project[] }>(
      await fetch('/api/chat/projects', { cache: 'no-store' })
    );
    return projects ?? [];
  },

  async createProject(
    name: string,
    description?: string,
    domain?: string
  ): Promise<Project | null> {
    const { project } = await jsonOrThrow<{ project: Project }>(
      await fetch('/api/chat/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, domain }),
      })
    );
    return project ?? null;
  },

  async listThreads(projectId?: string | null): Promise<Thread[]> {
    const url = projectId
      ? `/api/chat/threads?project_id=${encodeURIComponent(projectId)}`
      : '/api/chat/threads';
    const { threads } = await jsonOrThrow<{ threads: Thread[] }>(
      await fetch(url, { cache: 'no-store' })
    );
    return threads ?? [];
  },

  async createThread(input: {
    title?: string;
    agent?: string | null;
    project_id?: string | null;
  }): Promise<Thread | null> {
    const { thread } = await jsonOrThrow<{ thread: Thread }>(
      await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, selected_agent: input.agent ?? null }),
      })
    );
    return thread ?? null;
  },

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    const { messages } = await jsonOrThrow<{ messages: ChatMessage[] }>(
      await fetch(`/api/chat/threads/${threadId}/messages`, { cache: 'no-store' })
    );
    return messages ?? [];
  },

  /** Send a message. Mints a thread if threadId is null (returns thread_id). Always advisor mode. */
  async send(args: {
    message: string;
    agent?: string | null;
    threadId?: string | null;
    projectId?: string | null;
  }): Promise<SendResult> {
    const res = await fetch('/api/chat/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: args.message,
        agent: args.agent ?? null,
        thread_id: args.threadId ?? null,
        project_id: args.projectId ?? null,
      }),
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return (await res.json()) as SendResult;
  },
};
