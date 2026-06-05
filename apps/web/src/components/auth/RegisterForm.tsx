'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import { getSupabaseClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/analytics/auth-events';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export default function RegisterForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const validateForm = (): boolean => {
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    // eslint-disable-next-line no-useless-escape
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        'Password must be at least 12 characters and include uppercase letters, lowercase letters, numbers, and special characters.'
      );
      return false;
    }

    if (!formData.agreeTerms) {
      setError('You must agree to the terms of service.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication service is not configured.');
      setIsLoading(false);
      return;
    }

    trackAuthEvent({ event: 'signup_started' });

    const { error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { name: formData.name },
      },
    });

    if (authError) {
      trackAuthEvent({ event: 'signup_error', error: authError.message });
      setError(authError.message);
      addToast({ title: 'Registration failed', description: authError.message, type: 'error' });
      setIsLoading(false);
      return;
    }

    trackAuthEvent({ event: 'signup_success' });

    addToast({
      title: 'Registration successful',
      description: 'Check your email to verify your account, then log in.',
      type: 'success',
    });

    router.push('/auth/login?registered=true');
    setIsLoading(false);
  };

  const inputClass =
    'w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/25 disabled:opacity-60';

  return (
    <div>
      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-white/70">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={formData.name}
            onChange={handleChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/70">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="Create a strong password"
          />
          <p className="mt-1.5 text-xs text-white/40">
            At least 12 characters with uppercase, lowercase, a number, and a special character.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-white/70"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            className={inputClass}
            placeholder="Re-enter your password"
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="agreeTerms"
            name="agreeTerms"
            type="checkbox"
            checked={formData.agreeTerms}
            onChange={handleChange}
            disabled={isLoading}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-[#2dd4bf] accent-[#2dd4bf] focus:ring-[#2dd4bf]"
          />
          <label htmlFor="agreeTerms" className="text-sm text-white/65">
            I agree to the{' '}
            <Link href="/legal/terms" className="text-[#5eead4] hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="text-[#5eead4] hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
