/**
 * @jest-environment jsdom
 *
 * Document Intelligence Trust — the upload "what changed" view.
 * Trust invariants:
 *   1. On completion, the `changed` items the API returned are rendered verbatim.
 *   2. An EMPTY `changed` shows the honest fallback — NEVER a fabricated success.
 *   3. `needs_review` items surface for the user to confirm.
 *   4. A PII-blocked upload surfaces the detected categories, not a success.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import UploadResult, { type UploadResponse } from '../UploadResult';

describe('UploadResult — what changed', () => {
  it('renders the API `changed` items on completion', () => {
    const res: UploadResponse = {
      document_id: 'd1',
      doc_type: 'will',
      category: 'family',
      status: 'extracted',
      fields_extracted: 2,
      changed: [
        'Will detected',
        'Guardian recorded: Jane Doe',
        'Family readiness will recalculate',
      ],
      fields: [
        { field_key: 'executor', field_value: 'John Smith', confidence: 0.9 },
        { field_key: 'guardian', field_value: 'Jane Doe', confidence: 0.88 },
      ],
    };
    render(<UploadResult res={res} />);

    const list = screen.getByTestId('changed-list');
    expect(list).toHaveTextContent('Will detected');
    expect(list).toHaveTextContent('Guardian recorded: Jane Doe');
    expect(list).toHaveTextContent('Family readiness will recalculate');
    expect(screen.queryByTestId('changed-empty')).not.toBeInTheDocument();
    // headline reflects the applied-to-life-model terminal
    expect(screen.getByText('Applied to your life model')).toBeInTheDocument();
  });

  it('shows the honest fallback (no fabricated success) when `changed` is empty', () => {
    const res: UploadResponse = {
      document_id: 'd2',
      doc_type: 'will',
      status: 'needs_review',
      status_reason: 'scanned_or_image',
      fields_extracted: 0,
      changed: [],
      fields: [],
    };
    render(<UploadResult res={res} />);

    expect(screen.queryByTestId('changed-list')).not.toBeInTheDocument();
    const empty = screen.getByTestId('changed-empty');
    expect(empty).toHaveTextContent(/queued for review|add the details manually|couldn't extract/i);
    // It must NOT claim anything was applied.
    expect(screen.queryByText('Applied to your life model')).not.toBeInTheDocument();
    expect(screen.getByText('Stored — needs a little help')).toBeInTheDocument();
  });

  it('prefers the API message in the empty fallback when present', () => {
    const res: UploadResponse = {
      status: 'needs_review',
      status_reason: 'no_fields_matched',
      fields_extracted: 0,
      changed: [],
      message: 'We read this document but could not find the expected values for a Will.',
    };
    render(<UploadResult res={res} />);
    expect(screen.getByTestId('changed-empty')).toHaveTextContent(
      'We read this document but could not find the expected values for a Will.'
    );
  });

  it('surfaces needs_review items', () => {
    const res: UploadResponse = {
      document_id: 'd3',
      doc_type: 'trust',
      status: 'extracted',
      fields_extracted: 1,
      changed: ['Trust detected', 'Trustee identified: Acme Trust Co'],
      needs_review: [
        { field_key: 'trustee', reason: 'low_confidence_or_scanned', confidence: 0.42 },
      ],
      fields: [{ field_key: 'trustee', field_value: 'Acme Trust Co', confidence: 0.42 }],
    };
    render(<UploadResult res={res} />);

    const review = screen.getByTestId('needs-review');
    expect(review).toHaveTextContent('trustee');
    expect(review).toHaveTextContent('42% confidence');
  });

  it('surfaces a PII block instead of any success', () => {
    const res: UploadResponse = {
      stored: false,
      pii_warning: true,
      requires_confirmation: true,
      status: 'blocked_pending_confirmation',
      message: 'Potential sensitive information detected. Continue anyway?',
      detected: [{ category: 'ssn', label: 'Social Security Number', count: 1 }],
    };
    render(<UploadResult res={res} />);

    expect(screen.getByText('Hold on — sensitive data detected')).toBeInTheDocument();
    expect(screen.getByText('Social Security Number: 1')).toBeInTheDocument();
    expect(screen.queryByTestId('changed-list')).not.toBeInTheDocument();
  });

  it('renders the backend processing_status step list when present', () => {
    const res: UploadResponse = {
      document_id: 'd4',
      doc_type: 'will',
      status: 'extracted',
      fields_extracted: 1,
      changed: ['Will detected'],
      processing_status: [
        { step: 'Uploaded', done: true, detail: 'Your document is stored securely.' },
        { step: 'Classified', done: true },
        { step: 'Text read (OCR)', done: true },
        { step: 'Evidence extracted', done: true },
        { step: 'Recommendation ready', done: true },
      ],
    };
    render(<UploadResult res={res} />);
    const stages = screen.getByTestId('upload-stages');
    expect(stages).toHaveTextContent('Uploaded');
    expect(stages).toHaveTextContent('Recommendation ready');
  });
});
