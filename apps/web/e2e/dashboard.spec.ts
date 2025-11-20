import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 *
 * Tests core dashboard functionality:
 * 1. Loading and rendering all modules
 * 2. Navigation between modules
 * 3. Widget interactions
 * 4. Real-time updates
 * 5. Responsive behavior
 */

// Helper to login before each test
async function loginAsUser(page: any) {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should load dashboard with all modules', async ({ page }) => {
    // Check dashboard is loaded
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

    // Check all module cards are visible
    await expect(page.locator('[data-testid="module-health"]')).toBeVisible();
    await expect(page.locator('[data-testid="module-finance"]')).toBeVisible();
    await expect(page.locator('[data-testid="module-career"]')).toBeVisible();
    await expect(page.locator('[data-testid="module-education"]')).toBeVisible();
    await expect(page.locator('[data-testid="module-goals"]')).toBeVisible();
  });

  test('should navigate to health module', async ({ page }) => {
    // Click health module card
    await page.click('[data-testid="module-health"]');

    // Should navigate to health page
    await expect(page).toHaveURL(/.*health/);
    await expect(page.locator('h1:has-text("Health")')).toBeVisible();
  });

  test('should display recent activity feed', async ({ page }) => {
    // Activity feed should be visible
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible();

    // Should have at least one activity item (or empty state)
    const activityItems = page.locator('[data-testid="activity-item"]');
    const count = await activityItems.count();

    if (count > 0) {
      // Check first activity item has required elements
      await expect(activityItems.first().locator('.activity-icon')).toBeVisible();
      await expect(activityItems.first().locator('.activity-text')).toBeVisible();
      await expect(activityItems.first().locator('.activity-time')).toBeVisible();
    } else {
      // Empty state
      await expect(page.locator('text=No recent activity')).toBeVisible();
    }
  });

  test('should show quick stats widgets', async ({ page }) => {
    // Check stats widgets are visible
    await expect(page.locator('[data-testid="stat-goals-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-health-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-budget-status"]')).toBeVisible();

    // Stats should have numeric values
    const goalsCompleted = await page.locator('[data-testid="stat-goals-completed"] .stat-value').textContent();
    expect(goalsCompleted).toMatch(/\d+/);
  });

  test('should interact with AI assistant', async ({ page }) => {
    // Open AI assistant
    await page.click('[data-testid="ai-assistant-button"]');

    // Assistant panel should open
    await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();

    // Type a message
    await page.fill('[data-testid="ai-input"]', 'What are my goals for this week?');
    await page.click('[data-testid="ai-send-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="ai-loading"]')).toBeVisible();

    // Wait for response (with timeout)
    await expect(page.locator('[data-testid="ai-response"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('should filter activity by module', async ({ page }) => {
    // Open filter dropdown
    await page.click('[data-testid="activity-filter"]');

    // Select health filter
    await page.click('[data-testid="filter-health"]');

    // Activity feed should update
    const activityItems = page.locator('[data-testid="activity-item"]');

    if (await activityItems.count() > 0) {
      // All visible items should be health-related
      const firstItem = activityItems.first();
      await expect(firstItem.locator('[data-module="health"]')).toBeVisible();
    }
  });

  test('should navigate using sidebar', async ({ page }) => {
    // Sidebar should be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

    // Click Goals in sidebar
    await page.click('[data-testid="nav-goals"]');
    await expect(page).toHaveURL(/.*goals/);

    // Click back to Dashboard
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show user profile in header', async ({ page }) => {
    // User menu should be visible
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Click user menu
    await page.click('[data-testid="user-menu"]');

    // Dropdown should show
    await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();

    // Should have profile link
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Logout')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Sidebar should be collapsed on mobile
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toBeVisible();

    // Mobile menu button should be visible
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Click to open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(sidebar).toBeVisible();
  });

  test('should handle offline state gracefully', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Refresh page
    await page.reload();

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('text=You are offline')).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Offline indicator should disappear
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  });
});
