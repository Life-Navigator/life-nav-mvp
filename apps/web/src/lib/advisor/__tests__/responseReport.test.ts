/**
 * Advisor-response reporting client — contract tests (R-3 / B-22, slice 3A).
 *
 * EVIDENCE BOUNDARY: transport is MOCKED. These are component/contract evidence, NOT
 * deployed-browser evidence. They prove the request shape, the trust boundary and outcome mapping.
 * They prove nothing about the deployed system.
 */
import {
  MAX_EXPLANATION_LENGTH,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  RESPONSE_REPORT_ENDPOINT,
  isRetryable,
  submitResponseReport,
  type ReportCategory,
} from '../responseReport';

const TURN = 'server-issued-turn-0001';

function mockFetch(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return jest.fn().mockResolvedValue({
    status,
    json: async () => body,
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as Response);
}

function sentBody(fetchImpl: jest.Mock): Record<string, unknown> {
  return JSON.parse(fetchImpl.mock.calls[0][1].body as string);
}

describe('request contract', () => {
  it('sends exactly turn_id and category when no explanation is given', async () => {
    const f = mockFetch(201, { report_id: 'rep-1', duplicate: false });
    await submitResponseReport({ turn_id: TURN, category: 'other' }, { fetchImpl: f });
    expect(Object.keys(sentBody(f)).sort()).toEqual(['category', 'turn_id']);
    expect(f.mock.calls[0][0]).toBe(RESPONSE_REPORT_ENDPOINT);
  });

  it('includes explanation only when non-empty, and trims it', async () => {
    const f = mockFetch(201, { report_id: 'rep-1' });
    await submitResponseReport(
      { turn_id: TURN, category: 'other', explanation: '  the number is wrong  ' },
      { fetchImpl: f }
    );
    expect(sentBody(f)).toEqual({
      turn_id: TURN,
      category: 'other',
      explanation: 'the number is wrong',
    });
  });

  it('whitespace-only explanation is omitted, not sent as empty', async () => {
    const f = mockFetch(201, { report_id: 'rep-1' });
    await submitResponseReport(
      { turn_id: TURN, category: 'other', explanation: '   ' },
      { fetchImpl: f }
    );
    expect(sentBody(f)).not.toHaveProperty('explanation');
  });

  it('NEVER forwards caller-supplied identity or execution metadata', async () => {
    // The trust boundary. A spread would let any of these reach the wire; the client builds the
    // body field-by-field precisely so they cannot.
    const f = mockFetch(201, { report_id: 'rep-1' });
    const hostile = {
      turn_id: TURN,
      category: 'other' as ReportCategory,
      tenant_id: 'attacker-tenant',
      user_id: 'attacker-user',
      model: 'forged-model',
      prompt_version: 'forged-prompt',
      deployment_version: 'forged-deploy',
      routing_result: { forged: true },
      policy_outcomes: { forged: true },
      feature_flags: { forged: true },
      citations: ['forged'],
      severity: 'critical',
      review_status: 'resolved',
    };
    await submitResponseReport(hostile, { fetchImpl: f });
    const body = sentBody(f);
    expect(Object.keys(body).sort()).toEqual(['category', 'turn_id']);
    for (const forbidden of [
      'tenant_id',
      'user_id',
      'model',
      'prompt_version',
      'deployment_version',
      'routing_result',
      'policy_outcomes',
      'feature_flags',
      'citations',
      'severity',
      'review_status',
    ]) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(body)).not.toContain('attacker');
    expect(JSON.stringify(body)).not.toContain('forged');
  });

  it('does not generate a turn_id when one is missing', async () => {
    const f = mockFetch(201);
    const out = await submitResponseReport({ turn_id: '', category: 'other' }, { fetchImpl: f });
    expect(out.kind).toBe('invalid');
    expect(f).not.toHaveBeenCalled(); // nothing invented, nothing sent
  });
});

describe('categories', () => {
  it('exposes exactly the seven audit categories', () => {
    expect([...REPORT_CATEGORIES]).toEqual([
      'wrong_or_unsupported',
      'inappropriate_or_harmful',
      'incorrect_or_irrelevant_citation',
      'outdated_information',
      'misunderstood_my_situation',
      'privacy_concern',
      'other',
    ]);
  });

  it.each(REPORT_CATEGORIES)('submits category %s', async (category) => {
    const f = mockFetch(201, { report_id: `rep-${category}` });
    const out = await submitResponseReport({ turn_id: TURN, category }, { fetchImpl: f });
    expect(out).toEqual({ kind: 'submitted', reportId: `rep-${category}` });
    expect(sentBody(f).category).toBe(category);
  });

  it('every category has a human label', () => {
    for (const c of REPORT_CATEGORIES) {
      expect(REPORT_CATEGORY_LABELS[c]).toBeTruthy();
    }
  });

  it('rejects an unknown category without calling the API', async () => {
    const f = mockFetch(201);
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'not_a_category' as ReportCategory },
      { fetchImpl: f }
    );
    expect(out.kind).toBe('invalid');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('rejects an over-long explanation client-side', async () => {
    const f = mockFetch(201);
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other', explanation: 'x'.repeat(MAX_EXPLANATION_LENGTH + 1) },
      { fetchImpl: f }
    );
    expect(out.kind).toBe('invalid');
    expect(f).not.toHaveBeenCalled();
  });

  it('accepts an explanation exactly at the limit', async () => {
    const f = mockFetch(201, { report_id: 'rep-1' });
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other', explanation: 'x'.repeat(MAX_EXPLANATION_LENGTH) },
      { fetchImpl: f }
    );
    expect(out.kind).toBe('submitted');
  });
});

describe('outcome mapping', () => {
  it('201 -> submitted with report id', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(201, { report_id: 'rep-9', duplicate: false }) }
    );
    expect(out).toEqual({ kind: 'submitted', reportId: 'rep-9' });
  });

  it('duplicate flag -> duplicate, carrying the existing report id', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(201, { report_id: 'rep-1', duplicate: true }) }
    );
    expect(out).toEqual({ kind: 'duplicate', reportId: 'rep-1' });
  });

  it('401 -> session_expired', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(401) }
    );
    expect(out.kind).toBe('session_expired');
  });

  it('404 -> unavailable (absent OR not yours — indistinguishable by design)', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(404) }
    );
    expect(out.kind).toBe('unavailable');
  });

  it('429 -> rate_limited with Retry-After when present', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(429, {}, { 'Retry-After': '30' }) }
    );
    expect(out).toEqual({ kind: 'rate_limited', retryAfterSeconds: 30 });
  });

  it('400 -> invalid, surfacing the server detail', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(400, { detail: 'invalid category' }) }
    );
    expect(out).toEqual({ kind: 'invalid', message: 'invalid category' });
  });

  it('500 -> server_error carrying the status', async () => {
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: mockFetch(503) }
    );
    expect(out).toEqual({ kind: 'server_error', status: 503 });
  });

  it('thrown fetch -> network_error, never an unhandled rejection', async () => {
    const f = jest.fn().mockRejectedValue(new Error('offline'));
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: f as unknown as typeof fetch }
    );
    expect(out.kind).toBe('network_error');
  });

  it('malformed success payload still resolves, with an empty report id', async () => {
    const f = jest.fn().mockResolvedValue({
      status: 201,
      json: async () => {
        throw new Error('not json');
      },
      headers: { get: () => null },
    } as unknown as Response);
    const out = await submitResponseReport(
      { turn_id: TURN, category: 'other' },
      { fetchImpl: f as unknown as typeof fetch }
    );
    expect(out).toEqual({ kind: 'submitted', reportId: '' });
  });
});

describe('retryability', () => {
  it('network, server and rate-limit failures are retryable; rejections are not', () => {
    expect(isRetryable({ kind: 'network_error' })).toBe(true);
    expect(isRetryable({ kind: 'server_error', status: 500 })).toBe(true);
    expect(isRetryable({ kind: 'rate_limited' })).toBe(true);
    expect(isRetryable({ kind: 'session_expired' })).toBe(false);
    expect(isRetryable({ kind: 'unavailable' })).toBe(false);
    expect(isRetryable({ kind: 'invalid', message: 'x' })).toBe(false);
    expect(isRetryable({ kind: 'submitted', reportId: 'r' })).toBe(false);
  });
});
