/**
 * Playwright accessibility helper (R-3 slice 3C).
 *
 * NOT RUN AGAINST A DEPLOYMENT in this session — there is no authenticated target available. The
 * helper and its configuration are validated; any result produced with mocked routes is
 * MOCKED-BROWSER EVIDENCE, never deployed-browser evidence.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectNoSeriousA11yViolations(page: Page, selector?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (selector) builder = builder.include(selector);
  const results = await builder.analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(blocking, blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n')).toEqual([]);
}
