import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  createSandboxPublicToken,
  exchangePublicToken,
  getAccounts,
  getTransactions,
} from '@/lib/integrations/plaid/client';
import {
  getPersona,
  isValidPersonaId,
  getPlaidActivation,
  personaMetadata,
} from '@/lib/integrations/plaid/personas';
import {
  persistPlaidItem,
  persistAccounts,
  persistTransactions,
  persistPersonaProfile,
} from '@/lib/integrations/plaid/persist';
import { recordUserEvent } from '@/lib/analytics/events';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/integrations/plaid/activate-persona  { persona_id }
 *
 * Beta "sample financial profile" activation. Looks up the persona's sandbox
 * credentials SERVER-SIDE, runs the Plaid sandbox token flow, persists the
 * synthetic data into the finance schema (which fires graph-promotion via the
 * financial_accounts sync trigger), writes an audit event, and best-effort
 * kicks off a first recommendation. Credentials never reach the client.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { persona_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidPersonaId(body?.persona_id)) {
    return NextResponse.json({ error: 'Unknown sample financial profile' }, { status: 400 });
  }
  const persona = getPersona(body.persona_id)!;

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Sample financial profiles are not available yet.' },
      { status: 503 }
    );
  }

  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  try {
    // 1) Sandbox token flow (no Link UI; credentials stay server-side). Uses a
    //    distinct user_custom dataset when the persona defines one, else a
    //    documented sandbox user (graceful fallback).
    const activation = getPlaidActivation(persona);
    const { publicToken } = await createSandboxPublicToken({
      institutionId: persona.institution_id,
      products: persona.plaid_products,
      username: activation.username,
      password: activation.password,
      customConfig: activation.customConfig,
    });
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // 2) Persist the item + accounts (accounts trigger graph promotion).
    await persistPlaidItem(svc, {
      userId: user.id,
      itemId,
      accessToken,
      institutionId: persona.institution_id,
      institutionName: persona.display_name,
    });

    const accounts = await getAccounts(accessToken);
    const accountIdMap = await persistAccounts(svc, user.id, accounts);

    // 3) Transactions (last 30 days).
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let txnCount = 0;
    try {
      const { transactions } = await getTransactions(accessToken, fmt(start), fmt(end));
      txnCount = await persistTransactions(svc, user.id, accountIdMap, transactions);
    } catch (txErr) {
      // Transactions can lag in sandbox right after item creation; non-fatal.
      console.warn('persona transactions sync deferred:', (txErr as Error)?.message);
    }

    // 3b) Persist persona metadata (career/income/risk/goals) for the dashboard
    //     + recommendation engine; the table trigger promotes it to the graph.
    await persistPersonaProfile(svc, user.id, personaMetadata(persona));

    // 3c) Beta fast-path: activating a sample profile counts as setup, so the
    //     dashboard is reachable without the long questionnaire.
    await (svc as any)
      .from('profiles')
      .update({
        setup_completed: true,
        setup_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // 4) Audit event (service role: server-side audit, bypasses RLS).
    await recordUserEvent(svc, {
      user_id: user.id,
      event_type: 'sample_financial_profile_activated',
      event_metadata: {
        persona_id: persona.persona_id,
        config_source: persona.plaid_config_source,
        accounts_linked: accounts.length,
        transactions_synced: txnCount,
      },
      subject_kind: 'plaid_persona',
      // subject_id is a uuid column; persona_id is a string, so keep it in
      // event_metadata above and leave subject_id null.
      subject_id: null,
    });

    // 5) Best-effort: kick off a first recommendation via the gateway. Never
    //    fail activation if this is unavailable; economic.usage_events is
    //    written by the governed recommendation path when a model is called.
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (apiUrl && session?.access_token) {
        await fetch(`${apiUrl}/api/recommendations/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ trigger: 'financial_profile_activation' }),
          signal: AbortSignal.timeout(20_000),
        }).catch(() => {});
      }
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      persona_id: persona.persona_id,
      accounts_linked: accounts.length,
      transactions_synced: txnCount,
      graph_promotion: 'enqueued',
    });
  } catch (err) {
    console.error('Persona activation error:', (err as Error)?.message);
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
