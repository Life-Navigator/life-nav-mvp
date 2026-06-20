import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { ADVISOR_WELCOME, ADVISOR_CHAT_ENDPOINT } from '@/lib/chat/advisor';

// Route fetch by URL: onboarding status + advisor chat. Default: onboarding complete, advisor replies.
function mockFetch(opts?: { advisorOk?: boolean; reply?: string; onboardingComplete?: boolean }) {
  const {
    advisorOk = true,
    reply = 'Here is your grounded answer.',
    onboardingComplete = true,
  } = opts ?? {};
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/api/onboarding/status')) {
      return { ok: true, json: async () => ({ onboarding_completed: onboardingComplete }) } as any;
    }
    if (String(url).includes(ADVISOR_CHAT_ENDPOINT)) {
      if (!advisorOk) return { ok: false, status: 500, json: async () => ({}) } as any;
      return { ok: true, json: async () => ({ assistant_message: reply }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;
}

async function open() {
  fireEvent.click(screen.getByLabelText('Toggle Advisor'));
  await screen.findByText(ADVISOR_WELCOME);
}

beforeEach(() => mockFetch());

it('opens to an advisor-mode welcome (never the onboarding line)', async () => {
  render(<ChatSidebar />);
  await open();
  expect(screen.getByText(ADVISOR_WELCOME)).toBeInTheDocument();
  expect(screen.queryByText(/everything I need to start/i)).not.toBeInTheDocument();
});

it('is NOT a dead shell — send works without any legacy agentId', async () => {
  render(<ChatSidebar />);
  await open();
  const box = screen.getByPlaceholderText('Ask your advisor…') as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: 'What should I work on next?' } });
  expect(box.value).toBe('What should I work on next?');
  fireEvent.click(screen.getByTitle('Send message'));

  await screen.findByText('Here is your grounded answer.');
  const calledAdvisor = (global.fetch as jest.Mock).mock.calls.some(([u]) =>
    String(u).includes(ADVISOR_CHAT_ENDPOINT)
  );
  expect(calledAdvisor).toBe(true);
});

it('Enter key fires the advisor request', async () => {
  render(<ChatSidebar />);
  await open();
  const box = screen.getByPlaceholderText('Ask your advisor…');
  fireEvent.change(box, { target: { value: 'Why did my readiness change?' } });
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });
  await screen.findByText('Here is your grounded answer.');
});

it('renders a safe error (and stays in advisor mode) when the advisor call fails', async () => {
  mockFetch({ advisorOk: false });
  render(<ChatSidebar />);
  await open();
  fireEvent.change(screen.getByPlaceholderText('Ask your advisor…'), {
    target: { value: 'hi' },
  });
  fireEvent.click(screen.getByTitle('Send message'));
  expect(await screen.findByText(/having trouble loading advisor mode/i)).toBeInTheDocument();
  expect(screen.queryByText(/everything I need to start/i)).not.toBeInTheDocument();
});

it('shows a finish-setup state (not a dead chat) when onboarding is incomplete', async () => {
  mockFetch({ onboardingComplete: false });
  render(<ChatSidebar />);
  fireEvent.click(screen.getByLabelText('Toggle Advisor'));
  expect(await screen.findByText(/finish your setup/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByPlaceholderText('Finish setup to chat…')).toBeDisabled());
});
