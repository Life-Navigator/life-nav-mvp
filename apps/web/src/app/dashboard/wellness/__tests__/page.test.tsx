import { render, screen, waitFor } from '@testing-library/react';
import WellnessPage from '../page';

function mockFetch(summary: unknown, vm: unknown) {
  // @ts-expect-error test shim
  global.fetch = jest.fn((url: string) => {
    const body = String(url).includes('domain-summary') ? summary : vm;
    return Promise.resolve({ ok: body != null, json: () => Promise.resolve(body) });
  });
}

const FACTS = {
  Height: '6\'0"',
  Weight: '210 lbs',
  'Body fat': '18%',
  'Fat mass': '~37.8 lbs',
  'Lean mass': '~172.2 lbs',
  Goal: 'body recomposition',
};
const MISSING = [
  'waist measurement',
  'training routine',
  'starting lifts',
  'cardio benchmark',
  'sleep average',
];
const SUMMARY = {
  facts: FACTS,
  missing_items: MISSING,
  goals: [],
  next_best_action: { label: 'Add progress metrics' },
  advisor_prompt_hint:
    'I have your body composition and goal. Next I need waist measurement, training routine, starting lifts, cardio benchmark, sleep average.',
};

describe('Wellness (Health) page', () => {
  it('1. body composition exists → baseline renders, not empty, status not missing', async () => {
    mockFetch(SUMMARY, { recommendations: [] });
    render(<WellnessPage />);
    await waitFor(() =>
      expect(screen.getByText('Body Composition / Fitness Baseline')).toBeInTheDocument()
    );
    expect(screen.getByText('210 lbs')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();
    expect(screen.getByText('~37.8 lbs')).toBeInTheDocument();
    expect(screen.getByText('~172.2 lbs')).toBeInTheDocument();
    expect(screen.getAllByText(/body recomposition/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Add your health baseline')).toBeNull();
    expect(screen.queryByText(/Confidence: missing/i)).toBeNull();
    expect(screen.getByText(/body composition captured/i)).toBeInTheDocument();
  });

  it('2. missing under "What we still need", no duplicate Add Sleep/Add Activity cards', async () => {
    mockFetch(SUMMARY, { recommendations: [] });
    render(<WellnessPage />);
    await waitFor(() => expect(screen.getByText('What we still need')).toBeInTheDocument());
    expect(screen.getByText('Waist measurement')).toBeInTheDocument();
    expect(screen.getByText('Sleep average')).toBeInTheDocument();
    expect(screen.getByText('Cardio benchmark')).toBeInTheDocument();
    expect(screen.queryByText('Add your sleep')).toBeNull();
    expect(screen.queryByText('Add your activity')).toBeNull();
    // contract agreement: every missing item from the summary is shown
    expect(
      screen.getAllByText(/measurement|routine|lifts|benchmark|average/i).length
    ).toBeGreaterThanOrEqual(5);
  });

  it('3. no health facts → true empty state', async () => {
    mockFetch({ facts: {}, missing_items: [] }, { recommendations: [] });
    render(<WellnessPage />);
    await waitFor(() => expect(screen.getByText('Add your health baseline')).toBeInTheDocument());
    expect(screen.queryByText('Body Composition / Fitness Baseline')).toBeNull();
  });

  it('4. advisor CTA opens the Health Advisor', async () => {
    mockFetch(SUMMARY, null);
    render(<WellnessPage />);
    await waitFor(() => expect(screen.getByText('Talk to Health Advisor')).toBeInTheDocument());
    expect(screen.getByText('Talk to Health Advisor').closest('a')?.getAttribute('href')).toContain(
      'health_advisor'
    );
  });

  it('6. wellness disclaimer present, no diagnosis/treatment language', async () => {
    mockFetch(SUMMARY, null);
    render(<WellnessPage />);
    await waitFor(() => expect(screen.getByText(/not medical advice/i)).toBeInTheDocument());
    expect(screen.queryByText(/diagnos|prescrib|treatment plan/i)).toBeNull();
  });
});
