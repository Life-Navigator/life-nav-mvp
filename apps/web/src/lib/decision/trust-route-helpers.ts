/**
 * Shared helpers for the 5 trust API routes.
 *
 * The route's `[id]` parameter is interpreted as a
 * `recommendation_audit_trail.id`. The audit row carries the
 * structured `output_summary` + `input_snapshot` that the
 * WhyChainBuilder / CounterfactualEngine / AssumptionEngine /
 * EvidenceGraph services consume.
 *
 * All loads are RLS-bounded.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuditTargetKind, AuditTrailEntry } from '@/types/xai';

export interface AuditRow {
  id: string;
  user_id: string;
  target_kind: AuditTargetKind;
  target_id?: string | null;
  input_snapshot: Record<string, unknown>;
  engine_versions: Record<string, string>;
  intermediate: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  computed_at: string;
  duration_ms?: number | null;
}

export async function loadAuditRow(
  supabase: SupabaseClient,
  userId: string,
  auditId: string
): Promise<AuditRow | null> {
  const sb = supabase as any;
  const { data, error } = await sb
    .from('recommendation_audit_trail')
    .select('*')
    .eq('user_id', userId)
    .eq('id', auditId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AuditRow;
}

export function auditToEntry(row: AuditRow): AuditTrailEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    target_kind: row.target_kind,
    target_id: row.target_id ?? undefined,
    input_snapshot: row.input_snapshot,
    engine_versions: row.engine_versions ?? {},
    intermediate: row.intermediate ?? {},
    output_summary: row.output_summary,
    computed_at: row.computed_at,
    duration_ms: row.duration_ms ?? undefined,
  };
}
