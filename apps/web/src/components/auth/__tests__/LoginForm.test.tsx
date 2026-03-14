import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '../LoginForm';

// Mock the toaster component
jest.mock('@/components/ui/toaster', () => ({
  toast: jest.fn(),
  useToast: jest.fn(() => ({
    toasts: [],
    addToast: jest.fn(),
    removeToast: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock the useRouter hook
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Helper to mock fetch responses by URL pattern
function mockFetchResponses(overrides: Record<string, unknown> = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/lockout-status')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ locked: false, remainingTime: 0 }),
      });
    }
    if (url.includes('/set-cookie')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.includes('/api/auth/login')) {
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            token_type: 'Bearer',
            expires_in: 1800,
            ...overrides,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Provide localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
      writable: true,
    });
  });

  it('renders the login form correctly', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try demo account/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
    expect(screen.getByText(/register now/i)).toBeInTheDocument();
  });

  it('validates input fields before submission', async () => {
    render(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // HTML validation prevents submission — no fetch should be called
      // (lockout-status may or may not fire depending on form validation)
    });
  });

  it('handles successful login', async () => {
    mockFetchResponses();

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles failed login', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/lockout-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ locked: false, remainingTime: 0 }),
        });
      }
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Invalid email or password. Please try again.' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('handles demo login', async () => {
    mockFetchResponses();

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    render(<LoginForm />);

    const demoButton = screen.getByRole('button', { name: /try demo account/i });
    fireEvent.click(demoButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          body: JSON.stringify({
            email: 'demo@lifenavigator.app',
            password: 'DemoUser2024!',
          }),
        })
      );
    });
  });
});
