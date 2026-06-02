#!/usr/bin/env node
/**
 * verify-governance.ts — Sprint T Phase 5.
 *
 * Static guarantor that no AI-output-producing route can ship without
 * runtime governance enforcement.
 *
 * The 13-step constitutional engine and the character layer only work
 * if every route that emits LLM-generated text passes through them.
 * Before Sprint T this was a convention enforced by code review; the
 * audit found the streaming chat bypass. This script makes the
 * convention mechanical: violations fail CI like a type error.
 *
 * Algorithm:
 *
 *   1. Walk apps/web/src/app/api/ recursively, collecting every
 *      `route.ts`.
 *   2. For each route, parse its source. Classify it as model-facing
 *      if it matches ANY of:
 *        - imports from a known AI-provider client
 *          (gemini, openai, anthropic, azure-openai, /llm/, /providers/)
 *        - calls a known model-call helper
 *        - fetches a `functions/v1/graphrag-query` or similar
 *      AND it exports a handler (POST | PUT | PATCH | DELETE | GET).
 *   3. For each model-facing route, require that it EITHER:
 *        - exports its handler via `createGovernedHandler(...)` from
 *          `@/lib/governance/governed-route`, OR
 *        - directly invokes `guardOutgoing` OR `reviewAndPersist` in
 *          the same file (the legacy pattern; legal but discouraged).
 *   4. Routes flagged as model-facing but missing both patterns are
 *      reported as violations.
 *   5. Exit non-zero on any violation.
 *
 * Allow-list: routes that are model-facing for orchestration purposes
 * but where the LLM output is governed downstream (e.g. an enqueue-only
 * route) can be excluded by adding their path to `ALLOWLIST` below
 * with a one-line justification.
 *
 * Run:  pnpm run verify:governance
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.join(ROOT, 'src', 'app', 'api');

// --------------------------------------------------------------------------
// Heuristics — keep narrow so we don't over-report.
// --------------------------------------------------------------------------

const PROVIDER_IMPORT_PATTERNS = [
  /@google\/generative-ai/,
  /@anthropic-ai\/sdk/,
  /openai/,
  /@azure\/openai/,
  /\/lib\/providers\//,
  /\/lib\/llm\//,
  /\/lib\/ai\//,
  /\/lib\/gemini\//,
  /lib\/openai/,
];

const MODEL_CALL_PATTERNS = [
  /generateContent\(/,
  /chat\.completions\.create\(/,
  /messages\.create\(/,
  /streamText\(/,
  /\.generate\(/,
  /functions\/v1\/graphrag-query/,
  /functions\/v1\/agent-/,
];

const HANDLER_EXPORT = /export\s+(?:async\s+)?(?:const|function|let)\s+(POST|GET|PUT|PATCH|DELETE)/;

const GOVERNED_HANDLER = /createGovernedHandler\s*[<(]/;
const GUARD_OUTGOING = /\bguardOutgoing\s*\(/;
const REVIEW_AND_PERSIST = /\breviewAndPersist\s*\(/;
const VALIDATE_AND_PERSIST_LEGACY = /\bvalidateAndPersist\s*\(/;

// --------------------------------------------------------------------------
// Allow-list — paths relative to apps/web. Every entry MUST carry a reason.
// --------------------------------------------------------------------------

const ALLOWLIST: Array<{ path: string; reason: string }> = [
  // Routes that proxy or enqueue work but do not directly emit AI text
  // to the client. The downstream worker / Edge Function carries the
  // governance call.
  {
    path: 'src/app/api/scenario-lab/versions/[versionId]/simulate/route.ts',
    reason: 'enqueues Monte Carlo job; calls guardOutgoing on the enqueue path',
  },
  {
    path: 'src/app/api/scenario-lab/reports/generate/route.ts',
    reason: 'enqueues report job; LLM output passes through worker governance',
  },
  {
    path: 'src/app/api/scenario-lab/versions/[versionId]/plan/route.ts',
    reason: 'enqueues planner job; LLM output passes through worker governance',
  },
];

// --------------------------------------------------------------------------

interface RouteFinding {
  path: string;
  model_facing: boolean;
  governed: boolean;
  uses_factory: boolean;
  uses_guard_outgoing: boolean;
  uses_review_and_persist: boolean;
  uses_legacy_validate: boolean;
  handler_methods: string[];
  matched_patterns: string[];
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && entry.name === 'route.ts') out.push(p);
  }
  return out;
}

function classify(filePath: string): RouteFinding {
  const src = fs.readFileSync(filePath, 'utf8');
  const matched_patterns: string[] = [];

  const has_provider_import = PROVIDER_IMPORT_PATTERNS.some((re) => {
    if (re.test(src)) { matched_patterns.push(`import:${re.source}`); return true; }
    return false;
  });
  const has_model_call = MODEL_CALL_PATTERNS.some((re) => {
    if (re.test(src)) { matched_patterns.push(`call:${re.source}`); return true; }
    return false;
  });

  const handler_methods: string[] = [];
  for (const m of src.matchAll(new RegExp(HANDLER_EXPORT, 'g'))) {
    if (m[1]) handler_methods.push(m[1]);
  }

  const uses_factory = GOVERNED_HANDLER.test(src);
  const uses_guard_outgoing = GUARD_OUTGOING.test(src);
  const uses_review_and_persist = REVIEW_AND_PERSIST.test(src);
  const uses_legacy_validate = VALIDATE_AND_PERSIST_LEGACY.test(src);

  const model_facing = (has_provider_import || has_model_call) && handler_methods.length > 0;
  const governed = uses_factory || uses_guard_outgoing || uses_review_and_persist;

  return {
    path: path.relative(ROOT, filePath),
    model_facing, governed,
    uses_factory, uses_guard_outgoing, uses_review_and_persist, uses_legacy_validate,
    handler_methods, matched_patterns,
  };
}

function isAllowlisted(rel: string): { allowed: boolean; reason?: string } {
  for (const a of ALLOWLIST) {
    if (a.path === rel) return { allowed: true, reason: a.reason };
  }
  return { allowed: false };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

export interface VerifyResult {
  scanned: number;
  model_facing: number;
  factory: number;
  guard_outgoing: number;
  review_persist: number;
  violations: RouteFinding[];
  legacy_warnings: RouteFinding[];
}

export function runVerify(apiRoot: string, allowlist: ReadonlyArray<{ path: string; reason: string }> = ALLOWLIST): VerifyResult {
  if (!fs.existsSync(apiRoot)) {
    throw new Error(`verify-governance: API root not found at ${apiRoot}`);
  }
  const routes = walk(apiRoot).sort();
  const findings = routes.map((p) => classifyAt(p, apiRoot));
  const violations: RouteFinding[] = [];
  const legacy_warnings: RouteFinding[] = [];
  const al = new Set(allowlist.map((a) => a.path));
  for (const f of findings) {
    if (!f.model_facing) continue;
    if (al.has(f.path)) continue;
    if (!f.governed) violations.push(f);
    else if (f.uses_legacy_validate && !f.uses_factory && !f.uses_review_and_persist) legacy_warnings.push(f);
  }
  return {
    scanned: routes.length,
    model_facing: findings.filter((f) => f.model_facing).length,
    factory: findings.filter((f) => f.uses_factory).length,
    guard_outgoing: findings.filter((f) => f.uses_guard_outgoing).length,
    review_persist: findings.filter((f) => f.uses_review_and_persist).length,
    violations, legacy_warnings,
  };
}

function classifyAt(filePath: string, root: string): RouteFinding {
  const f = classify(filePath);
  return { ...f, path: path.relative(root, filePath) };
}

function main(): number {
  if (!fs.existsSync(API_ROOT)) {
    console.error(`verify-governance: API root not found at ${API_ROOT}`);
    return 1;
  }
  const routes = walk(API_ROOT).sort();

  const findings = routes.map(classify);
  const violations: RouteFinding[] = [];
  const legacy_warnings: RouteFinding[] = [];

  for (const f of findings) {
    if (!f.model_facing) continue;
    const allow = isAllowlisted(f.path);
    if (allow.allowed) continue;
    if (!f.governed) {
      violations.push(f);
    } else if (f.uses_legacy_validate && !f.uses_factory && !f.uses_review_and_persist) {
      legacy_warnings.push(f);
    }
  }

  // ---- Report ----
  console.log(`verify-governance: scanned ${routes.length} routes`);
  console.log(`  model-facing : ${findings.filter((f) => f.model_facing).length}`);
  console.log(`  factory      : ${findings.filter((f) => f.uses_factory).length}`);
  console.log(`  guard-outgoing: ${findings.filter((f) => f.uses_guard_outgoing).length}`);
  console.log(`  review-persist: ${findings.filter((f) => f.uses_review_and_persist).length}`);
  console.log(`  allowlisted  : ${ALLOWLIST.length}`);
  console.log();

  if (legacy_warnings.length > 0) {
    console.log('WARNING: legacy Sprint L validateAndPersist (no L2 constitutional + N.3 character):');
    for (const f of legacy_warnings) {
      console.log(`  ${f.path} — migrate to reviewAndPersist or createGovernedHandler`);
    }
    console.log();
  }

  if (violations.length === 0) {
    console.log('verify-governance: OK — every model-facing route is governed.');
    return 0;
  }

  console.error(`verify-governance: ${violations.length} VIOLATION(S)`);
  console.error('  Every model-facing route MUST either:');
  console.error('    (a) export its handler via createGovernedHandler(...) from @/lib/governance/governed-route, OR');
  console.error('    (b) directly call guardOutgoing(...) or reviewAndPersist(...) before returning.');
  console.error('  See lib/governance/governed-route.ts for the canonical pattern.');
  console.error('');
  for (const v of violations) {
    console.error(`  ✗ ${v.path}`);
    console.error(`      methods: ${v.handler_methods.join(',')}`);
    console.error(`      matched: ${v.matched_patterns.slice(0, 3).join(', ')}`);
  }
  console.error('');
  console.error('  If a route is genuinely not model-facing (e.g. an enqueue path), add it');
  console.error('  to ALLOWLIST in scripts/verify-governance.ts with a one-line reason.');
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
