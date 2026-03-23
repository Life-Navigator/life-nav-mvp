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

// Mock Supabase client — authenticated user by default
const mockGetUser = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock useRouter
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Import after mocks are set up
import QuestionnairePage from '../questionnaire/page';

describe('Onboarding Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        },
      },
    });
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      })
    );
  });

  it('renders the questionnaire intro after loading user', async () => {
    render(<QuestionnairePage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome to life navigator/i)).toBeInTheDocument();
      expect(screen.getByText(/personalized life roadmap/i)).toBeInTheDocument();
    });
  });

  it('redirects to login if user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(<QuestionnairePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('shows progress bar after starting questionnaire', async () => {
    render(<QuestionnairePage />);

    await waitFor(() => {
      expect(screen.getByText(/let's get started/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/let's get started/i));

    expect(screen.getByText(/progress/i)).toBeInTheDocument();
  });

  it('gets userId from Supabase session, not query params', async () => {
    render(<QuestionnairePage />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });
  });
});
