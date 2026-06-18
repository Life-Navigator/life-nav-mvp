/**
 * @jest-environment jsdom
 *
 * Data Flow & Rendering Integrity — the dashboard ExecutiveSummary must render the canonical
 * fields from /api/life/my-life: vision, risks, opportunities, AND the newly-surfaced constraints
 * + motivations + goal confirmation-state. Defensive: absent fields → honest omission, never crash.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ExecutiveSummary from '../ExecutiveSummary';

const myLife = {
  has_discovery: true,
  life_vision: {
    life_vision: 'Build a secure, present family life',
    vision_confirmed: true,
    primary_objective: 'Reach financial independence by 55',
    confidence_pct: 72,
    discovery_completion_pct: 60,
  },
  what_matters_most: {
    primary_objective: 'Reach financial independence by 55',
    risks: ['Underinsured for the mortgage'],
    opportunities: ['Max the employer 401k match'],
    supporting_objectives: ['Fund the kids college'],
    constraints: ['Single income while spouse retrains'],
  },
  life_readiness: { overall: 64, status: 'on_track', domains: [] },
  next_best_action: {
    kind: 'action',
    title: 'Increase 401k to the full match',
    confidence_pct: 80,
  },
  // Top-level constraints (richest shape) + motivations the backend now surfaces.
  constraints: [{ label: 'Single income while spouse retrains', detail: 'Until mid-2027' }],
  motivations: ['Provide for family', { label: 'Financial security' }],
  canonical_goals: [
    { id: 'g1', title: 'Financial independence', progress: 40, confirmation_status: 'confirmed' },
    { id: 'g2', title: 'Buy a vacation home', progress: 5, confirmation_status: 'candidate' },
  ],
};

function mockFetch() {
  global.fetch = jest.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/life/my-life'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve(myLife) } as Response);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ goals: [] }) } as Response);
  }) as unknown as typeof fetch;
}

describe('ExecutiveSummary canonical rendering', () => {
  beforeEach(() => mockFetch());

  it('renders constraints (what is holding things back) from the canonical payload', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => expect(screen.getByText(/holding things back/i)).toBeInTheDocument());
    expect(screen.getByText(/Single income while spouse retrains/)).toBeInTheDocument();
    expect(screen.getByText(/Until mid-2027/)).toBeInTheDocument();
  });

  it('renders motivations (what is driving you) when present', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => expect(screen.getByText(/what's driving you/i)).toBeInTheDocument());
    expect(screen.getByText('Provide for family')).toBeInTheDocument();
    expect(screen.getByText('Financial security')).toBeInTheDocument();
  });

  it('renders risks and opportunities from what_matters_most', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() =>
      expect(screen.getByText(/Underinsured for the mortgage/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Max the employer 401k match/)).toBeInTheDocument();
  });

  it('shows a candidate badge only for unconfirmed goals (confirmation state)', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => expect(screen.getByText('Financial independence')).toBeInTheDocument());
    // One goal is a candidate, one is confirmed → exactly one badge.
    expect(screen.getAllByText(/candidate/i)).toHaveLength(1);
  });

  it('renders canonical goals without duplicates', async () => {
    render(<ExecutiveSummary />);
    await waitFor(() => expect(screen.getByText('Financial independence')).toBeInTheDocument());
    expect(screen.getAllByText('Financial independence')).toHaveLength(1);
    expect(screen.getAllByText('Buy a vacation home')).toHaveLength(1);
  });
});

describe('ExecutiveSummary defensive omission', () => {
  it('omits constraints/motivations sections when the payload lacks them (no fabrication)', async () => {
    global.fetch = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/life/my-life'))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_discovery: true,
              life_vision: { primary_objective: 'X', vision_confirmed: false },
              what_matters_most: {},
              life_readiness: {},
              next_best_action: null,
            }),
        } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ goals: [] }) } as Response);
    }) as unknown as typeof fetch;

    render(<ExecutiveSummary />);
    await waitFor(() => expect(screen.queryByText(/Loading your life summary/i)).toBeNull());
    expect(screen.queryByText(/holding things back/i)).toBeNull();
    expect(screen.queryByText(/what's driving you/i)).toBeNull();
  });
});
