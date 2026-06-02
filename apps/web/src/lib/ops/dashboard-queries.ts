/**
 * Operator dashboard aggregations — Sprint O.0 Phase 8.
 *
 * Pure-function builders that produce the SQL each metric needs. The
 * dashboard route calls these and runs the query through the supabase
 * service-role client. RLS is not relied on for aggregation — the
 * route gates by operator-role check.
 *
 * Each metric returns a single shape so the dashboard render is
 * deterministic. The window argument (in days) is the same for every
 * metric; the route picks a default of 7.
 */

export interface MetricCounts {
  generated: number;
  viewed: number;
  accepted: number;
  ignored: number;
  dismissed: number;
  completed: number;
}

export interface DashboardSnapshot {
  window_days: number;
  generated_at: string;
  user_activity: {
    dau: number;
    wau: number;
    new_users_7d: number;
  };
  recommendations: MetricCounts;
  governance: {
    constitutional_reviews: number;
    redirected: number;
    crisis_events: number;
    injection_critical: number;
    injection_high: number;
  };
  multimodal: {
    uploads: number;
    extractions_succeeded: number;
    extractions_failed: number;
    malware_detections: number;
  };
  cost: {
    gemini_usd: number;
    openai_usd: number;
    anthropic_usd: number;
    other_usd: number;
    per_dau_usd: number;
  };
  /**
   * Per-source max-timestamp so operators can tell "no users" from
   * "wiring broken". Each value is the most recent row timestamp
   * we observed for that source in the window. `null` means the
   * source returned no rows at all in this window.
   */
  data_freshness: {
    telemetry: string | null; // analytics.user_events
    governance: string | null; // governance.decision_governance_audit
    recommendations: string | null; // public.decision_outcomes
    outcomes: string | null; // public.decision_outcome_events
    multimodal: string | null; // ingestion.files
    costs: string | null; // ops.llm_usage_meter
    injection: string | null; // security.prompt_injection_events
  };
}

// ---------------------------------------------------------------------------
// Aggregate runner
//
// Each block of queries is wrapped in its own try/catch so a partial
// failure (eg. a table doesn't exist yet in a fresh tenant DB) does
// not zero the whole snapshot.
// ---------------------------------------------------------------------------

export async function computeDashboardSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  window_days = 7
): Promise<DashboardSnapshot> {
  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();
  const since_dau = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since_wau = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const snapshot: DashboardSnapshot = {
    window_days,
    generated_at: new Date().toISOString(),
    user_activity: { dau: 0, wau: 0, new_users_7d: 0 },
    recommendations: {
      generated: 0,
      viewed: 0,
      accepted: 0,
      ignored: 0,
      dismissed: 0,
      completed: 0,
    },
    governance: {
      constitutional_reviews: 0,
      redirected: 0,
      crisis_events: 0,
      injection_critical: 0,
      injection_high: 0,
    },
    multimodal: {
      uploads: 0,
      extractions_succeeded: 0,
      extractions_failed: 0,
      malware_detections: 0,
    },
    cost: { gemini_usd: 0, openai_usd: 0, anthropic_usd: 0, other_usd: 0, per_dau_usd: 0 },
    data_freshness: {
      telemetry: null,
      governance: null,
      recommendations: null,
      outcomes: null,
      multimodal: null,
      costs: null,
      injection: null,
    },
  };

  // ---- data_freshness — one MAX(timestamp) per source --------------------
  snapshot.data_freshness.telemetry = await maxTimestamp(
    supabase,
    'analytics_user_events',
    'occurred_at',
    since
  );
  snapshot.data_freshness.governance = await maxTimestamp(
    supabase,
    'decision_governance_audit',
    'created_at',
    since
  );
  snapshot.data_freshness.recommendations = await maxTimestamp(
    supabase,
    'decision_outcomes_v',
    'generated_at',
    since
  );
  snapshot.data_freshness.outcomes = await maxTimestamp(
    supabase,
    'decision_outcome_events',
    'occurred_at',
    since
  );
  snapshot.data_freshness.multimodal = await maxTimestamp(
    supabase,
    'ingestion_files',
    'created_at',
    since
  );
  snapshot.data_freshness.costs = await maxTimestamp(
    supabase,
    'ops_llm_usage_meter',
    'created_at',
    since
  );
  snapshot.data_freshness.injection = await maxTimestamp(
    supabase,
    'security_prompt_injection_events',
    'created_at',
    since
  );

  // ---- user activity -----------------------------------------------------
  try {
    const dau = await uniqueUsers(supabase, since_dau);
    const wau = await uniqueUsers(supabase, since_wau);
    snapshot.user_activity.dau = dau;
    snapshot.user_activity.wau = wau;
  } catch {
    /* keep zeros */
  }

  // ---- recommendation lifecycle ------------------------------------------
  try {
    const states: Array<keyof MetricCounts> = [
      'generated',
      'viewed',
      'accepted',
      'ignored',
      'dismissed',
      'completed',
    ];
    for (const s of states) {
      const r = await supabase
        .from('decision_outcomes_v')
        .select('id', { count: 'exact', head: true })
        .eq('state', s)
        .gte('updated_at', since);
      snapshot.recommendations[s] = (r.count as number | undefined) ?? 0;
    }
  } catch {
    /* keep zeros */
  }

  // ---- governance --------------------------------------------------------
  try {
    const constReviews = await supabase
      .from('decision_governance_audit')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    snapshot.governance.constitutional_reviews = (constReviews.count as number | undefined) ?? 0;

    const redirected = await supabase
      .from('decision_governance_audit')
      .select('id', { count: 'exact', head: true })
      .eq('constitutional_verdict', 'CONSTITUTIONAL_REDIRECTION')
      .gte('created_at', since);
    snapshot.governance.redirected = (redirected.count as number | undefined) ?? 0;

    const crisis = await supabase
      .from('decision_governance_audit')
      .select('id', { count: 'exact', head: true })
      .in('risk_level', ['HIGH', 'CRITICAL'])
      .gte('created_at', since);
    snapshot.governance.crisis_events = (crisis.count as number | undefined) ?? 0;

    const injCrit = await supabase
      .from('security_prompt_injection_events')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'CRITICAL')
      .gte('created_at', since);
    snapshot.governance.injection_critical = (injCrit.count as number | undefined) ?? 0;

    const injHigh = await supabase
      .from('security_prompt_injection_events')
      .select('id', { count: 'exact', head: true })
      .eq('severity', 'HIGH')
      .gte('created_at', since);
    snapshot.governance.injection_high = (injHigh.count as number | undefined) ?? 0;
  } catch {
    /* keep zeros */
  }

  // ---- multimodal --------------------------------------------------------
  try {
    const uploads = await supabase
      .from('ingestion_files')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    snapshot.multimodal.uploads = (uploads.count as number | undefined) ?? 0;

    const ok = await supabase
      .from('ingestion_extraction_telemetry')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'succeeded')
      .gte('created_at', since);
    snapshot.multimodal.extractions_succeeded = (ok.count as number | undefined) ?? 0;

    const bad = await supabase
      .from('ingestion_extraction_telemetry')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'timed_out'])
      .gte('created_at', since);
    snapshot.multimodal.extractions_failed = (bad.count as number | undefined) ?? 0;

    const mw = await supabase
      .from('ingestion_malware_scans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'infected')
      .gte('created_at', since);
    snapshot.multimodal.malware_detections = (mw.count as number | undefined) ?? 0;
  } catch {
    /* keep zeros */
  }

  // ---- cost --------------------------------------------------------------
  try {
    const all = await supabase
      .from('ops_llm_usage_meter')
      .select('provider, cost_usd_micros')
      .gte('created_at', since);
    if (Array.isArray(all.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Array<{ provider: string; cost_usd_micros: number }> = all.data as any;
      for (const r of rows) {
        const usd = (r.cost_usd_micros ?? 0) / 1_000_000;
        if (r.provider === 'gemini') snapshot.cost.gemini_usd += usd;
        else if (r.provider === 'openai') snapshot.cost.openai_usd += usd;
        else if (r.provider === 'anthropic') snapshot.cost.anthropic_usd += usd;
        else snapshot.cost.other_usd += usd;
      }
    }
    const total =
      snapshot.cost.gemini_usd +
      snapshot.cost.openai_usd +
      snapshot.cost.anthropic_usd +
      snapshot.cost.other_usd;
    snapshot.cost.per_dau_usd =
      snapshot.user_activity.dau > 0 ? total / snapshot.user_activity.dau : 0;
  } catch {
    /* keep zeros */
  }

  return snapshot;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uniqueUsers(supabase: any, since_iso: string): Promise<number> {
  // We don't have a dedicated "session" table; approximate via
  // distinct user_ids on the user-events stream over the window.
  try {
    const r = await supabase
      .from('analytics_user_events')
      .select('user_id')
      .gte('occurred_at', since_iso);
    if (!Array.isArray(r.data)) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = r.data as Array<{ user_id: string }>;
    return new Set(rows.map((x) => x.user_id)).size;
  } catch {
    return 0;
  }
}

/**
 * Return MAX(`column`) over the table within the window — used for
 * data_freshness. Returns null on any failure (table absent, RLS
 * blocks, no rows).
 */
async function maxTimestamp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  column: string,
  since_iso: string
): Promise<string | null> {
  try {
    const r = await supabase
      .from(table)
      .select(column)
      .gte(column, since_iso)
      .order(column, { ascending: false })
      .limit(1);
    if (!Array.isArray(r.data) || r.data.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = r.data[0] as Record<string, any>;
    return (row[column] as string) ?? null;
  } catch {
    return null;
  }
}

export const __test = { uniqueUsers, maxTimestamp };
