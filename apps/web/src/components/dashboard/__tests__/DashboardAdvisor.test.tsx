import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardAdvisor from '@/components/dashboard/DashboardAdvisor';
import { ADVISOR_WELCOME, ADVISOR_CHAT_ENDPOINT } from '@/lib/chat/advisor';

// Render the typed reveal as plain text so assertions are deterministic.
jest.mock('@/components/ui/StreamingText', () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes(ADVISOR_CHAT_ENDPOINT)) {
      return {
        ok: true,
        json: async () => ({ assistant_message: 'Your career is on track.' }),
      } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;
});

it('opens in advisor mode (advisor welcome, never the onboarding line)', () => {
  render(<DashboardAdvisor />);
  expect(screen.getByText(ADVISOR_WELCOME)).toBeInTheDocument();
  expect(screen.queryByText(/everything I need to start/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/build your life plan/i)).not.toBeInTheDocument();
});

it('sends to the advisor endpoint and renders the grounded reply', async () => {
  render(<DashboardAdvisor />);
  const box = screen.getByPlaceholderText(/Ask your advisor anything/i);
  fireEvent.change(box, { target: { value: 'What do you know about my career?' } });
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });

  await screen.findByText('Your career is on track.');
  const [url] = (global.fetch as jest.Mock).mock.calls[0];
  expect(String(url)).toBe(ADVISOR_CHAT_ENDPOINT);
});
