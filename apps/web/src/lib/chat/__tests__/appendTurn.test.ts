/** @jest-environment node */
// Chat continuity: the USER message must persist even when the advisor returns nothing, so old threads are
// never empty and can be reopened. The assistant row is added only when there's real text (no blank bubble).
let inserted: Record<string, unknown>[][] = [];
const updateEq = jest.fn().mockReturnThis();
const fakeClient = {
  from: (_t: string) => ({
    insert: (rows: Record<string, unknown>[]) => {
      inserted.push(rows);
      return Promise.resolve({ error: null });
    },
    update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  }),
};
jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => fakeClient,
}));

import { appendTurn } from '../store';

beforeEach(() => {
  inserted = [];
});

describe('appendTurn (thread continuity)', () => {
  it('persists BOTH rows on a normal turn', async () => {
    await appendTurn('user-1', 'thread-1', {
      userMessage: 'Should I refinance?',
      assistantMessage: 'Here is my analysis…',
      agent: 'finance',
    });
    const rows = inserted[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      role: 'user',
      content: 'Should I refinance?',
      user_id: 'user-1',
    });
    expect(rows[1]).toMatchObject({ role: 'assistant', agent: 'finance' });
  });

  it('persists the USER row even when the advisor returned nothing (empty assistant)', async () => {
    await appendTurn('user-1', 'thread-1', {
      userMessage: 'Hello?',
      assistantMessage: '', // failed / empty advisor turn
    });
    const rows = inserted[0];
    expect(rows).toHaveLength(1); // no blank assistant bubble
    expect(rows[0]).toMatchObject({ role: 'user', content: 'Hello?' });
  });

  it('treats whitespace-only assistant text as empty', async () => {
    await appendTurn('user-1', 'thread-1', { userMessage: 'Hi', assistantMessage: '   \n ' });
    expect(inserted[0]).toHaveLength(1);
  });
});
