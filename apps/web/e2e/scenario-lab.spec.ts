/**
 * Scenario Lab End-to-End Tests
 *
 * Critical path testing:
 * 1. Happy path: Create → Add Inputs → Simulate → Commit → Roadmap → Pin → Dashboard
 * 2. Guardrail: Pin on uncommitted version → Blocked
 */

import { test, expect } from '@playwright/test';

test.describe('Scenario Lab Critical Path', () => {
  test.beforeEach(async ({ page }) => {
    // Login as demo user
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'demo@lifenavigator.app');
    await page.fill('input[type="password"]', 'DemoUser2024!');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('Happy Path: Complete scenario flow from creation to dashboard pin', async ({ page }) => {
    // Step 1: Navigate to Scenario Lab
    await page.goto('/dashboard/scenario-lab');
    await expect(page.getByText('Scenario Lab')).toBeVisible();

    // Step 2: Create a new scenario
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Career Transition');
    await page.fill('textarea[name="description"]', 'Test scenario for career change');

    // Select icon and color (if pickers are available)
    await page.click('button:has-text("Create")');

    // Wait for scenario detail page
    await expect(page.getByText('E2E Test Career Transition')).toBeVisible();

    // Step 3: Add inputs on Decisions tab
    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'current_salary');
    await page.fill('input[name="field_value"]', '60000');
    await page.fill('input[name="confidence"]', '0.9');
    await page.click('button:has-text("Save Input")');

    // Wait for input to appear in list
    await expect(page.getByText('current_salary')).toBeVisible();

    // Add second input
    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'target_salary');
    await page.fill('input[name="field_value"]', '90000');
    await page.fill('input[name="confidence"]', '0.7');
    await page.click('button:has-text("Save Input")');

    await expect(page.getByText('target_salary')).toBeVisible();

    // Step 4: Run simulation
    await page.click('button:has-text("Run Simulation")');

    // Wait for simulation to complete
    await expect(page.getByText('Simulation Complete')).toBeVisible({ timeout: 30000 });

    // Step 5: Navigate to Scoreboard tab
    await page.click('button:has-text("Scoreboard")');

    // Verify goal probabilities are displayed
    await expect(page.getByText('Goal Probabilities')).toBeVisible();
    await expect(page.locator('text=/P50|Expected outcome/')).toBeVisible();

    // Verify pin button is disabled (scenario not committed yet)
    const pinButton = page.locator('button:has-text("Pin to Dashboard")').first();
    await expect(pinButton).toBeDisabled();

    // Step 6: Commit scenario
    await page.click('button:has-text("Commit Scenario")');
    await page.click('button:has-text("Confirm Commit")'); // Confirmation dialog
    await expect(page.getByText('Committed')).toBeVisible();

    // Step 7: Navigate back to Scoreboard and pin a goal
    await page.click('button:has-text("Scoreboard")');

    // Pin button should now be enabled
    const pinButtonEnabled = page.locator('button:has-text("Pin to Dashboard")').first();
    await expect(pinButtonEnabled).toBeEnabled();
    await pinButtonEnabled.click();

    // Wait for success confirmation
    await expect(page.getByText('pinned to dashboard')).toBeVisible();

    // Step 8: Navigate to Roadmap tab
    await page.click('button:has-text("Roadmap")');
    await expect(page.getByText('Phases')).toBeVisible();
    await expect(page.getByText('Tasks')).toBeVisible();

    // Verify emergency fund task exists
    await expect(page.getByText(/emergency fund/i)).toBeVisible();

    // Step 9: Generate roadmap/plan
    await page.click('button:has-text("Generate Plan")');
    await expect(page.getByText('Plan Generated')).toBeVisible({ timeout: 15000 });

    // Step 10: Navigate to main dashboard
    await page.goto('/dashboard');

    // Verify pinned scenario widget appears
    await expect(page.getByText('Pinned from Scenario Lab')).toBeVisible();
    await expect(page.getByText('E2E Test Career Transition')).toBeVisible();
    await expect(page.locator('text=/P50|expected/i')).toBeVisible();

    // Step 11: Unpin from dashboard
    await page.click('button:has-text("Unpin")');
    await page.click('button:has-text("OK")'); // Confirmation dialog

    // Verify widget shows empty state
    await expect(page.getByText('Pin a Goal to Your Dashboard')).toBeVisible();
  });

  test('Guardrail: Cannot pin goal from uncommitted scenario', async ({ page }) => {
    // Step 1: Create a new draft scenario
    await page.goto('/dashboard/scenario-lab');
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Draft Scenario');
    await page.fill('textarea[name="description"]', 'Test uncommitted scenario');
    await page.click('button:has-text("Create")');

    // Step 2: Add minimal input
    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'salary');
    await page.fill('input[name="field_value"]', '50000');
    await page.click('button:has-text("Save Input")');

    // Step 3: Run simulation
    await page.click('button:has-text("Run Simulation")');
    await expect(page.getByText('Simulation Complete')).toBeVisible({ timeout: 30000 });

    // Step 4: Navigate to Scoreboard
    await page.click('button:has-text("Scoreboard")');

    // Step 5: Verify pin button is disabled
    const pinButton = page.locator('button:has-text("Pin to Dashboard")').first();
    await expect(pinButton).toBeDisabled();

    // Step 6: Hover over disabled button to see tooltip
    await pinButton.hover();
    await expect(page.getByText(/commit.*to pin/i)).toBeVisible();

    // Step 7: Verify status badge shows "Draft"
    await expect(page.getByText('Draft')).toBeVisible();
  });

  test('Guardrail: Reports require committed scenario', async ({ page }) => {
    // Step 1: Create draft scenario
    await page.goto('/dashboard/scenario-lab');
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Reports Scenario');
    await page.click('button:has-text("Create")');

    // Step 2: Add input and run simulation
    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'salary');
    await page.fill('input[name="field_value"]', '50000');
    await page.click('button:has-text("Save Input")');
    await page.click('button:has-text("Run Simulation")');
    await expect(page.getByText('Simulation Complete')).toBeVisible({ timeout: 30000 });

    // Step 3: Navigate to Reports tab
    await page.click('button:has-text("Reports")');

    // Step 4: Try to generate report
    const generateButton = page.locator('button:has-text("Generate Report")');

    if (await generateButton.isVisible()) {
      // If button exists, it should be disabled or show error when clicked
      if (await generateButton.isEnabled()) {
        await generateButton.click();
        await expect(page.getByText(/commit.*before.*report/i)).toBeVisible();
      } else {
        await expect(generateButton).toBeDisabled();
      }
    } else {
      // Or button doesn't exist, with message explaining why
      await expect(page.getByText(/commit.*scenario/i)).toBeVisible();
    }
  });

  test('UI Performance: Scenario list loads quickly', async ({ page }) => {
    // Navigate to Scenario Lab
    const startTime = Date.now();
    await page.goto('/dashboard/scenario-lab');
    await expect(page.getByText('Scenario Lab')).toBeVisible();
    const loadTime = Date.now() - startTime;

    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('UI Responsiveness: Simulation progress updates', async ({ page }) => {
    // Create scenario and start simulation
    await page.goto('/dashboard/scenario-lab');
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Progress');
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'salary');
    await page.fill('input[name="field_value"]', '50000');
    await page.click('button:has-text("Save Input")');

    // Start simulation
    await page.click('button:has-text("Run Simulation")');

    // Verify progress indicator appears
    await expect(page.locator('[role="progressbar"]')).toBeVisible();

    // Wait for completion
    await expect(page.getByText('Simulation Complete')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Scenario Lab Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'demo@lifenavigator.app');
    await page.fill('input[type="password"]', 'DemoUser2024!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Should show error when simulation fails', async ({ page }) => {
    // This test would require mocking a failure condition
    // For now, verify error UI exists

    await page.goto('/dashboard/scenario-lab');
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Error Handling');
    await page.click('button:has-text("Create")');

    // Try to run simulation without inputs (should fail gracefully)
    await page.click('button:has-text("Run Simulation")');

    // Should show error message
    await expect(page.getByText(/error|failed|no inputs/i)).toBeVisible({ timeout: 5000 });
  });

  test('Should validate input confidence range (0-1)', async ({ page }) => {
    await page.goto('/dashboard/scenario-lab');
    await page.click('button:has-text("Create Scenario")');
    await page.fill('input[name="name"]', 'E2E Test Validation');
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("Add Input")');
    await page.selectOption('select[name="goal_id"]', { label: /Financial/ });
    await page.fill('input[name="field_name"]', 'salary');
    await page.fill('input[name="field_value"]', '50000');
    await page.fill('input[name="confidence"]', '1.5'); // Invalid

    await page.click('button:has-text("Save Input")');

    // Should show validation error
    await expect(page.getByText(/confidence.*between 0 and 1/i)).toBeVisible();
  });
});
