/**
 * @jest-environment jsdom
 *
 * UI/Backend Parity — the dashboard "recently learned" strip (life.facts surfacing).
 * Invariants:
 *   1. Render ONLY real facts from /api/life/facts — no fabrication.
 *   2. Hidden (renders nothing) until there is something real to show — no placeholder, no dead end.
 *   3. Inferred facts are flagged "pending confirmation" — never asserted as settled.
 *   4. Each fact names its source document.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import RecentlyLearned from '../RecentlyLearned';

function mockFacts(facts: unknown[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ facts, count: facts.length }),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders nothing when there are no facts (no placeholder)', async () => {
  mockFacts([]);
  const { container } = render(<RecentlyLearned />);
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith('/api/life/facts?limit=8', expect.anything())
  );
  expect(container).toBeEmptyDOMElement();
});

test('renders real facts with source document + pending-confirmation flag', async () => {
  mockFacts([
    {
      id: 'f1',
      label: 'Successor trustee',
      value: 'Jane Doe',
      domain: 'family',
      docType: 'trust',
      documentId: 'doc-1',
      confidence: 0.9,
      needsConfirmation: false,
    },
    {
      id: 'f2',
      label: 'Coverage amount',
      value: '1000000',
      domain: 'family',
      docType: 'life_insurance_policy',
      documentId: 'doc-2',
      confidence: 0.7,
      needsConfirmation: true,
    },
  ]);
  render(<RecentlyLearned />);
  expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  expect(screen.getByText('Successor trustee:')).toBeInTheDocument();
  expect(screen.getByText(/from your trust/)).toBeInTheDocument();
  // inferred fact flagged, never asserted as settled
  expect(screen.getByText(/pending your confirmation/)).toBeInTheDocument();
  expect(screen.getByText(/from your life insurance policy/)).toBeInTheDocument();
});
