/**
 * @jest-environment node
 *
 * CI-side governed-prompt enforcement.
 *
 * Re-runs the bash check (single source of truth) and fails the
 * suite if any violation appears. This means a PR that introduces a
 * raw BYOM provider import will fail the test run, not just the bash
 * CI step — useful for local TDD.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.resolve(
  __dirname,
  '../../../../scripts/validation/check_governed_prompt_enforcement.sh'
);

describe('governed-prompt enforcement', () => {
  test('no production route imports a BYOM provider without buildGovernedPrompt or exemption', () => {
    let stdout = '';
    try {
      stdout = execFileSync('bash', [SCRIPT], { encoding: 'utf8' });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      throw new Error(
        'governed-prompt enforcement check failed:\n' + (e.stdout ?? '') + (e.stderr ?? '')
      );
    }
    expect(stdout.trim()).toMatch(/governed-prompt enforcement: OK/);
  });
});
