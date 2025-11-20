import { test, expect } from '@playwright/test';

/**
 * Health Module E2E Tests
 *
 * Tests health module functionality:
 * 1. Adding medications
 * 2. Tracking health metrics
 * 3. Logging health conditions
 * 4. Viewing health timeline
 * 5. Syncing wearable data
 */

async function loginAsUser(page: any) {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe('Health Module', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/health');
  });

  test('should add a new medication', async ({ page }) => {
    // Click add medication button
    await page.click('[data-testid="add-medication-button"]');

    // Modal should open
    await expect(page.locator('[data-testid="add-medication-modal"]')).toBeVisible();

    // Fill medication details
    await page.fill('[name="medicationName"]', 'Lisinopril');
    await page.fill('[name="dosage"]', '10mg');
    await page.selectOption('[name="frequency"]', 'daily');
    await page.fill('[name="timeOfDay"]', '09:00');

    // Add notes
    await page.fill('[name="notes"]', 'Take with food');

    // Submit
    await page.click('button:has-text("Add Medication")');

    // Should close modal
    await expect(page.locator('[data-testid="add-medication-modal"]')).not.toBeVisible();

    // Medication should appear in list
    await expect(page.locator('text=Lisinopril')).toBeVisible();
    await expect(page.locator('text=10mg')).toBeVisible();
    await expect(page.locator('text=Daily')).toBeVisible();
  });

  test('should track blood pressure reading', async ({ page }) => {
    // Go to metrics tab
    await page.click('[data-testid="tab-metrics"]');

    // Click add reading
    await page.click('[data-testid="add-metric-button"]');

    // Select blood pressure
    await page.selectOption('[name="metricType"]', 'blood_pressure');

    // Fill values
    await page.fill('[name="systolic"]', '120');
    await page.fill('[name="diastolic"]', '80');
    await page.fill('[name="pulse"]', '72');

    // Add timestamp
    const now = new Date().toISOString().slice(0, 16);
    await page.fill('[name="timestamp"]', now);

    // Submit
    await page.click('button:has-text("Save Reading")');

    // Should show in metrics list
    await expect(page.locator('text=120/80')).toBeVisible();
    await expect(page.locator('text=72 bpm')).toBeVisible();
  });

  test('should log a health condition', async ({ page }) => {
    // Go to conditions tab
    await page.click('[data-testid="tab-conditions"]');

    // Add condition
    await page.click('[data-testid="add-condition-button"]');

    // Fill condition form
    await page.fill('[name="conditionName"]', 'Seasonal Allergies');
    await page.selectOption('[name="severity"]', 'mild');
    await page.fill('[name="diagnosedDate"]', '2024-03-15');
    await page.fill('[name="symptoms"]', 'Sneezing, runny nose');

    // Submit
    await page.click('button:has-text("Add Condition")');

    // Should appear in conditions list
    await expect(page.locator('text=Seasonal Allergies')).toBeVisible();
    await expect(page.locator('[data-severity="mild"]')).toBeVisible();
  });

  test('should view health timeline', async ({ page }) => {
    // Go to timeline tab
    await page.click('[data-testid="tab-timeline"]');

    // Timeline should be visible
    await expect(page.locator('[data-testid="health-timeline"]')).toBeVisible();

    // Should have timeline events (or empty state)
    const timelineEvents = page.locator('[data-testid="timeline-event"]');
    const count = await timelineEvents.count();

    if (count > 0) {
      // Check first event
      const firstEvent = timelineEvents.first();
      await expect(firstEvent.locator('.event-date')).toBeVisible();
      await expect(firstEvent.locator('.event-type')).toBeVisible();
      await expect(firstEvent.locator('.event-description')).toBeVisible();
    } else {
      await expect(page.locator('text=No health events recorded')).toBeVisible();
    }
  });

  test('should set medication reminders', async ({ page }) => {
    // Find a medication in the list
    const medication = page.locator('[data-testid="medication-item"]').first();

    if (await medication.isVisible()) {
      // Click settings/options button
      await medication.locator('[data-testid="medication-options"]').click();

      // Click set reminder
      await page.click('text=Set Reminder');

      // Enable reminder
      await page.check('[name="enableReminder"]');

      // Set reminder time
      await page.fill('[name="reminderTime"]', '09:00');

      // Enable notifications
      await page.check('[name="enableNotifications"]');

      // Save
      await page.click('button:has-text("Save Reminder")');

      // Should show success message
      await expect(page.locator('text=Reminder set successfully')).toBeVisible();

      // Reminder icon should appear on medication
      await expect(medication.locator('[data-testid="reminder-icon"]')).toBeVisible();
    }
  });

  test('should track symptoms over time', async ({ page }) => {
    // Go to symptoms tab
    await page.click('[data-testid="tab-symptoms"]');

    // Log a symptom
    await page.click('[data-testid="log-symptom-button"]');

    await page.fill('[name="symptom"]', 'Headache');
    await page.selectOption('[name="severity"]', 'moderate');
    await page.fill('[name="duration"]', '2');
    await page.selectOption('[name="durationUnit"]', 'hours');

    await page.click('button:has-text("Log Symptom")');

    // Should appear in symptom log
    await expect(page.locator('text=Headache')).toBeVisible();

    // View symptom trends
    await page.click('[data-testid="view-trends-button"]');

    // Chart should be visible
    await expect(page.locator('[data-testid="symptom-chart"]')).toBeVisible();
  });

  test('should sync wearable data', async ({ page }) => {
    // Go to integrations
    await page.click('[data-testid="health-settings"]');
    await page.click('[data-testid="tab-integrations"]');

    // Should show wearable options
    await expect(page.locator('text=Apple Health')).toBeVisible();
    await expect(page.locator('text=Google Fit')).toBeVisible();
    await expect(page.locator('text=Fitbit')).toBeVisible();

    // Click connect Apple Health (if not connected)
    const appleHealthButton = page.locator('[data-testid="connect-apple-health"]');

    if (await appleHealthButton.isVisible()) {
      await appleHealthButton.click();

      // Authorization flow (platform-specific)
      // In real tests, this would trigger native auth
      await expect(page.locator('text=Connecting to Apple Health')).toBeVisible();
    }
  });

  test('should generate health report', async ({ page }) => {
    // Go to reports
    await page.click('[data-testid="tab-reports"]');

    // Select report type
    await page.selectOption('[name="reportType"]', 'monthly-summary');

    // Generate
    await page.click('button:has-text("Generate Report")');

    // Report should load
    await expect(page.locator('[data-testid="health-report"]')).toBeVisible();

    // Should include key metrics
    await expect(page.locator('[data-testid="avg-blood-pressure"]')).toBeVisible();
    await expect(page.locator('[data-testid="medication-adherence"]')).toBeVisible();
    await expect(page.locator('[data-testid="symptom-frequency"]')).toBeVisible();

    // Export option
    await expect(page.locator('button:has-text("Export PDF")')).toBeVisible();
  });
});
