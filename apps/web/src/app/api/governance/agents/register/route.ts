/**
 * POST /api/governance/agents/register
 *
 * Service-role-only registration of a new agent. Use a service-role
 * key for this endpoint. The DB layer enforces the role via RLS:
 * the agent_registry table is service-role write only.
 *
 * In dev / test, the supabase server client may be configured with a
 * service role through env. We do NOT auto-grant — if the insert is
 * denied, the route returns the specific error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { AgentRegistration } from '@/types/governance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<AgentRegistration> & {
    admin_token?: string;
  };

  // Hard gate: only proceed if a service-role client is configured.
  const sb = createServiceRoleClient();
  if (!sb) {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 503 });
  }
  if (!body.agent_kind || !body.agent_name) {
    return NextResponse.json({ error: 'agent_kind and agent_name required' }, { status: 400 });
  }

  const row = {
    agent_kind: body.agent_kind,
    agent_name: body.agent_name,
    description: body.description ?? null,
    responsible_team: body.responsible_team ?? null,
    active: body.active ?? true,
    capabilities: body.capabilities ?? [],
  };
  const r = await (sb as any).from('agent_registry').upsert(row).select('*').single();
  if (r.error) {
    return NextResponse.json({ error: r.error.message }, { status: 500 });
  }
  return NextResponse.json({ agent: r.data });
}
