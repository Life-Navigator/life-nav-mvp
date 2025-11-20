import { test, expect } from '@playwright/test';

/**
 * Finance Module E2E Tests
 *
 * Tests finance module functionality:
 * 1. Adding financial accounts
 * 2. Uploading and processing receipts (OCR)
 * 3. Creating budgets
 * 4. Viewing transactions
 * 5. Generating financial reports
 */

async function loginAsUser(page: any) {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe('Finance Module', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    // Navigate to finance module
    await page.goto('/finance');
  });

  test('should add a new financial account', async ({ page }) => {
    // Click add account button
    await page.click('[data-testid="add-account-button"]');

    // Modal should open
    await expect(page.locator('[data-testid="add-account-modal"]')).toBeVisible();

    // Fill account details
    await page.fill('[name="accountName"]', 'Checking Account');
    await page.selectOption('[name="accountType"]', 'checking');
    await page.fill('[name="balance"]', '5000.00');
    await page.fill('[name="currency"]', 'USD');

    // Submit
    await page.click('button:has-text("Add Account")');

    // Should close modal and show success message
    await expect(page.locator('[data-testid="add-account-modal"]')).not.toBeVisible();
    await expect(page.locator('text=Account added successfully')).toBeVisible();

    // New account should appear in accounts list
    await expect(page.locator('text=Checking Account')).toBeVisible();
    await expect(page.locator('text=$5,000.00')).toBeVisible();
  });

  test('should upload and process a receipt', async ({ page }) => {
    // Go to transactions tab
    await page.click('[data-testid="tab-transactions"]');

    // Click upload receipt button
    await page.click('[data-testid="upload-receipt-button"]');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });

    // Should show processing state
    await expect(page.locator('text=Processing receipt...')).toBeVisible();

    // Wait for OCR processing (with timeout)
    await expect(page.locator('[data-testid="receipt-results"]')).toBeVisible({ timeout: 30000 });

    // Should show extracted data
    await expect(page.locator('[data-testid="extracted-merchant"]')).toBeVisible();
    await expect(page.locator('[data-testid="extracted-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="extracted-date"]')).toBeVisible();

    // Confirm transaction
    await page.click('button:has-text("Confirm Transaction")');

    // Should show success message
    await expect(page.locator('text=Transaction added successfully')).toBeVisible();
  });

  test('should create a monthly budget', async ({ page }) => {
    // Go to budgets tab
    await page.click('[data-testid="tab-budgets"]');

    // Click create budget button
    await page.click('[data-testid="create-budget-button"]');

    // Fill budget form
    await page.fill('[name="budgetName"]', 'Groceries Budget');
    await page.selectOption('[name="category"]', 'groceries');
    await page.fill('[name="amount"]', '500.00');
    await page.selectOption('[name="period"]', 'monthly');

    // Submit
    await page.click('button:has-text("Create Budget")');

    // Should show in budgets list
    await expect(page.locator('text=Groceries Budget')).toBeVisible();
    await expect(page.locator('text=$500.00')).toBeVisible();

    // Should show progress bar
    await expect(page.locator('[data-testid="budget-progress"]')).toBeVisible();
  });

  test('should filter transactions by date range', async ({ page }) => {
    await page.click('[data-testid="tab-transactions"]');

    // Open date range picker
    await page.click('[data-testid="date-range-filter"]');

    // Select last 30 days
    await page.click('text=Last 30 days');

    // Transactions should update
    await expect(page.locator('[data-testid="transactions-list"]')).toBeVisible();

    // Custom date range
    await page.click('[data-testid="date-range-filter"]');
    await page.click('text=Custom range');

    await page.fill('[name="startDate"]', '2025-01-01');
    await page.fill('[name="endDate"]', '2025-01-31');
    await page.click('button:has-text("Apply")');

    // Should show filtered results
    await expect(page.locator('[data-testid="date-range-label"]')).toContainText('Jan 1 - Jan 31');
  });

  test('should generate financial report', async ({ page }) => {
    // Go to reports tab
    await page.click('[data-testid="tab-reports"]');

    // Select report type
    await page.selectOption('[name="reportType"]', 'spending-by-category');
    await page.selectOption('[name="reportPeriod"]', 'last-month');

    // Generate report
    await page.click('button:has-text("Generate Report")');

    // Should show loading state
    await expect(page.locator('[data-testid="report-loading"]')).toBeVisible();

    // Report should load
    await expect(page.locator('[data-testid="report-chart"]')).toBeVisible({ timeout: 10000 });

    // Should have chart and summary
    await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();

    // Export button should be available
    await expect(page.locator('button:has-text("Export PDF")')).toBeVisible();
  });

  test('should connect a bank account via Plaid', async ({ page }) => {
    // Click connect bank button
    await page.click('[data-testid="connect-bank-button"]');

    // Plaid Link should open (iframe or popup)
    await page.waitForSelector('[data-testid="plaid-link"]', { timeout: 10000 });

    // Note: In real tests, you'd use Plaid sandbox credentials
    // For now, just check that the integration opened
    await expect(page.locator('[data-testid="plaid-link"]')).toBeVisible();
  });

  test('should categorize transactions', async ({ page }) => {
    await page.click('[data-testid="tab-transactions"]');

    // Click on uncategorized transaction
    await page.click('[data-testid="transaction-uncategorized"]').first();

    // Category dropdown should appear
    await page.click('[data-testid="category-select"]');
    await page.click('text=Groceries');

    // Should save automatically
    await expect(page.locator('text=Category updated')).toBeVisible();

    // Transaction should now show category
    await expect(page.locator('[data-category="groceries"]')).toBeVisible();
  });

  test('should show budget alerts when overspending', async ({ page }) => {
    await page.click('[data-testid="tab-budgets"]');

    // If a budget is exceeded, should show alert
    const overBudget = page.locator('[data-testid="budget-alert"]');

    if (await overBudget.isVisible()) {
      await expect(overBudget).toContainText('over budget');
      await expect(overBudget.locator('.alert-icon')).toBeVisible();

      // Click for details
      await overBudget.click();

      // Should show breakdown
      await expect(page.locator('[data-testid="overspending-details"]')).toBeVisible();
    }
  });
});
