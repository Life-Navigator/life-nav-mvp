/** @jest-environment jsdom */

/**
 * Tests for the Pilot Analytics Dashboard page states:
 *  - renders gate metrics from a mocked payload and computes pass/fail correctly
 *  - honest top-level empty state when total_feedback_rows = 0 (no fabricated numbers/passes)
 *  - per-metric "No responses yet" when a metric has no responses
 *  - admin-only state when the proxy returns 403
 *  - error state on a non-403 failure
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import PilotAnalyticsPage from '../page';

function mockFetch(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => jest.clearAllMocks());

const FULL_PAYLOAD = {
  advisor: { total_turns: 100, enhanced_turns: 80, enhanced_rate: 0.8 },
  safety: { safety_fallback_turns: 3 },
  feedback: { nps_score: 60, nps_responses: 10 },
  instruments: {
    averages: {
      narrative_accuracy: 9.0, // > 8.5 → PASS
      trust: 7.5, // !> 8.0 → BELOW GATE
      recommendation_quality: 8.5, // > 8.0 → PASS
      return_intent: 8.2, // > 8.0 → PASS
      understanding: 7.0,
      personalization: 8.0,
      usefulness: 9.1,
      actionability: 6.5,
      would_pay: 7.7,
      recommend_to_clients: 8.8,
      solves_problem: 9.2,
    },
    response_counts: {
      narrative_accuracy: 12,
      trust: 12,
      recommendation_quality: 11,
      return_intent: 10,
      understanding: 12,
      personalization: 12,
      usefulness: 12,
      actionability: 12,
      would_pay: 9,
      recommend_to_clients: 9,
      solves_problem: 9,
    },
    insight_rate: 0.75, // > 70% → PASS
    insight_responses: 12,
    holy_shit_rate: 0.4, // !> 50% → BELOW GATE
    holy_shit_responses: 12,
    total_feedback_rows: 12,
  },
};

it('renders gate metrics and computes pass/fail correctly', async () => {
  mockFetch(FULL_PAYLOAD);
  render(<PilotAnalyticsPage />);

  await waitFor(() => expect(screen.getByTestId('pilot-total-rows')).toBeInTheDocument());

  // Narrative Accuracy 9.0 > 8.5 → PASS
  const narrative = screen.getByTestId('gate-Narrative Accuracy');
  expect(within(narrative).getByText('9.0')).toBeInTheDocument();
  expect(within(narrative).getByText('PASS')).toBeInTheDocument();

  // Trust 7.5 is NOT > 8.0 → BELOW GATE
  const trust = screen.getByTestId('gate-Trust');
  expect(within(trust).getByText('7.5')).toBeInTheDocument();
  expect(within(trust).getByText('BELOW GATE')).toBeInTheDocument();

  // NPS 60 > 50 → PASS
  const nps = screen.getByTestId('gate-Net Promoter Score');
  expect(within(nps).getByText('60')).toBeInTheDocument();
  expect(within(nps).getByText('PASS')).toBeInTheDocument();

  // Insight rate 75% > 70% → PASS
  const insight = screen.getByTestId('gate-Insight Rate');
  expect(within(insight).getByText('75%')).toBeInTheDocument();
  expect(within(insight).getByText('PASS')).toBeInTheDocument();

  // Holy-Shit rate 40% NOT > 50% → BELOW GATE
  const holy = screen.getByTestId('gate-Holy-Shit Rate');
  expect(within(holy).getByText('40%')).toBeInTheDocument();
  expect(within(holy).getByText('BELOW GATE')).toBeInTheDocument();

  // Advisor enhanced + safety telemetry
  expect(within(screen.getByTestId('advisor-enhanced')).getByText('80%')).toBeInTheDocument();
  expect(within(screen.getByTestId('safety-fallback')).getByText('3')).toBeInTheDocument();
});

it('shows the honest empty state when total_feedback_rows is 0', async () => {
  mockFetch({
    advisor: { total_turns: 0, enhanced_rate: null },
    safety: { safety_fallback_turns: 0 },
    feedback: {},
    instruments: { total_feedback_rows: 0 },
  });
  render(<PilotAnalyticsPage />);

  await waitFor(() => expect(screen.getByTestId('pilot-empty')).toBeInTheDocument());
  expect(
    within(screen.getByTestId('pilot-empty')).getByText('No responses yet')
  ).toBeInTheDocument();

  // No gate may claim a PASS when there is no data.
  expect(screen.queryByText('PASS')).not.toBeInTheDocument();
  // Each gate shows the per-metric empty state, never a fabricated number.
  const narrative = screen.getByTestId('gate-Narrative Accuracy');
  expect(within(narrative).getByText('No responses yet')).toBeInTheDocument();
});

it('shows per-metric "No responses yet" when a metric has no responses but others do', async () => {
  mockFetch({
    instruments: {
      averages: { trust: 8.5 },
      response_counts: { trust: 5 }, // narrative_accuracy has no count
      total_feedback_rows: 5,
    },
  });
  render(<PilotAnalyticsPage />);

  await waitFor(() => expect(screen.getByTestId('gate-Trust')).toBeInTheDocument());
  const trust = screen.getByTestId('gate-Trust');
  expect(within(trust).getByText('8.5')).toBeInTheDocument();
  expect(within(trust).getByText('PASS')).toBeInTheDocument();

  const narrative = screen.getByTestId('gate-Narrative Accuracy');
  expect(within(narrative).getByText('No responses yet')).toBeInTheDocument();
});

it('shows the admin-only state on a 403 from the proxy', async () => {
  mockFetch({ detail: 'Admin access required' }, 403);
  render(<PilotAnalyticsPage />);

  await waitFor(() => expect(screen.getByTestId('pilot-forbidden')).toBeInTheDocument());
  expect(screen.getByText('Admin only')).toBeInTheDocument();
});

it('shows an error state on a non-403 failure', async () => {
  mockFetch({ error: 'boom' }, 502);
  render(<PilotAnalyticsPage />);
  await waitFor(() => expect(screen.getByTestId('pilot-error')).toBeInTheDocument());
});
