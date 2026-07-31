/**
 * Reviewer client contract tests (R-3 / B-27).
 *
 * EVIDENCE BOUNDARY: transport MOCKED. Contract evidence, not deployed-browser evidence.
 */
import {
  ALLOWED_TRANSITIONS,
  MAX_PAGE_SIZE,
  REVIEW_STATUSES,
  getReport,
  listReports,
  nextStatuses,
  requiresReason,
  updateReport,
  type ReviewStatus,
} from '../responseReview';

function mockFetch(status: number, body: unknown = {}) {
  return jest.fn().mockResolvedValue({ status, json: async () => body } as unknown as Response);
}

const ROW = {
  report_id: 'r1',
  turn_id: 't1',
  category: 'wrong_or_unsupported',
  severity: 'high',
  review_status: 'new',
  assigned_to: null,
  created_at: '2026-07-31T00:00:00Z',
  deployment_version: 'd1',
  prompt_version: 'p1',
  model_name: 'm1',
  duplicate_of: null,
};

describe('queue', () => {
  it('requests the queue with filters and bounded pagination', async () => {
    const f = mockFetch(200, { reports: [ROW], limit: 25, offset: 0 });
    const out = await listReports(
      { category: 'privacy_concern', severity: 'high' },
      {},
      {
        fetchImpl: f as unknown as typeof fetch,
      }
    );
    expect(out.kind).toBe('ok');
    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('category=privacy_concern');
    expect(url).toContain('severity=high');
    expect(url).toContain('limit=25');
  });

  it('clamps an oversized page request', async () => {
    const f = mockFetch(200, { reports: [] });
    await listReports({}, { limit: 100000 }, { fetchImpl: f as unknown as typeof fetch });
    // Parse the param rather than substring-matching: `limit=100000` CONTAINS `limit=100`, so a
    // toContain assertion passes even when the clamp is removed. Mutation M-5 exposed exactly that.
    const limit = new URL(f.mock.calls[0][0] as string, 'http://x').searchParams.get('limit');
    expect(limit).toBe(String(MAX_PAGE_SIZE));
  });

  it('omits empty filters rather than sending blanks', async () => {
    const f = mockFetch(200, { reports: [] });
    await listReports(
      { category: '', severity: 'low' },
      {},
      {
        fetchImpl: f as unknown as typeof fetch,
      }
    );
    expect(f.mock.calls[0][0]).not.toContain('category=');
  });

  it('queue rows carry NO snapshot or explanation', async () => {
    // The API minimizes; this pins the client's expectation so a widened response is visible.
    const f = mockFetch(200, { reports: [ROW] });
    const out = await listReports({}, {}, { fetchImpl: f as unknown as typeof fetch });
    if (out.kind !== 'ok') throw new Error('expected ok');
    for (const forbidden of ['question_snapshot', 'response_snapshot', 'explanation']) {
      expect(out.data.reports[0]).not.toHaveProperty(forbidden);
    }
  });
});

describe('authorization surfacing', () => {
  it('403 becomes forbidden — NEVER an empty queue', async () => {
    // Collapsing a denial into "no reports" would hide an authorization failure behind a plausible
    // empty state, which is exactly how a broken gate goes unnoticed.
    const out = await listReports(
      {},
      {},
      {
        fetchImpl: mockFetch(403) as unknown as typeof fetch,
      }
    );
    expect(out.kind).toBe('forbidden');
    expect(out).not.toHaveProperty('data');
  });

  it('401 also becomes forbidden', async () => {
    const out = await listReports(
      {},
      {},
      {
        fetchImpl: mockFetch(401) as unknown as typeof fetch,
      }
    );
    expect(out.kind).toBe('forbidden');
  });

  it('network failure is distinct from denial', async () => {
    const f = jest.fn().mockRejectedValue(new Error('offline'));
    const out = await listReports({}, {}, { fetchImpl: f as unknown as typeof fetch });
    expect(out.kind).toBe('network_error');
  });
});

describe('detail', () => {
  it('fetches one report and its audit history', async () => {
    const f = mockFetch(200, { report: { ...ROW, question_snapshot: 'Q' }, audit_history: [] });
    const out = await getReport('r1', { fetchImpl: f as unknown as typeof fetch });
    expect(out.kind).toBe('ok');
    expect(f.mock.calls[0][0]).toContain('/api/admin/response-reports/r1');
  });

  it('404 becomes not_found', async () => {
    const out = await getReport('nope', { fetchImpl: mockFetch(404) as unknown as typeof fetch });
    expect(out.kind).toBe('not_found');
  });
});

describe('update contract', () => {
  it('sends only the six permitted fields', async () => {
    const f = mockFetch(200, { report_id: 'r1', updated: ['severity'], events: 1 });
    await updateReport(
      'r1',
      { severity: 'critical', note: 'looks systemic' },
      { fetchImpl: f as unknown as typeof fetch }
    );
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(['note', 'severity']);
  });

  it('NEVER forwards evidence or identity fields', async () => {
    const f = mockFetch(200, {});
    const hostile = {
      severity: 'high',
      question_snapshot: 'FORGED',
      response_snapshot: 'FORGED',
      turn_id: 'FORGED',
      user_id: 'FORGED',
      tenant_id: 'FORGED',
      category: 'FORGED',
      created_at: 'FORGED',
    } as never;
    await updateReport('r1', hostile, { fetchImpl: f as unknown as typeof fetch });
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(Object.keys(body)).toEqual(['severity']);
    expect(JSON.stringify(body)).not.toContain('FORGED');
  });

  it('server rejection surfaces its reason', async () => {
    const out = await updateReport(
      'r1',
      { review_status: 'resolved' },
      {
        fetchImpl: mockFetch(400, {
          detail: 'transition new -> resolved is not permitted',
        }) as unknown as typeof fetch,
      }
    );
    expect(out).toEqual({
      kind: 'rejected',
      message: 'transition new -> resolved is not permitted',
    });
  });

  it('exposes NO method for deleting or editing evidence', async () => {
    const mod = await import('../responseReview');
    const names = Object.keys(mod).filter((k) => typeof (mod as never)[k] === 'function');
    for (const forbidden of ['delete', 'remove', 'purge', 'editEvidence', 'setFlag', 'suspend']) {
      expect(names.some((n) => n.toLowerCase().includes(forbidden.toLowerCase()))).toBe(false);
    }
    expect(names.sort()).toEqual([
      'getReport',
      'listReports',
      'nextStatuses',
      'requiresReason',
      'updateReport',
    ]);
  });
});

describe('transition rules mirror the server', () => {
  it.each(REVIEW_STATUSES)('nextStatuses(%s) never includes itself', (s) => {
    expect(nextStatuses(s as ReviewStatus)).not.toContain(s);
  });

  it('new cannot jump straight to resolved', () => {
    expect(nextStatuses('new')).not.toContain('resolved');
  });

  it('terminal states require a reason to reopen', () => {
    expect(requiresReason('resolved')).toBe(true);
    expect(requiresReason('dismissed')).toBe(true);
    expect(requiresReason('duplicate')).toBe(true);
    expect(requiresReason('new')).toBe(false);
  });

  it('every transition target is a known status', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const t of targets) expect(REVIEW_STATUSES).toContain(t);
    }
  });
});
