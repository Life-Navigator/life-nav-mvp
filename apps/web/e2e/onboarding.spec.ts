import { test, expect } from '@playwright/test';

/**
 * Onboarding Flow E2E Tests
 *
 * Tests the complete new user onboarding experience:
 * 1. Personal information collection
 * 2. Goal setting
 * 3. Module selection
 * 4. Privacy settings
 * 5. Completion and redirect to dashboard
 */

test.describe('Onboarding Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Login as a new user who hasn't completed onboarding
    await page.goto('/login');
    await page.fill('[name="email"]', 'new-user@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Should be redirected to onboarding
    await expect(page).toHaveURL(/.*onboarding/);
  });

  test('should complete full onboarding flow', async ({ page }) => {
    // Step 1: Personal Information
    await expect(page.locator('h1:has-text("Welcome")')).toBeVisible();

    await page.fill('[name="dateOfBirth"]', '1990-01-15');
    await page.selectOption('[name="gender"]', 'male');
    await page.fill('[name="location"]', 'San Francisco, CA');

    await page.click('button:has-text("Next")');

    // Step 2: Goal Setting
    await expect(page.locator('h2:has-text("What are your goals")')).toBeVisible();

    // Select multiple goals
    await page.check('[value="health"]');
    await page.check('[value="finance"]');
    await page.check('[value="career"]');

    await page.click('button:has-text("Next")');

    // Step 3: Module Customization
    await expect(page.locator('h2:has-text("Customize your modules")')).toBeVisible();

    // Health module settings
    await page.check('[name="enableHealthTracking"]');
    await page.check('[name="syncWearables"]');

    // Finance module settings
    await page.check('[name="enableBudgeting"]');
    await page.check('[name="trackInvestments"]');

    await page.click('button:has-text("Next")');

    // Step 4: Privacy Settings
    await expect(page.locator('h2:has-text("Privacy")')).toBeVisible();

    await page.check('[name="dataSharing"]', { checked: false });
    await page.check('[name="analytics"]');

    await page.click('button:has-text("Complete Setup")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Welcome to Life Navigator')).toBeVisible();
  });

  test('should allow skipping optional steps', async ({ page }) => {
    // Skip personal info
    await page.click('button:has-text("Skip")');

    // Should move to next step
    await expect(page.locator('h2:has-text("What are your goals")')).toBeVisible();

    // Select at least one goal (required)
    await page.check('[value="health"]');
    await page.click('button:has-text("Next")');

    // Skip module customization
    await page.click('button:has-text("Skip")');

    // Privacy settings (required)
    await page.check('[name="acceptTerms"]');
    await page.click('button:has-text("Complete Setup")');

    // Should complete onboarding
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should save progress and allow resuming', async ({ page }) => {
    // Fill first step
    await page.fill('[name="dateOfBirth"]', '1990-01-15');
    await page.click('button:has-text("Next")');

    // Fill second step
    await page.check('[value="health"]');
    await page.click('button:has-text("Next")');

    // Navigate away (simulate browser close)
    await page.goto('/');

    // Come back to onboarding
    await page.goto('/onboarding');

    // Should resume from where we left off (step 3)
    await expect(page.locator('h2:has-text("Customize your modules")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")');

    // Should show validation errors
    await expect(page.locator('text=This field is required')).toBeVisible();

    // Should stay on same step
    await expect(page.locator('h1:has-text("Welcome")')).toBeVisible();
  });

  test('should show progress indicator', async ({ page }) => {
    // Check initial progress (step 1 of 4)
    await expect(page.locator('[data-testid="progress-indicator"]')).toContainText('1 of 4');

    // Move to next step
    await page.fill('[name="dateOfBirth"]', '1990-01-15');
    await page.click('button:has-text("Next")');

    // Progress should update
    await expect(page.locator('[data-testid="progress-indicator"]')).toContainText('2 of 4');
  });

  test('should allow going back to previous steps', async ({ page }) => {
    // Go to step 2
    await page.fill('[name="dateOfBirth"]', '1990-01-15');
    await page.click('button:has-text("Next")');

    // Click back button
    await page.click('button:has-text("Back")');

    // Should be back on step 1
    await expect(page.locator('h1:has-text("Welcome")')).toBeVisible();

    // Data should be preserved
    await expect(page.locator('[name="dateOfBirth"]')).toHaveValue('1990-01-15');
  });
});
