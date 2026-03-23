import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '../LoginForm';

// Mock Supabase client
const mockSignInWithPassword = jest.fn();
const mockSignInWithOAuth = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

// Mock router
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignInWithOAuth.mockResolvedValue({ error: null });
  });

  it('renders the login form correctly', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
    expect(screen.getByText(/register now/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot your password\?/i)).toBeInTheDocument();
  });

  it('does not have a demo login button', () => {
    render(<LoginForm />);
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('calls supabase.auth.signInWithPassword on submit', async () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'MyPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'MyPassword123!',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows error message on login failure', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('shows error when supabase client is not configured', async () => {
    // Temporarily override the mock
    const originalModule = jest.requireMock('@/lib/supabase/client');
    const originalFn = originalModule.getSupabaseClient;
    originalModule.getSupabaseClient = () => null;

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/authentication service is not configured/i)).toBeInTheDocument();
    });

    // Restore
    originalModule.getSupabaseClient = originalFn;
  });

  it('calls supabase.auth.signInWithOAuth for Google', async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      });
    });
  });

  it('calls supabase.auth.signInWithOAuth for LinkedIn', async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: /linkedin/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'linkedin_oidc',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      });
    });
  });

  it('disables buttons while loading', async () => {
    // Make signIn hang
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });
  });

  it('does not store tokens in localStorage', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'MyPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    });

    // Verify no auth tokens written to localStorage
    const tokenWrites = setItemSpy.mock.calls.filter(
      ([key]) => key === 'access_token' || key === 'refresh_token' || key === 'token_type'
    );
    expect(tokenWrites).toHaveLength(0);

    setItemSpy.mockRestore();
  });
});
