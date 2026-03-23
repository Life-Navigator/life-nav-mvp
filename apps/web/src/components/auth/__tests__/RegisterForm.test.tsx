import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterForm from '../RegisterForm';

// Mock Supabase client
const mockSignUp = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

// Mock toast
const mockAddToast = jest.fn();
jest.mock('@/components/ui/toaster', () => ({
  toast: jest.fn(),
  useToast: jest.fn(() => ({
    toasts: [],
    addToast: mockAddToast,
    removeToast: jest.fn(),
  })),
}));

// Mock router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const STRONG_PASSWORD = 'StrongPass123!';

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('renders the registration form correctly', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /i agree to the/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates matching passwords', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: STRONG_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'DifferentPass123!' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it('validates password strength', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it('validates terms agreement', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: STRONG_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/you must agree to the terms/i)).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it('calls supabase.auth.signUp with correct params', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: STRONG_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: STRONG_PASSWORD,
        options: {
          data: { name: 'Test User' },
        },
      });
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      expect(mockPush).toHaveBeenCalledWith('/auth/login?registered=true');
    });
  });

  it('handles registration failure from Supabase', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'User already registered' },
    });

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: STRONG_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/user already registered/i)).toBeInTheDocument();
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('does not call any /api/auth/ routes', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: STRONG_PASSWORD } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /i agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });

    // No fetch calls to auth API routes
    const authFetchCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/auth/')
    );
    expect(authFetchCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });
});
