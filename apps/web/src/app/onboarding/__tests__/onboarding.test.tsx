/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock all onboarding sub-components to isolate page logic
jest.mock('@/components/onboarding/QuestionnaireIntro', () => {
  return function MockIntro({ onContinue }: { onContinue: () => void }) {
    return (
      <div>
        <h2>Welcome to Life Navigator</h2>
        <p>Let's create your personalized life roadmap</p>
        <button onClick={onContinue}>Let's Get Started</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/BasicProfileQuestionnaire', () => {
  return function MockProfile({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Next (Profile)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/EducationQuestionnaire', () => {
  return function MockEd({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Next (Education)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/CareerQuestionnaire', () => {
  return function MockCareer({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Next (Career)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/FinancialQuestionnaire', () => {
  return function MockFinance({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Next (Financial)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/HealthQuestionnaire', () => {
  return function MockHealth({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Next (Health)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/RiskAssessment', () => {
  return function MockRisk({ onNext }: { onNext: () => void }) {
    return (
      <div>
        <button onClick={onNext}>Submit (Risk)</button>
      </div>
    );
  };
});

jest.mock('@/components/onboarding/QuestionnaireComplete', () => {
  return function MockComplete({ onContinue }: { onContinue: () => void }) {
    return (
      <div>
        <button onClick={onContinue}>Go to Dashboard</button>
      </div>
    );
  };
});

// Mock the toast component
const mockAddToast = jest.fn();
jest.mock('@/components/ui/toaster', () => ({
  toast: jest.fn(),
  useToast: jest.fn(() => ({
    toasts: [],
    addToast: mockAddToast,
    removeToast: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ message: 'Success' }),
  } as Response)
);

// Mock useRouter / useSearchParams
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((param: string) => {
      if (param === 'userId') return 'test-user-id';
      return null;
    }),
  }),
}));

// Import after mocks are set up
import QuestionnairePage from '../questionnaire/page';

describe('Onboarding Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      })
    );
  });

  it('renders the questionnaire intro page by default', () => {
    render(<QuestionnairePage />);

    expect(screen.getByText(/welcome to life navigator/i)).toBeInTheDocument();
    expect(screen.getByText(/personalized life roadmap/i)).toBeInTheDocument();
  });

  it('redirects to login if userId is missing', async () => {
    // Override useSearchParams to return null for userId
    jest.spyOn(require('next/navigation'), 'useSearchParams').mockImplementation(() => ({
      get: jest.fn().mockReturnValue(null),
    }));

    render(<QuestionnairePage />);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('shows progress bar after starting questionnaire', async () => {
    render(<QuestionnairePage />);

    const startButton = screen.getByText(/let's get started/i);
    fireEvent.click(startButton);

    expect(screen.getByText(/progress/i)).toBeInTheDocument();
  });
});
