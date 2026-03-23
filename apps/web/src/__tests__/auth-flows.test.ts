/**
 * Auth Flow Integration Tests
 *
 * Validates the Supabase auth rewrite:
 * - No localStorage token leakage
 * - No references to old /api/auth/ routes
 * - Onboarding uses Supabase session, not query params
 * - Auth forms call Supabase directly
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

function readSource(filePath: string): string {
  // Try .tsx then .ts
  for (const ext of ['.tsx', '.ts']) {
    const full = path.join(SRC, filePath + ext);
    if (fs.existsSync(full)) return fs.readFileSync(full, 'utf-8');
  }
  // Try as directory with index
  for (const ext of ['.tsx', '.ts']) {
    const full = path.join(SRC, filePath, 'index' + ext);
    if (fs.existsSync(full)) return fs.readFileSync(full, 'utf-8');
  }
  throw new Error(`Cannot find source file: ${filePath}`);
}

// ─── Auth fossil detection ──────────────────────────────────────

describe('No auth fossils in auth forms', () => {
  const authForms = [
    'components/auth/LoginForm',
    'components/auth/RegisterForm',
    'components/auth/ForgotPasswordForm',
    'components/auth/ResetPasswordForm',
  ];

  authForms.forEach((formPath) => {
    const name = formPath.split('/').pop();

    it(`${name} does not use localStorage`, () => {
      const content = readSource(formPath);
      expect(content).not.toContain('localStorage');
    });

    it(`${name} does not call /api/auth/ routes`, () => {
      const content = readSource(formPath);
      expect(content).not.toMatch(/fetch\(['"]\/api\/auth\//);
    });

    it(`${name} uses Supabase client`, () => {
      const content = readSource(formPath);
      expect(content).toContain('getSupabaseClient');
    });
  });
});

describe('No auth fossils in auth callback', () => {
  it('does not use localStorage', () => {
    const content = readSource('app/auth/callback/page');
    expect(content).not.toContain('localStorage');
  });

  it('does not call /api/auth/set-cookie', () => {
    const content = readSource('app/auth/callback/page');
    expect(content).not.toContain('/api/auth/set-cookie');
  });

  it('uses Supabase client', () => {
    const content = readSource('app/auth/callback/page');
    expect(content).toContain('getSupabaseClient');
  });
});

describe('No auth fossils in dashboard page', () => {
  it('does not check localStorage for auth', () => {
    const content = readSource('app/dashboard/page');
    expect(content).not.toContain('localStorage');
    expect(content).not.toContain('access_token');
  });

  it('does not use useEffect for auth check', () => {
    const content = readSource('app/dashboard/page');
    expect(content).not.toContain('useEffect');
  });

  it('is not a client component (trusts middleware)', () => {
    const content = readSource('app/dashboard/page');
    expect(content).not.toContain("'use client'");
  });
});

// ─── Onboarding uses Supabase session ───────────────────────────

describe('Onboarding pages use Supabase session', () => {
  it('questionnaire does not require userId query param', () => {
    const content = readSource('app/onboarding/questionnaire/page');
    expect(content).not.toContain("searchParams.get('userId')");
    expect(content).toContain('supabase.auth.getUser');
  });

  it('interactive does not require userId query param', () => {
    const content = readSource('app/onboarding/interactive/page');
    expect(content).not.toContain("searchParams.get('userId')");
    expect(content).toContain('supabase.auth.getUser');
  });

  it('questionnaire uses router.push + refresh for completion', () => {
    const content = readSource('app/onboarding/questionnaire/page');
    expect(content).not.toContain('window.location.href');
    expect(content).toContain("router.push('/dashboard')");
    expect(content).toContain('router.refresh()');
  });

  it('interactive uses router.push + refresh for completion', () => {
    const content = readSource('app/onboarding/interactive/page');
    expect(content).not.toContain('window.location.href');
    expect(content).toContain("router.push('/dashboard')");
    expect(content).toContain('router.refresh()');
  });
});

// ─── Middleware uses Supabase only ──────────────────────────────

describe('Middleware is Supabase-only', () => {
  it('does not reference NextAuth or JWT', () => {
    const content = readSource('middleware');
    expect(content).not.toContain('next-auth');
    expect(content).not.toContain('NextAuth');
    expect(content).not.toContain('JWT_SECRET');
    expect(content).not.toContain('NEXTAUTH');
  });

  it('uses supabase.auth.getUser for session check', () => {
    const content = readSource('middleware');
    expect(content).toContain('supabase.auth.getUser');
  });

  it('checks profiles.setup_completed for onboarding gate', () => {
    const content = readSource('middleware');
    expect(content).toContain('setup_completed');
    expect(content).toContain("'/onboarding/questionnaire'");
  });

  it('does not pass userId in onboarding redirect', () => {
    const content = readSource('middleware');
    expect(content).not.toContain('userId=');
  });

  it('handles missing profile row (trigger lag) gracefully', () => {
    const content = readSource('middleware');
    // Should handle profileError or !profile — not just profile && !setup_completed
    expect(content).toContain('profileError');
    expect(content).toMatch(/profileError\s*\|\|\s*!profile\s*\|\|\s*!profile\.setup_completed/);
  });
});

// ─── Hooks contract ─────────────────────────────────────────────

describe('useAuth hook contract', () => {
  it('exports useAuth and getAuthHeaders', () => {
    const content = readSource('hooks/useAuth');
    expect(content).toContain('export function useAuth');
    expect(content).toContain('export function getAuthHeaders');
  });

  it('does not call localStorage methods', () => {
    const content = readSource('hooks/useAuth');
    expect(content).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
  });

  it('uses Supabase for session', () => {
    const content = readSource('hooks/useAuth');
    expect(content).toContain('getSupabaseClient');
    expect(content).toContain('auth.getSession');
    expect(content).toContain('onAuthStateChange');
  });
});

describe('useSession hook contract', () => {
  it('exports useSession, signIn, signOut, SessionProvider', () => {
    const content = readSource('hooks/useSession');
    expect(content).toContain('export function useSession');
    expect(content).toContain('export function signIn');
    expect(content).toContain('export function signOut');
    expect(content).toContain('export function SessionProvider');
  });

  it('does not use localStorage', () => {
    const content = readSource('hooks/useSession');
    expect(content).not.toContain('localStorage');
  });

  it('uses Supabase for user data', () => {
    const content = readSource('hooks/useSession');
    expect(content).toContain('getSupabaseClient');
    expect(content).toContain('auth.getUser');
  });
});

// ─── Deleted route verification ─────────────────────────────────

describe('Old API auth routes are deleted', () => {
  const deletedRoutes = [
    'app/api/auth/register/route',
    'app/api/auth/session/route',
    'app/api/auth/set-cookie/route',
    'app/api/auth/lockout-status/route',
    'app/api/auth/providers/route',
  ];

  deletedRoutes.forEach((route) => {
    it(`${route} does not exist`, () => {
      const tsPath = path.join(SRC, route + '.ts');
      const tsxPath = path.join(SRC, route + '.tsx');
      expect(fs.existsSync(tsPath)).toBe(false);
      expect(fs.existsSync(tsxPath)).toBe(false);
    });
  });
});

// ─── lib/auth/jwt.ts is Supabase wrapper ────────────────────────

describe('lib/auth/jwt.ts is Supabase wrapper', () => {
  it('uses createServerSupabaseClient, not manual JWT decoding', () => {
    const content = readSource('lib/auth/jwt');
    expect(content).toContain('createServerSupabaseClient');
    expect(content).not.toContain('jsonwebtoken');
    expect(content).not.toContain('jose');
    expect(content).not.toContain('atob');
    expect(content).not.toContain('JWT_SECRET');
  });

  it('exports getUserIdFromJWT and verifyToken', () => {
    const content = readSource('lib/auth/jwt');
    expect(content).toContain('export async function getUserIdFromJWT');
    expect(content).toContain('export async function verifyToken');
  });
});
