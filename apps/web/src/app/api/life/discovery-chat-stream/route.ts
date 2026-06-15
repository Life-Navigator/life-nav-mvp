import { NextRequest } from 'next/server';
import { CORE_API, token } from '../_helper';
export const dynamic = 'force-dynamic';

// Passes the advisor SSE stream straight through from the Core API so the chat UI can render the fast
// deterministic `ack` event (~1s) before the fully validated `final` event arrives.
export async function POST(req: NextRequest) {
  const t = await token();
  if (!t) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const body = await req.text();
  const r = await fetch(`${CORE_API}/v1/life/discovery/chat/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });
  return new Response(r.body, {
    status: r.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
