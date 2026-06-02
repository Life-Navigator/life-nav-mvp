/**
 * @jest-environment node
 *
 * Sprint T Phase 5 — proves the static governance verifier catches
 * the kind of bypass the Sprint S audit found.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runVerify } from '../../../../scripts/verify-governance';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'verify-gov-'));
}

function writeRoute(root: string, rel: string, src: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, src, 'utf8');
}

describe('verify-governance', () => {
  test('flags a bypass route: AI-fetching POST without guardOutgoing', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'bypass/route.ts',
      `
      import { NextResponse } from 'next/server';
      export async function POST() {
        const r = await fetch('https://x/functions/v1/graphrag-query');
        return NextResponse.json({ text: await r.text() });
      }
    `
    );
    const r = runVerify(root, []);
    expect(r.scanned).toBe(1);
    expect(r.model_facing).toBe(1);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0].path).toContain('bypass/route.ts');
  });

  test('passes a route that calls createGovernedHandler', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'chat/route.ts',
      `
      import { createGovernedHandler } from '@/lib/governance/governed-route';
      export const POST = createGovernedHandler({
        emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
        subjectKind: 'advisor_message', feature_key: 'chat',
        async produce({ accumulator }) {
          const r = await fetch('/functions/v1/graphrag-query');
          accumulator.append(await r.text());
          return { text: accumulator.text(), streaming: true };
        },
      });
    `
    );
    const r = runVerify(root, []);
    expect(r.model_facing).toBe(1);
    expect(r.factory).toBe(1);
    expect(r.violations.length).toBe(0);
  });

  test('passes a legacy route that calls guardOutgoing directly', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'rec/route.ts',
      `
      import { guardOutgoing } from '@/lib/governance/route-guard';
      export async function POST() {
        const r = await fetch('https://x/functions/v1/graphrag-query');
        const text = await r.text();
        const g = await guardOutgoing({ supabase: {}, user_id: 'u', subject: { kind: 'recommendation', text } });
        if (!g.ok) return g.response;
        return new Response(JSON.stringify({ text }));
      }
    `
    );
    const r = runVerify(root, []);
    expect(r.violations.length).toBe(0);
    expect(r.guard_outgoing).toBe(1);
  });

  test('legacy Sprint L validateAndPersist alone is a violation (no L2/N.3 coverage)', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'old/route.ts',
      `
      import { validateAndPersist } from '@/lib/governance/middleware';
      import { generateContent } from '@google/generative-ai';
      export async function POST() {
        const out = await generateContent({});
        const d = await validateAndPersist({ subject: { text: out } });
        return new Response(JSON.stringify(d));
      }
    `
    );
    const r = runVerify(root, []);
    // validateAndPersist is the pre-L2 Sprint L policy engine. It does
    // NOT count as governed — only factory, guardOutgoing, or
    // reviewAndPersist do. The route is flagged.
    expect(r.violations.length).toBe(1);
  });

  test('allowlist suppresses a violation', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'enqueue/route.ts',
      `
      export async function POST() {
        const r = await fetch('/functions/v1/agent-job');
        return new Response(await r.text());
      }
    `
    );
    const r1 = runVerify(root, []);
    expect(r1.violations.length).toBe(1);
    const r2 = runVerify(root, [
      { path: 'enqueue/route.ts', reason: 'enqueue-only; downstream worker governs' },
    ]);
    expect(r2.violations.length).toBe(0);
  });

  test('a non-model route (just DB CRUD) is not flagged', () => {
    const root = makeRoot();
    writeRoute(
      root,
      'goals/route.ts',
      `
      import { NextResponse } from 'next/server';
      export async function GET() { return NextResponse.json({ goals: [] }); }
    `
    );
    const r = runVerify(root, []);
    expect(r.model_facing).toBe(0);
    expect(r.violations.length).toBe(0);
  });
});
