import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommandCenter from '@/components/chat/CommandCenter';
import { ADVISOR_WELCOME } from '@/lib/chat/advisor';

jest.mock('@/components/ui/StreamingText', () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

interface FetchOpts {
  onboardingComplete?: boolean;
  threads?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  send?: Record<string, unknown>;
}

function mockFetch(opts: FetchOpts = {}) {
  const {
    onboardingComplete = true,
    threads = [],
    messages = [],
    send = {
      assistant_message: 'Here is your grounded answer.',
      agent: 'relationship_manager',
      citations: [],
      thread_id: 't-new',
    },
  } = opts;
  const sendSpy = jest.fn();
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as any;
    if (u.includes('/api/onboarding/status'))
      return ok({ onboarding_completed: onboardingComplete });
    if (u.includes('/api/chat/agents')) return ok({ agents: [] }); // → falls back to static roster
    if (u.includes('/api/chat/projects')) return ok({ projects: [] });
    if (u.includes('/api/chat/threads/') && u.includes('/messages')) return ok({ messages });
    if (u.includes('/api/chat/threads')) return ok({ threads });
    if (u.includes('/api/chat/advisor')) {
      sendSpy(JSON.parse(String(init?.body || '{}')));
      return ok(send);
    }
    return ok({});
  }) as any;
  return { sendSpy };
}

it('opens in advisor mode with the advisor welcome (never the onboarding line)', async () => {
  mockFetch();
  render(<CommandCenter />);
  expect(await screen.findByText(ADVISOR_WELCOME)).toBeInTheDocument();
  expect(screen.queryByText(/everything I need to start/i)).not.toBeInTheDocument();
});

it('sends through advisor mode with the selected agent and renders the grounded reply', async () => {
  const { sendSpy } = mockFetch();
  render(<CommandCenter />);
  await screen.findByText(ADVISOR_WELCOME);

  // Select a direct agent.
  fireEvent.change(screen.getByLabelText('Select agent'), { target: { value: 'career_advisor' } });

  const box = screen.getByPlaceholderText('Ask your advisor…');
  fireEvent.change(box, { target: { value: 'Am I ready for a promotion?' } });
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });

  expect(await screen.findByText('Here is your grounded answer.')).toBeInTheDocument();
  expect(sendSpy).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Am I ready for a promotion?', agent: 'career_advisor' })
  );
});

it('renders citations from a grounded answer', async () => {
  mockFetch({
    send: {
      assistant_message: 'Your degree is from Stanford.',
      agent: 'education_advisor',
      citations: [
        {
          kind: 'fact',
          domain: 'education',
          label: 'Degree',
          value: "Master's from Stanford",
          sourceTable: 'public.education_records',
          confidence: 0.95,
        },
      ],
      thread_id: 't1',
    },
  });
  render(<CommandCenter />);
  await screen.findByText(ADVISOR_WELCOME);
  const box = screen.getByPlaceholderText('Ask your advisor…');
  fireEvent.change(box, { target: { value: 'What degree do I have?' } });
  fireEvent.keyDown(box, { key: 'Enter' });
  await screen.findByText('Your degree is from Stanford.');
  fireEvent.click(screen.getByText('Sources (1)'));
  expect(await screen.findByText(/Grounded sources/i)).toBeInTheDocument();
  expect(screen.getByText(/public.education_records/)).toBeInTheDocument();
});

it('continues an old chat from the sidebar', async () => {
  mockFetch({
    threads: [
      {
        id: 't-old',
        title: 'MBA thoughts',
        mode: 'advisor',
        selected_agent: 'education_advisor',
        last_message_at: '2026-06-20',
        message_count: 2,
      },
    ],
    messages: [
      { id: 'm1', role: 'user', content: 'Should I get an MBA?', agent: null, citations: [] },
      {
        id: 'm2',
        role: 'assistant',
        content: 'It depends on your goals.',
        agent: 'education_advisor',
        citations: [],
      },
    ],
  });
  render(<CommandCenter />);
  const thread = await screen.findByText('MBA thoughts');
  fireEvent.click(thread);
  expect(await screen.findByText('It depends on your goals.')).toBeInTheDocument();
});

it('shows a finish-setup state and disables input when onboarding is incomplete', async () => {
  mockFetch({ onboardingComplete: false });
  render(<CommandCenter />);
  expect(await screen.findByText(/finish your setup/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByPlaceholderText('Finish setup to chat…')).toBeDisabled());
});
