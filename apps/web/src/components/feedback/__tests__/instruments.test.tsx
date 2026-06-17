import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import NarrativeAccuracyPrompt from '../NarrativeAccuracyPrompt';
import TrustPrompt from '../TrustPrompt';
import RecommendationQualityPrompt from '../RecommendationQualityPrompt';
import InsightPrompt from '../InsightPrompt';
import HolyShitPrompt from '../HolyShitPrompt';
import ReturnIntentPrompt from '../ReturnIntentPrompt';
import NpsPrompt from '../NpsPrompt';

// Mock the canonical hook so we can assert the exact payload each instrument sends.
const mockSubmit = jest.fn();
jest.mock('@/lib/feedback/usePilotFeedback', () => ({
  usePilotFeedback: () => ({ submit: mockSubmit, status: 'idle' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue(true);
});

// Click a scale value (a button labelled with the number) inside a given field's row is hard to
// scope, so the prompts use unique numbers per field where it matters; tests pick by accessible name.
const clickScale = (n: number) => {
  const btns = screen.getAllByRole('button', { name: String(n) });
  fireEvent.click(btns[0]);
};

describe('NarrativeAccuracyPrompt', () => {
  it('renders its questions', () => {
    render(<NarrativeAccuracyPrompt />);
    expect(screen.getByText('Did Arcana correctly understand your situation?')).toBeInTheDocument();
    expect(screen.getByText('What did Arcana misunderstand?')).toBeInTheDocument();
    expect(screen.getByText('What did it understand particularly well?')).toBeInTheDocument();
  });

  it('submits narrative_accuracy with metric, comment and context, then shows thank-you', async () => {
    render(<NarrativeAccuracyPrompt />);
    clickScale(7);
    fireEvent.change(screen.getByPlaceholderText(/anything it got wrong/i), {
      target: { value: 'missed my mortgage' },
    });
    fireEvent.change(screen.getByPlaceholderText(/anything it nailed/i), {
      target: { value: 'got my goals right' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        kind: 'narrative_accuracy',
        metrics: { narrative_accuracy: 7 },
        comment: 'missed my mortgage',
        context: { understood_well: 'got my goals right' },
      })
    );
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });
});

describe('TrustPrompt', () => {
  it('submits trust metrics and recommendation_id context', async () => {
    render(<TrustPrompt recommendationId="rec-123" />);
    // Three scale rows; clicking "5" hits the first row (trust). Submit with whatever is set.
    clickScale(5);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    const payload = mockSubmit.mock.calls[0][0];
    expect(payload.kind).toBe('trust');
    expect(payload.metrics).toEqual({ trust: 5 });
    expect(payload.context).toEqual({ recommendation_id: 'rec-123' });
  });

  it('omits context when no recommendationId is given', async () => {
    render(<TrustPrompt />);
    clickScale(8);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit.mock.calls[0][0].context).toBeUndefined();
  });
});

describe('RecommendationQualityPrompt', () => {
  it('submits usefulness metric, comment and recommendation_id', async () => {
    render(<RecommendationQualityPrompt recommendationId="rec-9" />);
    clickScale(9);
    fireEvent.change(screen.getByPlaceholderText(/what would have made it better/i), {
      target: { value: 'needs a deadline' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    const payload = mockSubmit.mock.calls[0][0];
    expect(payload.kind).toBe('recommendation_quality');
    // composite recommendation_quality = mean of provided sub-scores (here just usefulness=9)
    expect(payload.metrics).toEqual({ usefulness: 9, recommendation_quality: 9 });
    expect(payload.comment).toBe('needs a deadline');
    expect(payload.context).toEqual({ recommendation_id: 'rec-9' });
  });
});

describe('InsightPrompt', () => {
  it('submits insight_detected and comment', async () => {
    render(<InsightPrompt />);
    expect(
      screen.getByText("Did Arcana identify something you hadn't considered?")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.change(screen.getByPlaceholderText(/what did it surface/i), {
      target: { value: 'a tax angle' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        kind: 'insight',
        insight_detected: true,
        comment: 'a tax angle',
      })
    );
  });
});

describe('HolyShitPrompt', () => {
  it('submits surprised flag', async () => {
    render(<HolyShitPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        kind: 'holy_shit',
        surprised: false,
        comment: undefined,
      })
    );
  });
});

describe('ReturnIntentPrompt', () => {
  it('submits return_intent metric and comment', async () => {
    render(<ReturnIntentPrompt />);
    clickScale(10);
    fireEvent.change(screen.getByPlaceholderText(/bring you back/i), {
      target: { value: 'it saved me time' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        kind: 'return_intent',
        metrics: { return_intent: 10 },
        comment: 'it saved me time',
      })
    );
  });
});

describe('NpsPrompt', () => {
  it('renders a 0-10 scale and submits on the nps field', async () => {
    render(<NpsPrompt />);
    // min=0 means a "0" button exists (regular scale instruments start at 1).
    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument();
    clickScale(9);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({ kind: 'nps', nps: 9 }));
  });
});

describe('shared instrument behavior', () => {
  it('skip dismisses without sending', () => {
    const onDismiss = jest.fn();
    render(<NpsPrompt onDismiss={onDismiss} />);
    // The dismiss control's accessible name is its aria-label ("Dismiss"); visible text is "Skip".
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('does not submit twice after success (thank-you replaces the form)', async () => {
    render(<NpsPrompt />);
    clickScale(8);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText(/thank you/i);
    // The send button is gone (thank-you state), so a second submit is impossible.
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call the hook when submit fails (no thank-you, form stays)', async () => {
    mockSubmit.mockResolvedValueOnce(false);
    render(<NpsPrompt />);
    clickScale(3);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    // Failed submit: form remains, no thank-you.
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
});
