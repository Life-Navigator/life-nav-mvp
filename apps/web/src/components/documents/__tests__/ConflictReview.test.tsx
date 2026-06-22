/**
 * @jest-environment jsdom
 *
 * Document Intelligence Trust — Phase 6 Conflict Review.
 * Trust invariants:
 *   1. Each competing value is shown with its cited source (document page or profile) + confidence.
 *   2. A recommendation is surfaced, but the user chooses — keep / correct / ignore.
 *   3. Resolving removes the conflict from the open list and posts to the resolve route.
 *   4. Nothing renders (embedded) when there are no open conflicts.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ConflictReview from '../ConflictReview';

const CONFLICTS = {
  open_count: 1,
  conflicts: [
    {
      id: 'c1',
      domain: 'finance',
      conflict_type: 'insurance_coverage_mismatch',
      field_key: 'life_insurance_coverage',
      label: 'Life insurance coverage',
      status: 'open',
      severity: 'critical',
      items: [
        {
          id: 'i1',
          source_type: 'document',
          source_table: 'documents.document_fields',
          value: '500000',
          confidence: 0.9,
          review_status: 'extracted',
          page_number: 2,
          section: 'coverage',
        },
        {
          id: 'i2',
          source_type: 'domain',
          source_table: 'family.insurance_profiles',
          value: '250000',
          confidence: 1,
          review_status: 'user_entered',
        },
      ],
      recommended: {
        item_id: 'i2',
        value: '250000',
        source_label: 'your insurance profile',
        text: "Keep '250000' (from your insurance profile).",
      },
    },
  ],
};

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  global.fetch = jest.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok: true, json: async () => impl(url, init) } as Response)
  ) as unknown as typeof fetch;
}
afterEach(() => jest.resetAllMocks());

it('shows competing values with cited sources and a recommendation', async () => {
  mockFetch(() => CONFLICTS);
  render(<ConflictReview />);
  expect(await screen.findByTestId('conflict-life_insurance_coverage')).toBeInTheDocument();
  expect(screen.getByText('500000')).toBeInTheDocument();
  expect(screen.getByText('250000')).toBeInTheDocument();
  expect(screen.getByText(/Uploaded document \(page 2/)).toBeInTheDocument();
  expect(screen.getByText(/Your insurance profiles/i)).toBeInTheDocument();
  expect(screen.getByTestId('recommendation')).toHaveTextContent('Keep');
});

it('resolves by keeping a value and removes it from the open list', async () => {
  mockFetch((url) =>
    url.includes('/resolve') ? { conflict_id: 'c1', status: 'user_resolved' } : CONFLICTS
  );
  render(<ConflictReview />);
  await screen.findByTestId('conflict-life_insurance_coverage');

  fireEvent.click(screen.getByTestId('keep-i1'));

  const fetchMock = global.fetch as jest.Mock;
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/conflicts/c1/resolve'))).toBe(
      true
    )
  );
  const resolveCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/resolve'))!;
  expect(JSON.parse(resolveCall[1].body)).toMatchObject({ resolution: 'keep', item_id: 'i1' });
  await waitFor(() =>
    expect(screen.queryByTestId('conflict-life_insurance_coverage')).not.toBeInTheDocument()
  );
});

it('renders nothing when embedded and there are no conflicts', async () => {
  mockFetch(() => ({ open_count: 0, conflicts: [] }));
  const { container } = render(<ConflictReview embedded />);
  await waitFor(() => expect(screen.queryByTestId('conflicts-loading')).not.toBeInTheDocument());
  expect(container).toBeEmptyDOMElement();
});
