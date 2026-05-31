/**
 * @jest-environment node
 *
 * Smoke tests for /api/onboarding/sections route handlers. Validates the
 * known section list and the shape of the GET materialization.
 */
import { GET, PUT, SECTIONS } from '../route';

type MaybeRow = { section: string; status: string; updated_at?: string };

function makeRequest(body?: unknown) {
  return {
    json: async () => body ?? {},
  } as unknown as Request;
}

function mockSupabase(rows: MaybeRow[] = []) {
  // Chain: from('user_onboarding_sections').select(...).eq('user_id', id)
  const eqSpy = jest.fn().mockResolvedValue({ data: rows, error: null });
  const selectSpy = jest.fn().mockReturnValue({ eq: eqSpy });
  const upsertSpy = jest.fn().mockResolvedValue({ data: null, error: null });
  const fromSpy = jest.fn().mockReturnValue({
    select: selectSpy,
    upsert: upsertSpy,
  });
  return {
    client: {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'u@example.com' } },
        }),
      },
      from: fromSpy,
    },
    upsertSpy,
  };
}

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@/lib/supabase/server');

describe('GET /api/onboarding/sections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a complete checklist even when no rows exist', async () => {
    const { client } = mockSupabase([]);
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(client);

    const res = await GET();
    const json = await (res as Response).json();

    expect(Array.isArray(json.sections)).toBe(true);
    expect(json.sections).toHaveLength(SECTIONS.length);
    for (const s of json.sections) {
      expect(SECTIONS).toContain(s.section);
      expect(s.status).toBe('not_started');
    }
  });

  it('reflects rows when present', async () => {
    const { client } = mockSupabase([
      { section: 'financial', status: 'completed', updated_at: '2026-01-01T00:00:00Z' },
      { section: 'career', status: 'in_progress', updated_at: '2026-01-02T00:00:00Z' },
    ]);
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(client);

    const res = await GET();
    const json = await (res as Response).json();

    const fin = json.sections.find((s: any) => s.section === 'financial');
    const car = json.sections.find((s: any) => s.section === 'career');
    const fam = json.sections.find((s: any) => s.section === 'family_lifestyle');
    expect(fin.status).toBe('completed');
    expect(car.status).toBe('in_progress');
    expect(fam.status).toBe('not_started');
  });
});

describe('PUT /api/onboarding/sections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an unknown section name', async () => {
    const { client } = mockSupabase();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(client);

    const res = await PUT(makeRequest({ section: 'nope', status: 'completed' }) as any);
    expect((res as Response).status).toBe(400);
  });

  it('rejects an unknown status', async () => {
    const { client } = mockSupabase();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(client);

    const res = await PUT(makeRequest({ section: 'financial', status: 'something-else' }) as any);
    expect((res as Response).status).toBe(400);
  });

  it('upserts with the right shape for a completed section', async () => {
    const { client, upsertSpy } = mockSupabase();
    (createServerSupabaseClient as jest.Mock).mockResolvedValue(client);

    const res = await PUT(
      makeRequest({
        section: 'financial',
        status: 'completed',
        fields_captured: { debt_count: 2 },
      }) as any
    );
    expect((res as Response).status).toBe(200);
    expect(upsertSpy).toHaveBeenCalled();
    const args = upsertSpy.mock.calls[0];
    const row = args[0];
    expect(row.user_id).toBe('user-1');
    expect(row.section).toBe('financial');
    expect(row.status).toBe('completed');
    expect(row.fields_captured).toEqual({ debt_count: 2 });
    expect(typeof row.completed_at).toBe('string');
  });
});
