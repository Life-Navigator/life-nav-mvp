/**
 * @jest-environment jsdom
 *
 * Document Intelligence Trust — Phase 8 Resume Import Review.
 * Trust invariants:
 *   1. Extracted records show grouped by section with confidence + source page.
 *   2. Pre-import conflicts with the existing profile are surfaced before importing.
 *   3. Nothing auto-imports; ignored items are excluded; import posts to the import route.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ResumeImportReview from '../ResumeImportReview';

const REVIEW = {
  document_id: 'd1',
  sections: [
    {
      section: 'employment',
      title: 'Employment History',
      items: [
        {
          id: 'e1',
          fields: { title: 'VP Engineering', employer: 'Acme Inc' },
          confidence: 0.9,
          page_number: 1,
          review_status: 'extracted',
        },
        {
          id: 'e2',
          fields: { title: 'Software Engineer', employer: 'Globex' },
          confidence: 0.85,
          page_number: 1,
          review_status: 'extracted',
        },
      ],
    },
    {
      section: 'education',
      title: 'Education',
      items: [
        {
          id: 'ed1',
          fields: { degree_type: 'master', institution_name: 'Stanford University' },
          confidence: 0.8,
          page_number: 2,
          review_status: 'extracted',
        },
      ],
    },
  ],
};
const CONFLICTS = {
  conflicts: [
    {
      concept: 'current_role',
      label: 'Current role',
      severity: 'medium',
      items: [
        { value: 'VP Engineering', source_label: 'an uploaded document' },
        { value: 'Senior Engineering Manager', source_label: 'your career profile' },
      ],
      recommended: { text: "Keep 'Senior Engineering Manager' (from your career profile)." },
    },
  ],
};

function routeFetch(map: (url: string, init?: RequestInit) => unknown) {
  global.fetch = jest.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok: true, json: async () => map(url, init) } as Response)
  ) as unknown as typeof fetch;
}
afterEach(() => jest.resetAllMocks());

const base = (url: string) =>
  url.includes('/conflicts') ? CONFLICTS : url.includes('/review') ? REVIEW : {};

it('shows extracted records by section and pre-import conflicts', async () => {
  routeFetch(base);
  render(<ResumeImportReview documentId="d1" />);
  expect(await screen.findByTestId('resume-import-review')).toBeInTheDocument();
  expect(screen.getByTestId('resume-section-employment')).toHaveTextContent(
    'VP Engineering @ Acme Inc'
  );
  expect(screen.getByTestId('resume-section-education')).toHaveTextContent('Stanford University');
  // pre-import conflict surfaced (reusing Phase 6 engine output)
  expect(screen.getByTestId('resume-conflicts')).toHaveTextContent('Senior Engineering Manager');
});

it('excludes ignored items and imports the rest', async () => {
  routeFetch((url) => (url.includes('/import') ? { imported_total: 2 } : base(url)));
  render(<ResumeImportReview documentId="d1" />);
  await screen.findByTestId('resume-import-review');

  // 3 items → button says "Import 3 approved"; ignore one → "Import 2 approved"
  expect(screen.getByTestId('import-approved')).toHaveTextContent('Import 3 approved');
  fireEvent.click(screen.getByTestId('ignore-e2'));
  await waitFor(() =>
    expect(screen.getByTestId('import-approved')).toHaveTextContent('Import 2 approved')
  );

  fireEvent.click(screen.getByTestId('import-approved'));
  const fetchMock = global.fetch as jest.Mock;
  await waitFor(() =>
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/resume/d1/import'))).toBe(true)
  );
  expect(await screen.findByTestId('resume-imported')).toHaveTextContent('Imported 2 record(s)');
});
