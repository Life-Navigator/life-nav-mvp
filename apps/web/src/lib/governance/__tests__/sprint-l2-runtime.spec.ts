/**
 * @jest-environment node
 *
 * Sprint N.2 Phase 1 verification — proves guardOutgoing runs the full
 * Sprint L2 constitutional pipeline (not the legacy Sprint L pipeline).
 *
 * What this asserts that the bypass spec does not:
 *
 *   1. A row is inserted into `decision_governance_audit` with the Sprint
 *      L2 extension columns populated (constitutional_verdict, risk_level,
 *      iteration_count, draft_hash, final_hash, retrieval_ok).
 *   2. At least one row is inserted into `governance_review_iterations`.
 *   3. The returned `GuardSuccess.constitutional` carries a full
 *      ConstitutionalDecision with crisis + emotional + future fields.
 *   4. The returned `GuardSuccess.final_text` is present (the L2 layer
 *      may have rewritten the draft).
 */

import { guardOutgoing } from '../route-guard';
import { __test as ctest } from '@/lib/constitutional/retrieval';
import type { GovernanceSubject } from '@/types/governance';

interface InsertCapture {
  table: string;
  rows: unknown;
}

function captureSupabase() {
  const inserts: InsertCapture[] = [];
  return {
    inserts,
    client: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (table: string) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert: (rows: any) => {
          inserts.push({ table, rows });
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: `mock_${inserts.length}` }, error: null }),
            }),
          };
        },
        // For the retrieval read path: return empty set so retrieval_ok=false.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (_cols: string) => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    },
  };
}

function clean(text: string): GovernanceSubject {
  return {
    kind: 'recommendation',
    text,
    citations: [{ label: 'Test' }],
    assumptions: ['x'],
    risks: ['y'],
    confidence: 0.7,
    tradeoffs: [{ summary: 't' }],
  };
}

describe('Sprint L2 runtime activation (Phase 1)', () => {
  beforeEach(() => {
    // Make sure retrieval cache state is reset between tests so this suite
    // is order-independent.
    ctest._clearCache();
  });

  test('guardOutgoing on a clean subject persists Sprint L2 audit + iteration rows', async () => {
    const { inserts, client } = captureSupabase();
    const g = await guardOutgoing({
      supabase: client,
      user_id: 'user_l2_runtime',
      subject: clean('Consider increasing your 401(k) contribution to capture the employer match.'),
      emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
    });

    expect(g.ok).toBe(true);
    if (!g.ok) return;

    // Constitutional decision surfaced
    expect(g.constitutional).toBeDefined();
    expect(g.constitutional.verdict).toBeDefined();
    expect(g.constitutional.governance).toBeDefined();
    expect(g.constitutional.crisis).toBeDefined();
    expect(g.constitutional.emotional).toBeDefined();
    expect(g.constitutional.future_preservation).toBeDefined();

    // Sprint L decision surfaced (back-compat)
    expect(g.decision).toBeDefined();
    expect(g.decision.approved).toBe(true);

    // Final text exists
    expect(typeof g.final_text).toBe('string');
    expect(g.final_text.length).toBeGreaterThan(0);

    // Audit row written with Sprint L2 extension columns
    const auditRows = inserts.filter((i) => i.table === 'decision_governance_audit');
    expect(auditRows.length).toBe(1);
    const auditRow = auditRows[0].rows as Record<string, unknown>;
    expect(auditRow.constitutional_verdict).toBeDefined();
    expect(auditRow.risk_level).toBeDefined();
    expect(auditRow.iteration_count).toBeGreaterThanOrEqual(1);
    expect(auditRow.draft_hash).toBeDefined();
    expect(auditRow.final_hash).toBeDefined();
    expect(auditRow.retrieval_ok).toBe(false); // empty rule set in test
    expect(auditRow.user_id).toBe('user_l2_runtime');

    // Per-iteration trace written
    const iterRows = inserts.filter((i) => i.table === 'governance_review_iterations');
    expect(iterRows.length).toBe(1);
    expect(Array.isArray(iterRows[0].rows)).toBe(true);
    expect((iterRows[0].rows as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test('blocked subject still emits audit + iteration trail (no silent block)', async () => {
    const { inserts, client } = captureSupabase();
    const g = await guardOutgoing({
      supabase: client,
      user_id: 'user_l2_block',
      subject: clean('Smuggle the package across the border.'),
      emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
    });

    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.decision.approved).toBe(false);
    expect(g.decision.violations.length).toBeGreaterThan(0);

    // Even when blocking, the audit must record the verdict so the
    // governance team can review what was rejected.
    const auditRows = inserts.filter((i) => i.table === 'decision_governance_audit');
    expect(auditRows.length).toBe(1);
    const auditRow = auditRows[0].rows as Record<string, unknown>;
    expect(auditRow.approved).toBe(false);
    expect(auditRow.constitutional_verdict).toBeDefined();
  });
});
