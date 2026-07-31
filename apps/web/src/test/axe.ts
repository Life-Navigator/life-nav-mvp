/**
 * Reusable component accessibility helper (R-3 slice 3C).
 *
 * WHAT THIS PROVES: no *automatically detectable* serious/critical WCAG violations in the rendered
 * DOM. Automated axe catches roughly a third of real accessibility problems.
 *
 * WHAT IT DOES NOT PROVE: keyboard operability, focus order, screen-reader comprehensibility, or
 * that the workflow is usable by an actual assistive-technology user. Those are covered by the
 * explicit focus/keyboard tests alongside these, and ultimately by manual verification. This is
 * NOT WCAG certification.
 */
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

/** Assert zero serious/critical axe findings. Minor/moderate are reported but not failed. */
export async function expectNoSeriousA11yViolations(container: Element): Promise<void> {
  const results = await axe(container);
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  if (blocking.length > 0) {
    const detail = blocking
      .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`Serious/critical accessibility violations:\n${detail}`);
  }
}
