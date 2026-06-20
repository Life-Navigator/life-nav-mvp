import { NextResponse } from 'next/server';
import { CORE_API, token } from '@/app/api/life/_helper';
import { AGENT_FALLBACK } from '@/lib/chat/agents';

export const dynamic = 'force-dynamic';

// GET /api/chat/agents — the Command Center roster from core-api. Falls back to the static catalog when
// the backend is unreachable so the agent selector is never empty (the UI must always work).
export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const r = await fetch(`${CORE_API}/v1/life/advisor/agents`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ agents: AGENT_FALLBACK });
    const data = await r.json().catch(() => ({}));
    const agents = Array.isArray(data?.agents) && data.agents.length ? data.agents : AGENT_FALLBACK;
    return NextResponse.json({ agents });
  } catch {
    return NextResponse.json({ agents: AGENT_FALLBACK });
  }
}
