/**
 * POST /api/governance/validate
 *
 * Validates a recommendation subject and (optionally) persists the
 * audit row. The intended caller is an internal service path, not a
 * raw client — but the route is auth-gated so a misbehaving client
 * cannot bypass governance by skipping the call.
 *
 * Body: ValidateInputs without supabase. user_id is forced to
 * auth.user.id; emitters cannot fake the user side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  primeAgentRegistry,
  shouldRefreshAgentRegistry,
  validateAndPersist,
} from '@/lib/governance/middleware';
import type { AgentRegistration, GovernanceSubject, SubjectEmitter } from '@/types/governance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    subject: GovernanceSubject;
    emitter?: SubjectEmitter;
    persist?: boolean;
  };
  if (!body?.subject?.kind || typeof body.subject.text !== 'string') {
    return NextResponse.json({ error: 'bad subject' }, { status: 400 });
  }

  // Force user_id from the auth context — the subject cannot lie.
  body.subject.user_id = user.id;

  const sb = supabase as any;

  // Warm the agent registry cache if stale.
  if (shouldRefreshAgentRegistry()) {
    const r = await sb
      .from('governance_agent_registry')
      .select('agent_kind, agent_name, active, capabilities');
    primeAgentRegistry((r.data ?? []) as AgentRegistration[]);
  }

  try {
    const persist = body.persist !== false;
    if (persist) {
      const { decision } = await validateAndPersist({
        subject: body.subject,
        emitter: body.emitter,
        supabase: sb,
        now: new Date().toISOString(),
      });
      return NextResponse.json({ decision });
    }
    // Pure check (no audit row).
    const { validate } = await import('@/lib/governance/middleware');
    const decision = validate({
      subject: body.subject,
      emitter: body.emitter,
      now: new Date().toISOString(),
    });
    return NextResponse.json({ decision });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'governance_failure', message }, { status: 500 });
  }
}
