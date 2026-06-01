/**
 * Constitutional GraphRAG Runtime Retrieval — Sprint M Phase 3.
 *
 * Replaces the Sprint L2 `retrieval_ok: true` stub with a live read
 * against `governance.constitutional_entities`. The retriever:
 *
 *   1. Pulls the active rule set per kind (principles, governance
 *      rules, legal rules, safety rules, future-preservation rules,
 *      crisis indicators, cognitive distortion patterns).
 *   2. Caches the result for 60 seconds. The cache is in-memory per
 *      process; on cold start the first review pays a single DB
 *      roundtrip.
 *   3. Emits a row into `ops.retrieval_cache_meter` per call so we
 *      can measure hit rate.
 *   4. **Fails closed.** If the DB call errors, returns
 *      `{ ok: false, retrieved: {}, reason }`. Callers MUST forward
 *      `ok: false` into the orchestrator as `retrieval_ok: false`.
 */

export interface ConstitutionalEntity {
  id: string;
  entity_kind: string;
  slug: string;
  name: string;
  body: string;
  source?: string | null;
  citation_reference?: string | null;
  version: string;
  review_status: string;
  tags: string[];
}

export interface RetrievedRuleSet {
  principles: ConstitutionalEntity[];
  governance_rules: ConstitutionalEntity[];
  legal_rules: ConstitutionalEntity[];
  safety_rules: ConstitutionalEntity[];
  harm_rules: ConstitutionalEntity[];
  neutrality_rules: ConstitutionalEntity[];
  future_preservation_rules: ConstitutionalEntity[];
  opportunity_rules: ConstitutionalEntity[];
  trajectory_rules: ConstitutionalEntity[];
  need_behind_need_patterns: ConstitutionalEntity[];
  conflict_of_interest_rules: ConstitutionalEntity[];
  cognitive_distortion_patterns: ConstitutionalEntity[];
  crisis_indicators: ConstitutionalEntity[];
  realism_rules: ConstitutionalEntity[];
  /** All retrieved ids, used by audit log. */
  retrieved_rule_ids: string[];
  /** Stable hash of the rule set version, used for replay. */
  rule_set_version: string;
}

export interface RetrievalResult {
  ok: boolean;
  retrieved: RetrievedRuleSet | null;
  reason?: string;
  cache_hit: boolean;
  latency_ms: number;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number;
  data: RetrievedRuleSet;
}
const CACHE_TTL_MS = 60_000;
let CACHE: CacheEntry | null = null;

function cacheFresh(): boolean {
  return Boolean(CACHE && Date.now() - CACHE.at < CACHE_TTL_MS);
}

export function clearRetrievalCache(): void {
  CACHE = null;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Partition by kind
// ---------------------------------------------------------------------------

function partition(rows: ConstitutionalEntity[]): RetrievedRuleSet {
  const byKind: Record<string, ConstitutionalEntity[]> = {};
  for (const r of rows) {
    if (!byKind[r.entity_kind]) byKind[r.entity_kind] = [];
    byKind[r.entity_kind].push(r);
  }
  const k = (n: string) => (byKind[n] ?? []).slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const retrieved_rule_ids = rows.map((r) => `${r.entity_kind}.${r.slug}`).sort();
  const rule_set_version = djb2(retrieved_rule_ids.join('|'));
  return {
    principles: k('ConstitutionalPrinciple'),
    governance_rules: k('GovernanceRule'),
    legal_rules: k('LegalRule'),
    safety_rules: k('SafetyRule'),
    harm_rules: k('HarmRule'),
    neutrality_rules: k('NeutralityRule'),
    future_preservation_rules: k('FuturePreservationRule'),
    opportunity_rules: k('OpportunityRule'),
    trajectory_rules: k('TrajectoryRule'),
    need_behind_need_patterns: k('NeedBehindNeedPattern'),
    conflict_of_interest_rules: k('ConflictOfInterestRule'),
    cognitive_distortion_patterns: k('CognitiveDistortionPattern'),
    crisis_indicators: k('CrisisIndicator'),
    realism_rules: k('RealismRule'),
    retrieved_rule_ids,
    rule_set_version,
  };
}

// ---------------------------------------------------------------------------
// Live retrieval
// ---------------------------------------------------------------------------

export interface RetrieveOptions {
  supabase: any;
  /** Bypass cache (used by health checks). */
  no_cache?: boolean;
  /** Best-effort write into ops.retrieval_cache_meter. */
  record_meter?: boolean;
}

export async function retrieveConstitutionalRuleSet(
  opts: RetrieveOptions
): Promise<RetrievalResult> {
  const t0 = Date.now();

  if (!opts.no_cache && cacheFresh()) {
    if (opts.record_meter) {
      try {
        await opts.supabase.from('ops_retrieval_cache_meter').insert({
          cache_kind: 'constitutional_rule_set',
          hit: true,
          latency_ms: 0,
          retrieved_count: CACHE!.data.retrieved_rule_ids.length,
        });
      } catch {
        /* meter is best-effort */
      }
    }
    return {
      ok: true,
      retrieved: CACHE!.data,
      cache_hit: true,
      latency_ms: 0,
    };
  }

  let r;
  try {
    r = await opts.supabase
      .from('constitutional_entities')
      .select(
        'id, entity_kind, slug, name, body, source, citation_reference, version, review_status, tags'
      )
      .eq('review_status', 'active');
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'retrieval_exception';
    return { ok: false, retrieved: null, reason, cache_hit: false, latency_ms: Date.now() - t0 };
  }
  if (r.error) {
    return {
      ok: false,
      retrieved: null,
      reason: r.error.message,
      cache_hit: false,
      latency_ms: Date.now() - t0,
    };
  }

  const rows = (r.data ?? []) as ConstitutionalEntity[];
  if (rows.length === 0) {
    // Empty result is treated as a retrieval failure — the
    // constitutional layer is not optional.
    return {
      ok: false,
      retrieved: null,
      reason: 'empty_rule_set',
      cache_hit: false,
      latency_ms: Date.now() - t0,
    };
  }

  const data = partition(rows);
  CACHE = { at: Date.now(), data };
  const latency_ms = Date.now() - t0;

  if (opts.record_meter) {
    try {
      await opts.supabase.from('ops_retrieval_cache_meter').insert({
        cache_kind: 'constitutional_rule_set',
        hit: false,
        latency_ms,
        retrieved_count: rows.length,
      });
    } catch {
      /* meter is best-effort */
    }
  }

  return { ok: true, retrieved: data, cache_hit: false, latency_ms };
}

// ---------------------------------------------------------------------------
// Pure helper for tests + offline replay
// ---------------------------------------------------------------------------

export function ruleSetFromRows(rows: ConstitutionalEntity[]): RetrievedRuleSet {
  return partition(rows);
}

export const __test = {
  partition,
  djb2,
  cacheFresh,
  ruleSetFromRows,
  // exposed only for tests
  _seedCache: (data: RetrievedRuleSet) => {
    CACHE = { at: Date.now(), data };
  },
  _clearCache: clearRetrievalCache,
};
