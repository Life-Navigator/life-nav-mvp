/**
 * Economic governance dashboard aggregations — Sprint O.0.2 Phase 11.
 *
 * Returns a single snapshot the operator dashboard consumes:
 *
 *   spend (mtd / today / projected)
 *   users (active in window, top cost users)
 *   features (top cost features)
 *   uploads (volume)
 *   provider costs
 *   budgets (platform + per-user warnings/blocks)
 *   active throttles + blocks
 */

import { microsToUsd } from '@/lib/economic';

export interface EconomicSnapshot {
  generated_at: string;
  spend: {
    mtd_usd: number;
    today_usd: number;
    projected_month_end_usd: number;
    monthly_cap_usd: number;
    remaining_usd: number;
  };
  users: {
    active_7d: number;
    top_cost_7d: Array<{ user_id: string; cost_usd: number }>;
  };
  features: Array<{ feature: string; cost_usd: number }>;
  uploads: {
    files_7d: number;
    bytes_7d: number;
    bytes_mtd: number;
  };
  providers: Array<{ provider: string; cost_usd: number }>;
  budgets: {
    platform_status: string;
    users_in_warning: number;
    users_in_throttled: number;
    users_in_blocked: number;
  };
  active_throttles: number;
  active_blocks: number;
  data_freshness: {
    usage_events: string | null;
    platform_budget: string | null;
    abuse_events: string | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxTimestamp(sb: any, table: string, column: string): Promise<string | null> {
  try {
    const r = await sb.from(table).select(column).order(column, { ascending: false }).limit(1);
    if (!Array.isArray(r.data) || r.data.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((r.data[0] as Record<string, any>)[column] as string) ?? null;
  } catch {
    return null;
  }
}

export async function computeEconomicSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<EconomicSnapshot> {
  const now = Date.now();
  const since_today = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since_7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since_mtd = new Date(
    new Date().toISOString().slice(0, 8) + '01T00:00:00.000Z'
  ).toISOString();

  const snap: EconomicSnapshot = {
    generated_at: new Date(now).toISOString(),
    spend: {
      mtd_usd: 0,
      today_usd: 0,
      projected_month_end_usd: 0,
      monthly_cap_usd: 500,
      remaining_usd: 500,
    },
    users: { active_7d: 0, top_cost_7d: [] },
    features: [],
    uploads: { files_7d: 0, bytes_7d: 0, bytes_mtd: 0 },
    providers: [],
    budgets: {
      platform_status: 'NORMAL',
      users_in_warning: 0,
      users_in_throttled: 0,
      users_in_blocked: 0,
    },
    active_throttles: 0,
    active_blocks: 0,
    data_freshness: {
      usage_events: null,
      platform_budget: null,
      abuse_events: null,
    },
  };

  // ---- Platform budget --------------------------------------------------
  try {
    const r = await supabase
      .from('economic_platform_budget')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();
    if (r.data) {
      snap.spend.monthly_cap_usd = microsToUsd(r.data.monthly_cap_micros);
      snap.spend.mtd_usd = microsToUsd(r.data.current_monthly_micros);
      snap.spend.remaining_usd = Math.max(0, snap.spend.monthly_cap_usd - snap.spend.mtd_usd);
      snap.budgets.platform_status = r.data.status ?? 'NORMAL';
    }
  } catch {
    /* keep defaults */
  }

  // ---- Spend today + MTD + projection -----------------------------------
  try {
    const r = await supabase
      .from('economic_usage_events')
      .select('cost_usd_micros, user_id, feature, provider, created_at')
      .gte('created_at', since_mtd);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = r.data as Array<{
        cost_usd_micros: number;
        user_id: string;
        feature: string;
        provider: string;
        created_at: string;
      }>;
      let today = 0;
      const per_user = new Map<string, number>();
      const per_feat = new Map<string, number>();
      const per_prov = new Map<string, number>();
      for (const row of rows) {
        const c = row.cost_usd_micros ?? 0;
        if (row.created_at >= since_today) today += c;
        per_user.set(row.user_id, (per_user.get(row.user_id) ?? 0) + c);
        per_feat.set(row.feature, (per_feat.get(row.feature) ?? 0) + c);
        if (row.provider) per_prov.set(row.provider, (per_prov.get(row.provider) ?? 0) + c);
      }
      snap.spend.today_usd = microsToUsd(today);
      snap.users.top_cost_7d = Array.from(per_user.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([user_id, cost]) => ({ user_id, cost_usd: microsToUsd(cost) }));
      snap.features = Array.from(per_feat.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([feature, cost]) => ({ feature, cost_usd: microsToUsd(cost) }));
      snap.providers = Array.from(per_prov.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([provider, cost]) => ({ provider, cost_usd: microsToUsd(cost) }));

      // Linear projection: scale today's spend × days remaining in month.
      const today_d = new Date(now);
      const day_of_month = today_d.getUTCDate();
      const days_in_month = new Date(
        today_d.getUTCFullYear(),
        today_d.getUTCMonth() + 1,
        0
      ).getUTCDate();
      const days_left = Math.max(1, days_in_month - day_of_month);
      const avg_daily = snap.spend.mtd_usd / Math.max(1, day_of_month);
      snap.spend.projected_month_end_usd = snap.spend.mtd_usd + avg_daily * days_left;
    }
  } catch {
    /* keep zeros */
  }

  // ---- Active users (last 7d) ------------------------------------------
  try {
    const r = await supabase
      .from('analytics_user_events')
      .select('user_id')
      .gte('occurred_at', since_7d);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = new Set((r.data as Array<{ user_id: string }>).map((x) => x.user_id));
      snap.users.active_7d = ids.size;
    }
  } catch {
    /* keep zeros */
  }

  // ---- Upload volume ----------------------------------------------------
  try {
    const r = await supabase
      .from('ingestion_files')
      .select('size_bytes, created_at')
      .gte('created_at', since_mtd);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = r.data as Array<{ size_bytes: number; created_at: string }>;
      let count7 = 0,
        bytes7 = 0,
        bytesMtd = 0;
      for (const row of rows) {
        bytesMtd += row.size_bytes ?? 0;
        if (row.created_at >= since_7d) {
          count7 += 1;
          bytes7 += row.size_bytes ?? 0;
        }
      }
      snap.uploads.files_7d = count7;
      snap.uploads.bytes_7d = bytes7;
      snap.uploads.bytes_mtd = bytesMtd;
    }
  } catch {
    /* keep zeros */
  }

  // ---- Budget statuses --------------------------------------------------
  try {
    const r = await supabase.from('economic_user_budgets').select('status');
    if (Array.isArray(r.data)) {
      for (const row of r.data as Array<{ status: string }>) {
        if (row.status === 'WARNING') snap.budgets.users_in_warning += 1;
        if (row.status === 'THROTTLED') {
          snap.budgets.users_in_throttled += 1;
          snap.active_throttles += 1;
        }
        if (row.status === 'BLOCKED') {
          snap.budgets.users_in_blocked += 1;
          snap.active_blocks += 1;
        }
      }
    }
  } catch {
    /* keep zeros */
  }

  // ---- Active circuit breakers -----------------------------------------
  try {
    const r = await supabase.from('economic_circuit_breakers').select('state');
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const states = (r.data as Array<{ state: string }>).map((x) => x.state);
      snap.active_blocks += states.filter((s) => s === 'OPEN').length;
    }
  } catch {
    /* keep zeros */
  }

  // ---- Freshness --------------------------------------------------------
  snap.data_freshness.usage_events = await maxTimestamp(
    supabase,
    'economic_usage_events',
    'created_at'
  );
  snap.data_freshness.platform_budget = await maxTimestamp(
    supabase,
    'economic_platform_budget',
    'updated_at'
  );
  snap.data_freshness.abuse_events = await maxTimestamp(
    supabase,
    'economic_abuse_events',
    'created_at'
  );

  return snap;
}
