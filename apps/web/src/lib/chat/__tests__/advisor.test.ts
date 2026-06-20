import {
  ADVISOR_CHAT_ENDPOINT,
  ADVISOR_WELCOME,
  ADVISOR_INCOMPLETE_ONBOARDING,
  sendAdvisorMessage,
} from '@/lib/chat/advisor';

beforeEach(() => {
  global.fetch = jest.fn();
});

it('posts to the advisor endpoint with message + conversation id', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ assistant_message: 'Your readiness is grounded in real data.' }),
  });

  const turn = await sendAdvisorMessage('What should I do next?', 'conv-1');

  expect(turn.assistant_message).toContain('grounded');
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe(ADVISOR_CHAT_ENDPOINT);
  const sent = JSON.parse(init.body);
  expect(sent).toEqual({ message: 'What should I do next?', conversation_id: 'conv-1' });
});

it('throws on a non-ok response so callers can render the safe error', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
  await expect(sendAdvisorMessage('hi', 'c')).rejects.toThrow();
});

it('never ships the onboarding completion line in advisor copy', () => {
  for (const copy of [ADVISOR_WELCOME, ADVISOR_INCOMPLETE_ONBOARDING]) {
    expect(copy).not.toMatch(/everything I need to start/i);
    expect(copy).not.toMatch(/build your life plan/i);
  }
});
