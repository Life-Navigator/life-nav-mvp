/**
 * @jest-environment jsdom
 *
 * Data Flow & Rendering Integrity — the end-of-discovery reveal must render the canonical narrative,
 * goals, tension, opportunity, risk, next move, AND (when present) constraints + motivations from
 * /api/life/my-life. Defensive: absent fields are omitted, never fabricated.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Streaming off → narrative renders instantly so we can assert on it deterministically.
jest.mock('@/lib/arcana/streaming', () => ({ ARCANA_STREAMING_ENABLED: false }));
jest.mock('@/components/ui/StreamingText', () => {
  const ReactActual = jest.requireActual('react');
  // Render the text instantly and fire onDone so the staged reveal advances to stage 2 (supporting cards).
  function MockStreamingText({ text, onDone }: { text: string; onDone?: () => void }) {
    ReactActual.useEffect(() => {
      onDone?.();
    }, [onDone]);
    return <span>{text}</span>;
  }
  return { __esModule: true, default: MockStreamingText };
});
jest.mock('@/components/feedback/NarrativeAccuracyPrompt', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/feedback/InsightPrompt', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/feedback/HolyShitPrompt', () => ({
  __esModule: true,
  default: () => null,
}));

import DiscoveryReveal from '../DiscoveryReveal';

const ready = {
  life_brief: {
    ready: true,
    headline: 'You are building toward an independent, family-first life.',
    situation: 'You are juggling a demanding career with a young family.',
    body: 'You are juggling a demanding career with a young family.',
    tension: 'Career intensity competes with the time your family needs.',
    stakes: 'Biggest thing to protect against: an under-funded emergency buffer.',
    next_move: 'Your next move: automate a monthly transfer to savings.',
    goals_held: ['Financial independence', 'College fund'],
    confidence_pct: 68,
  },
  what_matters_most: {
    opportunities: ['Capture the full 401k match'],
    risks: ['Single income concentration'],
    constraints: ['One income while spouse retrains'],
  },
  narrative_explanation: { confidence_pct: 68 },
  motivations: ['Provide for family'],
};

beforeEach(() => {
  // Defensive against cross-suite pollution: another suite in the same worker can leave fake timers active
  // (jest.useFakeTimers without a restore), which freezes this component's staged reveal so the goals
  // (rendered at stage >= 2) never appear. Force real timers so the staged effects actually run.
  jest.useRealTimers();
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(ready) } as Response)
  ) as unknown as typeof fetch;
});

describe('DiscoveryReveal canonical rendering', () => {
  it('renders the narrative, goals, tension, opportunity, risk and next move', async () => {
    render(<DiscoveryReveal onContinue={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByText(/building toward an independent, family-first life/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Financial independence')).toBeInTheDocument();
    expect(screen.getByText('College fund')).toBeInTheDocument();
    expect(screen.getByText(/Career intensity competes/)).toBeInTheDocument();
    expect(screen.getByText(/Capture the full 401k match/)).toBeInTheDocument();
    expect(screen.getByText(/under-funded emergency buffer/)).toBeInTheDocument();
    expect(screen.getByText(/automate a monthly transfer/)).toBeInTheDocument();
  });

  it('renders constraints and motivations when present', async () => {
    render(<DiscoveryReveal onContinue={() => {}} />);
    await waitFor(() => expect(screen.getByText(/holding things back/i)).toBeInTheDocument());
    expect(screen.getByText(/One income while spouse retrains/)).toBeInTheDocument();
    expect(screen.getByText(/what's driving you/i)).toBeInTheDocument();
    expect(screen.getByText(/Provide for family/)).toBeInTheDocument();
  });

  it('shows the honest empty state and no fabricated narrative when not ready', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ life_brief: { ready: false } }),
      } as Response)
    ) as unknown as typeof fetch;
    render(<DiscoveryReveal onContinue={() => {}} />);
    await waitFor(() => expect(screen.getByText(/still getting to know you/i)).toBeInTheDocument());
    expect(screen.queryByText(/holding things back/i)).toBeNull();
  });
});
