/**
 * @jest-environment jsdom
 *
 * Monday pilot polish — the dashboard hero "Next Best Action" must render the rich fields the
 * Recommendation OS already computes (quantified impact, confidence, why-#1) so a REAL connected
 * user's hero is at least as rich as the sample preview. Absent fields → honest omission, no crash.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MissionControl from '../MissionControl';

const baseDash = {
  status: {
    index: 64,
    status: 'yellow',
    headline: "You're making progress",
    summary: 'At 64/100.',
  },
  top_gaps: [],
  missing_critical_documents: [],
  open_decisions: 0,
  reports_generated: 0,
  documents_on_file: 2,
  journey: {
    documents: true,
    readiness: true,
    gaps_identified: false,
    decision_analyzed: false,
    report_generated: false,
  },
};

function mockDashboard(nba: Record<string, unknown>) {
  global.fetch = jest.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/platform/dashboard'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...baseDash, next_best_action: nba }),
      } as Response);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  }) as unknown as typeof fetch;
}

describe('MissionControl hero next-best-action', () => {
  it('renders impact, confidence and why-#1 from the OS top action', async () => {
    mockDashboard({
      title: 'Max your 401(k) match',
      why: 'You are leaving employer match on the table.',
      recommended_action: 'Raise your contribution to 6% to capture the full match.',
      expected_benefit: '+$3,000/yr in free employer money',
      quantified_impact: {
        financial_impact_annual: 3000,
        retirement_success_before_pct: 62,
        retirement_success_after_pct: 71,
      },
      confidence: 0.9,
      why_number_one: 'Highest priority score (8.1).',
      cta_label: 'Review',
      href: '/dashboard/recommendations',
      step: 'recommendation',
    });
    render(<MissionControl />);
    await waitFor(() => expect(screen.getByText('Max your 401(k) match')).toBeInTheDocument());
    // recommended_action takes the descriptive slot over the bare "why"
    expect(
      screen.getByText(/Raise your contribution to 6% to capture the full match\./)
    ).toBeInTheDocument();
    // quantified impact rendered (annual $ + retirement-success lift)
    expect(screen.getByText(/\+\$3,000\/yr/)).toBeInTheDocument();
    expect(screen.getByText(/retirement success 62% → 71%/)).toBeInTheDocument();
    // why-#1 + confidence
    expect(screen.getByText(/Why this is #1:/)).toBeInTheDocument();
    expect(screen.getByText(/Highest priority score \(8\.1\)\./)).toBeInTheDocument();
    expect(screen.getByText(/Confidence 90%/)).toBeInTheDocument();
    // CTA points at the recommendations surface
    const cta = screen.getByText(/Review/).closest('a');
    expect(cta).toHaveAttribute('href', '/dashboard/recommendations');
  });

  it('omits impact/confidence/why-#1 honestly when the action lacks them (no fabrication)', async () => {
    mockDashboard({
      title: 'Analyze your first decision',
      why: 'See worst/expected/best outcomes grounded in your documents.',
      cta_label: 'Analyze a decision',
      href: '/dashboard/life-decisions/workspace',
      step: 'decision',
    });
    render(<MissionControl />);
    await waitFor(() =>
      expect(screen.getByText('Analyze your first decision')).toBeInTheDocument()
    );
    expect(screen.queryByText(/Why this is #1:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/yr/)).not.toBeInTheDocument();
    // honest fallback to "why" when there is no recommended_action
    expect(
      screen.getByText(/See worst\/expected\/best outcomes grounded in your documents\./)
    ).toBeInTheDocument();
  });
});
