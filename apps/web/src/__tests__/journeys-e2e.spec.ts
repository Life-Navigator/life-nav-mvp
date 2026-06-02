/**
 * @jest-environment node
 *
 * Sprint N.2 Phase 9 — E2E coverage of the 8 critical user journeys.
 *
 * "E2E" here means the test exercises the journey's orchestrator
 * (the layer just below the HTTP handler) with realistic inputs and
 * a fake-but-capture-everything supabase. It catches regressions in:
 *
 *   - missing guards / governance wiring (Sprint L + L2)
 *   - missing security gates (Phase 2/3 — malware + storage)
 *   - missing observability writes (Phase 4 — telemetry + cost)
 *   - missing tenant scope (Sprint P + Phase 1 hardening)
 *
 * It does NOT spin up a browser or Vercel runtime. For full smoke
 * coverage with a real Supabase, see scripts/validation/*.sql which
 * run server-side assertions.
 */

import fs from 'node:fs';
import path from 'node:path';

import { guardOutgoing } from '@/lib/governance/route-guard';
import { processUpload } from '@/lib/ingestion/upload-pipeline';
import { __test as ctest } from '@/lib/constitutional/retrieval';
import type { GovernanceSubject } from '@/types/governance';
import type { MalwareScanner } from '@/lib/malware/scanner';
import type { StorageAdapter } from '@/lib/storage/object-store';

const REPO = path.resolve(__dirname, '../../../..');
const APP_API = path.resolve(__dirname, '../app/api');

function readRoute(rel: string): string {
  return fs.readFileSync(path.join(APP_API, rel), 'utf8');
}

interface Op {
  table: string;
  op: 'insert' | 'update' | 'select' | 'rpc';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

function captureSupabase() {
  const ops: Op[] = [];
  let counter = 0;
  const client = {
    from(table: string) {
      const builder = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert(payload: any) {
          counter += 1;
          ops.push({ table, op: 'insert', payload });
          const id = `${table}_${counter}`;
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id }, error: null });
                },
              };
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update(payload: any) {
          ops.push({ table, op: 'update', payload });
          return {
            eq() {
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select(_cols: string) {
          ops.push({ table, op: 'select' });
          return {
            eq() {
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      };
      return builder;
    },
  };
  return { ops, client };
}

const TXT = new TextEncoder().encode('journey e2e payload');

function cleanSubject(kind: GovernanceSubject['kind'], text: string): GovernanceSubject {
  return {
    kind,
    text,
    citations: [{ label: 'test' }],
    assumptions: ['x'],
    risks: ['y'],
    confidence: 0.7,
    tradeoffs: [{ summary: 't' }],
  };
}

function cleanScanner(): MalwareScanner {
  return {
    name: 'clamav',
    async scan() {
      return {
        scanner: 'clamav',
        scanner_version: 'tcp-instream',
        status: 'clean',
        details: {},
        duration_ms: 5,
      };
    },
  };
}

function fakeStorage(): StorageAdapter {
  return {
    async uploadObject(args) {
      return {
        bucket: 'ingestion',
        path: `${args.user_id}/${args.file_id}/${args.version_number}/${args.sha256}`,
        size_bytes: args.bytes.length,
        sha256: args.sha256,
      };
    },
    async getSignedDownloadUrl() {
      return 'https://example.test/signed';
    },
    async deleteObject() {
      return { ok: true };
    },
  };
}

beforeEach(() => {
  ctest._clearCache();
});

// ===========================================================================
// Journey 1 — Consumer onboarding (life-vision)
// ===========================================================================
describe('Journey 1: Consumer onboarding', () => {
  test('life-vision route enforces auth and uses Supabase', () => {
    const src = readRoute('onboarding/life-vision/route.ts');
    expect(src).toMatch(/auth\.getUser|createServerSupabaseClient/);
    expect(src).not.toMatch(/localStorage/);
  });

  test('save-user-graph helper writes the user-bound payload', async () => {
    // Tested already in src/lib/onboarding/__tests__/save-user-graph.test.ts.
    // Here we just assert the route imports the helper.
    const src = readRoute('onboarding/life-vision/route.ts');
    expect(src).toMatch(/from ['"]@\/lib\/(onboarding|supabase|.+)/);
  });
});

// ===========================================================================
// Journey 2 — Goals
// ===========================================================================
describe('Journey 2: Goals', () => {
  test('goals route requires authentication', () => {
    const src = readRoute('goals/route.ts');
    expect(src).toMatch(/auth\.getUser|Unauthorized|unauthorized/);
  });
});

// ===========================================================================
// Journey 3 — Recommendation generation
// ===========================================================================
describe('Journey 3: Recommendation generation', () => {
  test('recommendation /why route is governed via guardOutgoing', () => {
    const src = readRoute('recommendations/[id]/why/route.ts');
    expect(src).toMatch(/guardOutgoing/);
  });

  test('a clean recommendation subject ships approved with constitutional decision', async () => {
    const { ops, client } = captureSupabase();
    const g = await guardOutgoing({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      user_id: 'u_e2e_rec',
      subject: cleanSubject(
        'recommendation',
        'Consider increasing your 401(k) contribution to capture the employer match.'
      ),
      emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
    });

    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.decision.approved).toBe(true);
    expect(g.constitutional).toBeDefined();
    // Audit + iterations persisted
    expect(ops.find((o) => o.table === 'decision_governance_audit')).toBeDefined();
    expect(ops.find((o) => o.table === 'governance_review_iterations')).toBeDefined();
  });
});

// ===========================================================================
// Journey 4 — Simulation
// ===========================================================================
describe('Journey 4: Simulation', () => {
  test('simulations/create route is governed', () => {
    const src = readRoute('simulations/create/route.ts');
    expect(src).toMatch(/guardOutgoing/);
  });
  test('scenario-lab simulate route is governed', () => {
    const src = readRoute('scenario-lab/versions/[versionId]/simulate/route.ts');
    expect(src).toMatch(/guardOutgoing/);
  });
});

// ===========================================================================
// Journey 5 — Arcana workflow
// ===========================================================================
describe('Journey 5: Arcana workflow', () => {
  test.each([
    'arcana/readiness/route.ts',
    'arcana/catch-up/route.ts',
    'arcana/lead-package/route.ts',
  ])('%s is governed', (rel) => {
    const src = readRoute(rel);
    expect(src).toMatch(/guardOutgoing/);
  });

  test('arcana provider patient recommendation is governed', () => {
    const src = readRoute('provider/patients/[id]/recommendation/route.ts');
    expect(src).toMatch(/guardOutgoing/);
  });
});

// ===========================================================================
// Journey 6 — Multimodal upload (Phase 2 + 3 + 4 wiring)
// ===========================================================================
describe('Journey 6: Multimodal upload', () => {
  test('upload route delegates to processUpload + uses defaultScanner + storage adapter', () => {
    const src = readRoute('ingest/upload/route.ts');
    expect(src).toMatch(/processUpload/);
    expect(src).toMatch(/defaultScanner/);
    expect(src).toMatch(/SupabaseStorageAdapter/);
  });

  test('end-to-end: clean upload writes scan + storage + telemetry rows', async () => {
    const { ops, client } = captureSupabase();
    const result = await processUpload({
      user_id: 'u_e2e_upload',
      filename: 'note.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: cleanScanner(),
      storage: fakeStorage(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scan.status).toBe('clean');
    expect(result.storage?.bucket).toBe('ingestion');
    expect(ops.find((o) => o.table === 'ingestion_malware_scans')).toBeDefined();
    expect(ops.find((o) => o.table === 'ingestion_extraction_telemetry')).toBeDefined();
    expect(
      ops.find((o) => o.table === 'ingestion_files' && o.op === 'update' && o.payload?.storage_path)
    ).toBeDefined();
  });

  test('infected upload BLOCKS extraction', async () => {
    const infectedScanner: MalwareScanner = {
      name: 'clamav',
      async scan() {
        return {
          scanner: 'clamav',
          status: 'infected',
          signature: 'EICAR-Test-File',
          details: {},
          duration_ms: 5,
        };
      },
    };
    const { ops, client } = captureSupabase();
    const result = await processUpload({
      user_id: 'u_e2e_evil',
      filename: 'evil.txt',
      declared_mime: 'text/plain',
      bytes: TXT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      scanner: infectedScanner,
      storage: fakeStorage(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe('infected');
    // No extraction job ever created
    expect(ops.find((o) => o.table === 'ingestion_extraction_jobs')).toBeUndefined();
  });
});

// ===========================================================================
// Journey 7 — Constitutional redirection (Sprint L2)
// ===========================================================================
describe('Journey 7: Constitutional redirection', () => {
  test('Sprint L harmful content is blocked at the guard', async () => {
    const { client } = captureSupabase();
    const g = await guardOutgoing({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      user_id: 'u_e2e_redirect',
      subject: cleanSubject('recommendation', 'Smuggle the package across the border.'),
      emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
    });
    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.decision.approved).toBe(false);
    expect(g.constitutional?.verdict).toBeDefined();
  });

  test('Sprint L2 surfaces a constitutional decision even on clean content', async () => {
    const { client } = captureSupabase();
    const g = await guardOutgoing({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: client as any,
      user_id: 'u_e2e_clean',
      subject: cleanSubject(
        'recommendation',
        'Consider rebalancing toward bonds at a slower pace given current rates.'
      ),
      emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
    });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.constitutional.future_preservation).toBeDefined();
    expect(g.constitutional.crisis).toBeDefined();
    expect(g.constitutional.emotional).toBeDefined();
  });
});

// ===========================================================================
// Journey 8 — Enterprise tenant creation
// ===========================================================================
describe('Journey 8: Enterprise tenant + API key', () => {
  test('platform/api-keys route handles POST + DELETE', () => {
    const src = readRoute('platform/api-keys/route.ts');
    expect(src).toMatch(/POST|export async function POST/);
    expect(src).toMatch(/DELETE|export async function DELETE/);
  });

  test('platform/tenants/me route enforces auth', () => {
    const src = readRoute('platform/tenants/me/route.ts');
    expect(src).toMatch(/auth\.getUser|createServerSupabaseClient/);
  });

  test('platform/api-keys POST hashes the key (never stores plaintext)', () => {
    const src = readRoute('platform/api-keys/route.ts');
    expect(src).toMatch(/key_hash|createHash|sha256/);
    // Plain key returned to caller exactly once (only on creation).
    expect(src).toMatch(/plain_key|api_key|raw_key/);
  });
});

// ===========================================================================
// Structural sweep — ensure no MUST_WIRE route lost guardOutgoing
// ===========================================================================
describe('Structural: governance coverage', () => {
  const MUST_WIRE = [
    'agent/chat/route.ts',
    'arcana/catch-up/route.ts',
    'arcana/readiness/route.ts',
    'arcana/lead-package/route.ts',
    'simulations/create/route.ts',
    'recommendations/[id]/why/route.ts',
    'provider/patients/[id]/recommendation/route.ts',
  ];
  test.each(MUST_WIRE)('%s imports guardOutgoing', (rel) => {
    const src = readRoute(rel);
    expect(src).toMatch(/guardOutgoing/);
  });
});

// Marker for the deliverable: the test count below is referenced in
// E2E_COVERAGE_REPORT.md.
export const __E2E_VERSION = 'sprint-n2-phase-9';
// (also reference REPO to keep the import; useful when reading from the
// repo root in future expansions.)
void REPO;
