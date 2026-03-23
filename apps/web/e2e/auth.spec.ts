import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests — Supabase Auth
 *
 * Test matrix:
 * 1. signup → verify email prompt → login page
 * 2. login → dashboard (or onboarding if setup_completed=false)
 * 3. invalid credentials → error shown
 * 4. forgot password → success message
 * 5. logout → redirected, protected routes blocked
 * 6. session persists across refresh
 * 7. unauthenticated access → redirect to login
 * 8. OAuth buttons present and wired
 *
 * NOTE: Tests 1-6 require a running Supabase instance with test accounts.
 * In CI, these run against the preview/staging Supabase project.
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Registration ──────────────────────────────────────────────

  test('should render registration form with all required fields', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /i agree/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('should validate password requirements on registration', async ({ page }) => {
    await page.goto('/auth/register');

    await page.getByLabel(/full name/i).fill('Test User');
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByLabel(/^password$/i).fill('weak');
    await page.getByLabel(/confirm password/i).fill('weak');
    await page.getByRole('checkbox', { name: /i agree/i }).check();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/password must be at least 12 characters/i)).toBeVisible();
  });

  test('should validate terms agreement on registration', async ({ page }) => {
    await page.goto('/auth/register');

    await page.getByLabel(/full name/i).fill('Test User');
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByLabel(/^password$/i).fill('StrongPass123!');
    await page.getByLabel(/confirm password/i).fill('StrongPass123!');
    // Don't check terms
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/you must agree to the terms/i)).toBeVisible();
  });

  // ── Login ─────────────────────────────────────────────────────

  test('should render login form correctly', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/forgot your password/i)).toBeVisible();
    await expect(page.getByText(/register now/i)).toBeVisible();
  });

  test('should show OAuth providers (Google, LinkedIn)', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /linkedin/i })).toBeVisible();
  });

  test('should not have demo login button', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('button', { name: /demo/i })).not.toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel(/email address/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Supabase returns "Invalid login credentials"
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 });

    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  // ── Password Reset ────────────────────────────────────────────

  test('should navigate to forgot password from login', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByText(/forgot your password/i).click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });

  test('should render forgot password form', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  // ── Protected Routes ──────────────────────────────────────────

  test('should redirect unauthenticated user from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Middleware should redirect to login
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('should redirect unauthenticated user from onboarding to login', async ({ page }) => {
    await page.goto('/onboarding/questionnaire');

    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('should preserve redirect path in login URL', async ({ page }) => {
    await page.goto('/dashboard/finance');

    await expect(page).toHaveURL(/login.*redirect/, { timeout: 10000 });
  });

  // ── Public Routes ─────────────────────────────────────────────

  test('should allow access to public pages without auth', async ({ page }) => {
    // These should all load without redirecting to login
    for (const path of ['/', '/pricing', '/features', '/security', '/waitlist']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/.*login/);
    }
  });

  // ── No Auth Fossils ───────────────────────────────────────────

  test('should not have localStorage auth tokens after page load', async ({ page }) => {
    await page.goto('/auth/login');

    const tokens = await page.evaluate(() => ({
      accessToken: localStorage.getItem('access_token'),
      refreshToken: localStorage.getItem('refresh_token'),
      tokenType: localStorage.getItem('token_type'),
    }));

    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
    expect(tokens.tokenType).toBeNull();
  });
});
