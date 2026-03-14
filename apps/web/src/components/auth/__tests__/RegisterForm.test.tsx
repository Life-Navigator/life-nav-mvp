import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterForm from '../RegisterForm';
import { toast } from '@/components/ui/toaster';

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

// Mock the fetch function
global.fetch = jest.fn();

// Mock the useRouter hook
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Strong password meeting new requirements (12+ chars, upper, lower, number, special)
const STRONG_PASSWORD = 'StrongPass123!';

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
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

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the/i });
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('validates password strength', async () => {
    render(<RegisterForm />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the/i });
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('validates terms agreement', async () => {
    render(<RegisterForm />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirmPasswordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/you must agree to the terms/i)).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it('handles successful registration', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () =>
        Promise.resolve({
          message: 'User created successfully',
          user: { id: 'test-user-id' },
        }),
    });

    render(<RegisterForm />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the/i });
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirmPasswordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: STRONG_PASSWORD,
        }),
      });

      expect(mockAddToast).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/auth/login?registered=true');
    });
  });

  it('handles registration failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      headers: { get: () => 'application/json' },
      json: () =>
        Promise.resolve({
          message: 'User already exists with this email',
        }),
    });

    render(<RegisterForm />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the/i });
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.change(confirmPasswordInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      expect(screen.getByText(/user already exists/i)).toBeInTheDocument();
    });
  });
});
