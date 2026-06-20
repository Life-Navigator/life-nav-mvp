/**
 * Persist a computed readiness / Life Brief result to life.readiness_snapshots so the
 * Python advisor + PDF report can cite the SAME numbers the web tier computed (one source
 * of truth). This records an already-computed result — it does not re-score anything.
 * Best-effort: a snapshot write never fails the readiness/brief response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface SnapshotRow {
  score?: number | null;
  status?: string | null;
  confidence?: number | null;
  components?: unknown;
  strengths?: unknown;
  gaps?: unknown;
  recommendedActions?: unknown;
  dataSources?: unknown;
  missingData?: unknown;
  payload?: unknown;
}

export async function persistSnapshot(
  sb: SB,
  userId: string,
  domain: 'career' | 'education' | 'life_brief',
  row: SnapshotRow
): Promise<void> {
  try {
    await sb
      .schema('life')
      .from('readiness_snapshots')
      .upsert(
        {
          user_id: userId,
          domain,
          score: row.score ?? null,
          status: row.status ?? null,
          confidence: row.confidence ?? null,
          components: row.components ?? [],
          strengths: row.strengths ?? [],
          gaps: row.gaps ?? [],
          recommended_actions: row.recommendedActions ?? [],
          data_sources: row.dataSources ?? [],
          missing_data: row.missingData ?? [],
          payload: row.payload ?? null,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,domain' }
      );
  } catch {
    /* non-fatal */
  }
}
