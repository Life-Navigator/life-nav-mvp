/** @jest-environment node */
// Advisor reliability: user message persists before the call; timeouts/errors degrade gracefully (never a hard
// throw, always thread continuable); one bounded retry for a FAST transient failure; no duplicate user message.
const appendUser = jest.fn().mockResolvedValue(undefined);
const appendAssistant = jest.fn().mockResolvedValue(undefined);
jest.mock('../store', () => ({
  appendUserMessage: (...a: unknown[]) => appendUser(...a),
  appendAssistantMessage: (...a: unknown[]) => appendAssistant(...a),
}));
jest.mock('@/app/api/life/_helper', () => ({ CORE_API: 'http://core', token: async () => 'tok' }));

import { sendAdvisorTurn } from '../send-server';

const okResp = (body: unknown) => ({ status: 200, json: async () => body });
const args = {
  userId: 'u1',
  threadId: 'th1',
  message: 'What should my emergency fund be?',
  agent: 'finance',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('advisor turn reliability', () => {
  it('persists the USER message before the advisor call, and the assistant on success', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(okResp({ assistant_message: 'Aim for 3–6 months.' }));
    const res = await sendAdvisorTurn(args);
    expect(appendUser).toHaveBeenCalledWith('u1', 'th1', args.message);
    expect(res.degraded).toBe(false);
    expect(res.assistant_message).toBe('Aim for 3–6 months.');
    expect(appendAssistant).toHaveBeenCalledTimes(1);
  });

  it('a timeout (AbortError) degrades: degraded=true, no assistant persisted, user message still saved', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    (global as any).fetch = jest.fn().mockRejectedValue(abort);
    const res = await sendAdvisorTurn(args);
    expect(appendUser).toHaveBeenCalledTimes(1); // user msg persisted regardless
    expect(res.degraded).toBe(true);
    expect(res.status).toBe(504);
    // send-server calls appendAssistantMessage with '' — the store no-ops on empty (see appendTurn.test),
    // so no blank assistant row is written. Here we assert the empty content was passed through.
    expect(appendAssistant).toHaveBeenCalledWith(
      'u1',
      'th1',
      expect.objectContaining({ content: '' })
    );
  });

  it('does NOT retry a timeout (retrying a slow turn just hangs again)', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const f = jest.fn().mockRejectedValue(abort);
    (global as any).fetch = f;
    await sendAdvisorTurn(args);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries ONCE on a fast transient 5xx, without duplicating the user message', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce({ status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(okResp({ assistant_message: 'Recovered answer.' }));
    (global as any).fetch = f;
    const res = await sendAdvisorTurn(args);
    expect(f).toHaveBeenCalledTimes(2); // one retry
    expect(appendUser).toHaveBeenCalledTimes(1); // user message NOT duplicated on retry
    expect(res.assistant_message).toBe('Recovered answer.');
    expect(res.degraded).toBe(false);
  });
});
