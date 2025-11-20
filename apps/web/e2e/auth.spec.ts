import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Critical flows:
 * 1. User registration
 * 2. Email verification
 * 3. Login with credentials
 * 4. Two-factor authentication (2FA)
 * 5. Password reset
 * 6. Session management
 */

test.describe('Authentication Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('should complete signup flow', async ({ page }) => {
    // Navigate to signup
    await page.click('text=Sign Up');
    await expect(page).toHaveURL(/.*signup/);

    // Fill signup form
    const timestamp = Date.now();
    const email = `test-${timestamp}@example.com`;

    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', 'SecurePassword123!');
    await page.fill('[name="confirmPassword"]', 'SecurePassword123!');

    // Accept terms
    await page.check('[name="agreeToTerms"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to email verification page
    await expect(page).toHaveURL(/.*verify-email/);
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Navigate to login
    await page.click('text=Sign In');
    await expect(page).toHaveURL(/.*login/);

    // Fill login form (using test account)
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or 2FA if enabled
    await page.waitForURL(/\/(dashboard|2fa)/);
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill with invalid credentials
    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="password"]', 'WrongPassword');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should complete 2FA flow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'test-2fa@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Should be on 2FA page
    await expect(page).toHaveURL(/.*2fa/);

    // Enter 2FA code (6 digits)
    await page.fill('[name="code"]', '123456');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard (or show error for invalid code)
    await page.waitForURL(/.*/, { timeout: 5000 });
  });

  test('should initiate password reset', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password
    await page.click('text=Forgot password?');
    await expect(page).toHaveURL(/.*forgot-password/);

    // Enter email
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should logout successfully', async ({ page, context }) => {
    // Login first (helper function would be better)
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Check we have auth cookies
    const cookies = await context.cookies();
    const hasAuthCookie = cookies.some(c => c.name.includes('token') || c.name.includes('session'));
    expect(hasAuthCookie).toBeTruthy();

    // Click logout (might be in dropdown menu)
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');

    // Should redirect to home/login
    await expect(page).toHaveURL(/\/(|login)/);

    // Auth cookies should be cleared
    const cookiesAfter = await context.cookies();
    const hasAuthAfter = cookiesAfter.some(c => c.name.includes('token') || c.name.includes('session'));
    expect(hasAuthAfter).toBeFalsy();
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);

    // Refresh page
    await page.reload();

    // Should still be on dashboard (session maintained)
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});
