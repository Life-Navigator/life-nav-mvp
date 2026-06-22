/**
 * @jest-environment jsdom
 *
 * Document Intelligence Trust — the "View Evidence" drawer (P0 provenance).
 * Trust invariants:
 *   1. Every field shows its source page/section + confidence band — answering "where did this come from?".
 *   2. Confidence bands follow the sprint thresholds (95+ Verified, 80+ High, 60+ Review, else Needs review).
 *   3. Confirm / Edit / Reject post to the review route and reflect the new status (the trust loop).
 *   4. Render ONLY what the evidence endpoint returns — no fabricated pages or values.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import DocumentEvidence from '../DocumentEvidence';

const EVIDENCE = {
  document: { id: 'd1', doc_type: 'offer_letter', title: 'Offer Letter', confidence: 0.9 },
  fields: [
    {
      id: 'f1',
      field_key: 'base_salary',
      field_value: '150000',
      confidence: 0.9,
      page_number: 2,
      section: 'base salary',
      char_start: 12,
      char_end: 60,
      extraction_method: 'regex',
      review_status: 'extracted',
    },
    {
      id: 'f2',
      field_key: 'signing_bonus',
      field_value: '20000',
      confidence: 0.5,
      page_number: null,
      section: null,
      extraction_method: 'regex',
      review_status: 'needs_review',
    },
  ],
};

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  global.fetch = jest.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok: true, json: async () => impl(url, init) } as Response)
  ) as unknown as typeof fetch;
}

afterEach(() => jest.resetAllMocks());

it('shows provenance + confidence bands for each field', async () => {
  mockFetch(() => EVIDENCE);
  render(<DocumentEvidence documentId="d1" />);

  expect(await screen.findByTestId('document-evidence')).toBeInTheDocument();
  // Page + section + char span provenance for the located field.
  // page + section + char span all live in the one provenance line for the located field.
  expect(
    screen.getByText(/Page 2 · section .*base salary.* · chars 12–60 · via regex/)
  ).toBeInTheDocument();
  // High-confidence band for 0.9, Needs-review band for 0.5.
  expect(screen.getByText(/High confidence · 90%/)).toBeInTheDocument();
  expect(screen.getByText(/Needs review · 50%/)).toBeInTheDocument();
  // A field with no page is honestly labeled, never fabricated.
  expect(screen.getByText(/Pasted text \(no page\)/)).toBeInTheDocument();
});

it('confirms a field via the review route and reflects the new status', async () => {
  const calls: { url: string; body: unknown }[] = [];
  mockFetch((url, init) => {
    if (url.includes('/review')) {
      calls.push({ url, body: JSON.parse((init?.body as string) || '{}') });
      return { field_id: 'f1', review_status: 'user_confirmed' };
    }
    return EVIDENCE;
  });
  render(<DocumentEvidence documentId="d1" />);
  await screen.findByTestId('document-evidence');

  const field = screen.getByTestId('evidence-field-base_salary');
  fireEvent.click(field.querySelector('button')!); // first action button = Confirm

  await waitFor(() => expect(calls.length).toBe(1));
  expect(calls[0].url).toContain('/api/documents/fields/f1/review');
  expect(calls[0].body).toMatchObject({ action: 'confirm' });
  await waitFor(() => expect(screen.getByText('Confirmed by you')).toBeInTheDocument());
});
