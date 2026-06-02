/**
 * Operational Readiness Dashboard aggregations — Sprint R Phase 7.
 *
 *   uptime               (derived from incidents over the window)
 *   open incidents       (severity rollup)
 *   open vulnerabilities (severity rollup)
 *   secrets age          (oldest + due-soon + overdue)
 *   backup health        (last backup ok / age days)
 *   access reviews       (coverage + overdue)
 */

import { rollupVendors, vendorsDueForReview } from '@/lib/enterprise/vendor-registry';
import { partitionByDueness } from '@/lib/enterprise/secret-rotation';
import { coverageReport } from '@/lib/enterprise/access-review';
import type { Vendor, SecretRotationItem, AccessReview } from '@/lib/enterprise/types';

export interface ReadinessSnapshot {
  generated_at: string;
  window_days: number;
  uptime: {
    minutes_total: number;
    minutes_outage: number;
    uptime_pct: number;
  };
  incidents: {
    open: number;
    by_severity: Record<string, number>;
    mttr_hours: number | null;
  };
  vulnerabilities: {
    open: number;
    by_severity: Record<string, number>;
    overdue: number;
  };
  secrets: {
    total: number;
    overdue: number;
    due_soon: number;
    oldest_age_days: number;
  };
  backups: {
    last_backup_at: string | null;
    age_days: number | null;
    healthy: boolean;
  };
  access_reviews: {
    coverage: ReturnType<typeof coverageReport>;
  };
  vendors: ReturnType<typeof rollupVendors> & {
    due_for_review: string[];
  };
  data_freshness: {
    incidents: string | null;
    vulnerabilities: string | null;
    secrets: string | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxTs(sb: any, table: string, column: string): Promise<string | null> {
  try {
    const r = await sb.from(table).select(column).order(column, { ascending: false }).limit(1);
    if (!Array.isArray(r.data) || r.data.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((r.data[0] as Record<string, any>)[column] as string) ?? null;
  } catch {
    return null;
  }
}

export async function computeReadinessSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  window_days = 30
): Promise<ReadinessSnapshot> {
  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();
  const snap: ReadinessSnapshot = {
    generated_at: new Date().toISOString(),
    window_days,
    uptime: { minutes_total: window_days * 24 * 60, minutes_outage: 0, uptime_pct: 1 },
    incidents: { open: 0, by_severity: {}, mttr_hours: null },
    vulnerabilities: { open: 0, by_severity: {}, overdue: 0 },
    secrets: { total: 0, overdue: 0, due_soon: 0, oldest_age_days: 0 },
    backups: { last_backup_at: null, age_days: null, healthy: false },
    access_reviews: {
      coverage: {
        required_scopes: [],
        scopes_with_open_review: [],
        scopes_missing_review: [],
        overdue_reviews: [],
      },
    },
    vendors: {
      total: 0,
      by_tier: { high: 0, medium: 0, low: 0 },
      pending_review: 0,
      reviews_overdue: 0,
      dpa_signed_pct: 0,
      named_vendors_present: 0,
      due_for_review: [],
    },
    data_freshness: { incidents: null, vulnerabilities: null, secrets: null },
  };

  // ---- Incidents -------------------------------------------------------
  try {
    const r = await supabase
      .from('enterprise.incidents' as string)
      .select('severity, status, detected_at, mitigated_at, resolved_at')
      .gte('detected_at', since);
    const rows = Array.isArray(r.data) ? r.data : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typed = rows as Array<{
      severity: string;
      status: string;
      detected_at: string;
      mitigated_at: string | null;
      resolved_at: string | null;
    }>;
    let open = 0;
    let mttr_sum = 0;
    let mttr_n = 0;
    let outage_min = 0;
    for (const row of typed) {
      if (
        row.status === 'open' ||
        row.status === 'mitigated' ||
        row.status === 'postmortem_pending'
      )
        open += 1;
      snap.incidents.by_severity[row.severity] =
        (snap.incidents.by_severity[row.severity] ?? 0) + 1;
      if (row.resolved_at) {
        const dt = Date.parse(row.detected_at);
        const rt = Date.parse(row.resolved_at);
        if (!Number.isNaN(dt) && !Number.isNaN(rt)) {
          mttr_sum += (rt - dt) / (60 * 60 * 1000);
          mttr_n += 1;
        }
      }
      // SEV1/SEV2 count toward outage; rough heuristic.
      if (row.severity === 'SEV1' || row.severity === 'SEV2') {
        const dt = Date.parse(row.detected_at);
        const mt = row.mitigated_at ? Date.parse(row.mitigated_at) : null;
        if (!Number.isNaN(dt) && mt) {
          outage_min += Math.max(0, (mt - dt) / (60 * 1000));
        }
      }
    }
    snap.incidents.open = open;
    snap.incidents.mttr_hours = mttr_n === 0 ? null : Math.round((mttr_sum / mttr_n) * 10) / 10;
    snap.uptime.minutes_outage = Math.round(outage_min);
    snap.uptime.uptime_pct = Math.max(
      0,
      1 - snap.uptime.minutes_outage / Math.max(1, snap.uptime.minutes_total)
    );
    snap.uptime.uptime_pct = Math.round(snap.uptime.uptime_pct * 100000) / 100000;
  } catch {
    /* keep defaults */
  }

  // ---- Vulnerabilities -------------------------------------------------
  try {
    const r = await supabase
      .from('enterprise.vulnerabilities' as string)
      .select('severity, status, due_at');
    const rows = Array.isArray(r.data) ? r.data : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typed = rows as Array<{ severity: string; status: string; due_at: string | null }>;
    let open = 0;
    let overdue = 0;
    const today = new Date().toISOString();
    for (const row of typed) {
      if (row.status === 'open' || row.status === 'accepted') {
        open += 1;
        snap.vulnerabilities.by_severity[row.severity] =
          (snap.vulnerabilities.by_severity[row.severity] ?? 0) + 1;
        if (row.due_at && row.due_at < today) overdue += 1;
      }
    }
    snap.vulnerabilities.open = open;
    snap.vulnerabilities.overdue = overdue;
  } catch {
    /* keep defaults */
  }

  // ---- Secrets ---------------------------------------------------------
  try {
    const r = await supabase.from('enterprise.secret_rotation_schedule' as string).select('*');
    const items: SecretRotationItem[] = Array.isArray(r.data) ? r.data : [];
    const due = partitionByDueness(items);
    snap.secrets.total = items.length;
    snap.secrets.overdue = due.overdue.length;
    snap.secrets.due_soon = due.due_soon.length;
    snap.secrets.oldest_age_days = due.oldest_age_days;
  } catch {
    /* keep defaults */
  }

  // ---- Backups (best-effort; derive from observability table if present)
  // For Sprint R we use a simple metadata-driven check: read the most
  // recent row from `enterprise.assets` where `metadata.last_backup_at`
  // is set on the supabase.postgres asset. Falls through to "unknown"
  // when no data is available.
  try {
    const r = await supabase
      .from('enterprise.assets' as string)
      .select('metadata')
      .eq('asset_kind', 'database')
      .eq('name', 'supabase.postgres')
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (r?.data as { metadata?: Record<string, any> } | null)?.metadata ?? null;
    if (meta?.last_backup_at) {
      snap.backups.last_backup_at = String(meta.last_backup_at);
      const age = Math.round(
        (Date.now() - Date.parse(snap.backups.last_backup_at)) / (24 * 60 * 60 * 1000)
      );
      snap.backups.age_days = age;
      snap.backups.healthy = age <= 1;
    }
  } catch {
    /* keep defaults */
  }

  // ---- Access reviews --------------------------------------------------
  try {
    const r = await supabase.from('enterprise.access_reviews' as string).select('*');
    const reviews: AccessReview[] = Array.isArray(r.data) ? r.data : [];
    snap.access_reviews.coverage = coverageReport(reviews);
  } catch {
    /* keep defaults */
  }

  // ---- Vendors ---------------------------------------------------------
  try {
    const r = await supabase.from('enterprise.vendors' as string).select('*');
    const vendors: Vendor[] = Array.isArray(r.data) ? r.data : [];
    const rollup = rollupVendors(vendors);
    const due = vendorsDueForReview(vendors, 30).map((v) => v.vendor_key);
    snap.vendors = { ...rollup, due_for_review: due };
  } catch {
    /* keep defaults */
  }

  // ---- Freshness -------------------------------------------------------
  snap.data_freshness.incidents = await maxTs(supabase, 'enterprise.incidents', 'detected_at');
  snap.data_freshness.vulnerabilities = await maxTs(
    supabase,
    'enterprise.vulnerabilities',
    'created_at'
  );
  snap.data_freshness.secrets = await maxTs(
    supabase,
    'enterprise.secret_rotation_schedule',
    'updated_at'
  );

  return snap;
}
