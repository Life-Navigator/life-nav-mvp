/** @jest-environment node */
// Chat continuity: the USER message is persisted immediately (before the fallible advisor call), so an old
// thread is never empty and is always reopenable. The assistant row is added only when there's real text.
let inserted: Record<string, unknown>[][] = [];
const fakeClient = {
  from: (_t: string) => ({
    insert: (rows: Record<string, unknown>[]) => {
      inserted.push(rows);
      return Promise.resolve({ error: null });
    },
    update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  }),
};
jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => fakeClient }));

import { appendUserMessage, appendAssistantMessage, appendTurn } from '../store';

beforeEach(() => {
  inserted = [];
});

describe('chat persistence (thread continuity)', () => {
  it('appendUserMessage always persists the user row (saved before the advisor call)', async () => {
    await appendUserMessage('user-1', 'thread-1', 'What should my emergency fund be?');
    expect(inserted).toHaveLength(1);
    expect(inserted[0][0]).toMatchObject({
      role: 'user',
      content: 'What should my emergency fund be?',
      user_id: 'user-1',
      conversation_id: 'thread-1',
    });
  });

  it('appendAssistantMessage persists real assistant text', async () => {
    await appendAssistantMessage('user-1', 'thread-1', {
      content: 'Here is my analysis…',
      agent: 'finance',
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0][0]).toMatchObject({ role: 'assistant', agent: 'finance' });
  });

  it('appendAssistantMessage is a NO-OP on empty/whitespace (no blank bubble on a failed turn)', async () => {
    await appendAssistantMessage('user-1', 'thread-1', { content: '' });
    await appendAssistantMessage('user-1', 'thread-1', { content: '   \n ' });
    expect(inserted).toHaveLength(0);
  });

  it('appendTurn persists user + assistant; user survives even when assistant is empty', async () => {
    await appendTurn('u', 't', { userMessage: 'Hi', assistantMessage: 'Hello!' });
    expect(inserted.flat().map((r) => r.role)).toEqual(['user', 'assistant']);
    inserted = [];
    await appendTurn('u', 't', { userMessage: 'Anyone?', assistantMessage: '' });
    expect(inserted.flat().map((r) => r.role)).toEqual(['user']); // user saved, no empty assistant
  });
});
