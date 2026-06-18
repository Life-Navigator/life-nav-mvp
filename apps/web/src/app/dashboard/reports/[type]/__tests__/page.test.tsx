/**
 * @jest-environment jsdom
 *
 * Data Flow & Rendering Integrity — the report viewer must render the canonical narrative, goals,
 * constraints (as labels, NOT raw JSON), risks, and the "Why Arcana believes this" explainability
 * from the preview JSON. Defensive: absent fields → honest empty/omit.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({ useParams: () => ({ type: 'full' }) }));

import ReportViewerPage from '../page';

const preview = {
  format: 'json',
  report: {
    report_type: 'full',
    title: 'Full Life Report',
    version: 3,
    citations: [],
    sections: [
      {
        key: 'advisor_executive',
        title: 'Executive Briefing',
        ord: 0,
        body: {
          cover: { objective: 'Financial independence', confidence_pct: 70 },
          life_brief: {
            ready: true,
            headline: 'An independent, family-first life.',
            body: 'You are balancing a demanding career with a young family.',
            tension: 'Career intensity competes with family time.',
          },
          narrative_explanation: {
            why: 'Your goals cluster around protecting the family while building wealth.',
            contributing_goals: ['Financial independence', 'College fund'],
            evidence_signals: ['You mentioned wanting to retire by 55'],
            confidence_pct: 70,
            confidence_label: 'Moderate',
          },
          goals: [
            { title: 'Financial independence', confirmation_status: 'confirmed', progress: 40 },
            { title: 'Vacation home', confirmation_status: 'candidate', progress: 5 },
          ],
          risks: ['Single income concentration'],
          opportunities: ['Capture full 401k match'],
        },
      },
      {
        key: 'life_model',
        title: 'Your Life Model',
        ord: 1,
        body: {
          life_vision: 'A secure, present family life',
          primary_objective: { title: 'Financial independence', confidence: 0.7 },
          // Constraints arrive as {label, detail} OBJECTS — must render the label, never raw JSON.
          constraints: [{ label: 'One income while spouse retrains', detail: 'Until 2027' }],
          opportunities: [],
          tradeoffs: [],
        },
      },
    ],
  },
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(preview) } as Response)
  ) as unknown as typeof fetch;
});

describe('Report viewer canonical rendering', () => {
  it('renders the narrative lead and goals', async () => {
    render(<ReportViewerPage />);
    await waitFor(() =>
      expect(screen.getByText(/An independent, family-first life/i)).toBeInTheDocument()
    );
    // "Financial independence" legitimately appears in several sections (cover, objective, goals,
    // contributing goals) — assert it is present at least once rather than uniquely.
    expect(screen.getAllByText('Financial independence').length).toBeGreaterThan(0);
    expect(screen.getByText('Vacation home')).toBeInTheDocument();
  });

  it('renders constraints as labels, not raw JSON', async () => {
    render(<ReportViewerPage />);
    await waitFor(() =>
      expect(screen.getByText(/One income while spouse retrains/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Until 2027/)).toBeInTheDocument();
    // The {label,detail} object must never be stringified into the DOM.
    expect(screen.queryByText(/\{"label"/)).toBeNull();
  });

  it('renders the "Why Arcana believes this" explainability block', async () => {
    render(<ReportViewerPage />);
    await waitFor(() => expect(screen.getByText(/Why Arcana believes this/i)).toBeInTheDocument());
    expect(screen.getByText(/goals cluster around protecting the family/)).toBeInTheDocument();
    expect(screen.getByText(/retire by 55/)).toBeInTheDocument();
  });

  it('renders risks and shows a candidate badge only for unconfirmed goals', async () => {
    render(<ReportViewerPage />);
    await waitFor(() =>
      expect(screen.getByText(/Single income concentration/)).toBeInTheDocument()
    );
    expect(screen.getAllByText(/candidate/i)).toHaveLength(1);
  });
});
