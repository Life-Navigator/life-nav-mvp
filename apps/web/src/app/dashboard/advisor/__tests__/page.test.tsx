import React from 'react';
import { render, screen } from '@testing-library/react';
import AdvisorPage from '@/app/dashboard/advisor/page';

// Mock the heavy children so the test isolates the MODE-ROUTING decision (the actual fix), not their
// internals. The discovery (OnboardingAdvisor) child lives in the page file itself, so we identify it
// indirectly: when onboarding is complete + no ?onboarding=1, the page must render the Command Center.
jest.mock('@/components/chat/CommandCenter', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-advisor">advisor mode</div>,
}));

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/api/onboarding/status')) {
      return { ok: true, json: async () => ({ onboarding_completed: true }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;
});

it('routes a completed user (no onboarding flag) to the advisor-mode dashboard chat', async () => {
  render(<AdvisorPage />);
  // It checks completion via /api/onboarding/status before committing to a mode.
  expect(await screen.findByTestId('dashboard-advisor')).toBeInTheDocument();
  const calledStatus = (global.fetch as jest.Mock).mock.calls.some(([u]) =>
    String(u).includes('/api/onboarding/status')
  );
  expect(calledStatus).toBe(true);
});
