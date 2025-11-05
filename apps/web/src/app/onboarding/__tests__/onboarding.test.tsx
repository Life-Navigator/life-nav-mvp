/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuestionnairePage from '../questionnaire/page';
import { toast } from '@/components/ui/toaster';

// Mock the toast component
jest.mock('@/components/ui/toaster', () => ({
  toast: jest.fn(),
}));

// Mock the fetch function
global.fetch = jest.fn();

// Mock useSearchParams to provide userId
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((param) => {
      if (param === 'userId') return 'test-user-id';
      return null;
    }),
  }),
}));

describe('Onboarding Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    
    // Mock successful fetch responses for all API calls
    (global.fetch as jest.Mock).mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      });
    });
  });

  it('renders the questionnaire intro page by default', () => {
    render(<QuestionnairePage />);
    
    // Should show the intro component first
    expect(screen.getByText(/welcome to life navigator/i)).toBeInTheDocument();
    expect(screen.getByText(/customize your experience/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('redirects to login if userId is missing', async () => {
    // Override the mock to return null for userId
    jest.spyOn(require('next/navigation'), 'useSearchParams').mockImplementation(() => ({
      get: jest.fn().mockImplementation(() => null),
    }));
    
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockImplementation(() => ({
      push: mockPush,
    }));
    
    render(<QuestionnairePage />);
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('shows progress bar during questionnaire', async () => {
    render(<QuestionnairePage />);
    
    // Start the questionnaire
    const startButton = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(startButton);
    
    // Should now show the progress bar
    expect(screen.getByText(/progress/i)).toBeInTheDocument();
  });

  it('successfully completes the onboarding process', async () => {
    // Mock window.location.href assignment
    const mockAssign = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { href: mockAssign },
      writable: true,
    });
    
    render(<QuestionnairePage />);
    
    // Start the questionnaire
    const startButton = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(startButton);
    
    // Navigate through the questionnaire steps (simplified for testing)
    // This would normally involve filling out each form step
    
    // After completing all steps, it should show completion screen
    // Here we're mocking a shortcut to the final step
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [6, jest.fn()]);
    
    await waitFor(() => {
      const dashboardButton = screen.getByRole('button', { name: /go to dashboard/i });
      expect(dashboardButton).toBeInTheDocument();
      
      // Clicking the button should redirect to dashboard
      fireEvent.click(dashboardButton);
      expect(window.location.href).toBe('/dashboard');
    });
  });

  it('submits questionnaire data to API endpoints', async () => {
    render(<QuestionnairePage />);
    
    // Access the internal onSubmit function from the component
    const instance = screen.getByTestId('questionnaire-component');
    const { handleSubmit } = instance;
    
    // Call the submit function directly
    await handleSubmit();
    
    // Check that all required API calls were made
    expect(global.fetch).toHaveBeenCalledTimes(6); // 5 data endpoints + 1 complete endpoint
    
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/education-goals', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/career-goals', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/financial-goals', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/health-goals', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/risk-profile', expect.any(Object));
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/complete', expect.any(Object));
  });
});