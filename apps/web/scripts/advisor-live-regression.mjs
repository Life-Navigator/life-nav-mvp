/**
 * LIVE advisor LLM-path regression (RELEASE_HARDENING item 1).
 *
 * Proves the DEPLOYED web path actually invokes the model provider as the NON-ROOT runtime — i.e. it would
 * have caught the Fly /.fly/api socket-permission outage that silently degraded every advisor turn.
 *
 * HARD FAIL (exit 1) if the advisor falls back for an INFRASTRUCTURE reason: auth/socket/WIF, provider
 * timeout, provider error, or no model execution. A content trust-spine/policy fallback is NOT a failure
 * (the LLM ran and the gate did its job) but is reported.
 *
 * Env: SMOKE_BASE_URL (default https://lifenavigator.tech), SMOKE_EMAIL, SMOKE_PASSWORD
 *      (SMOKE_PASSWORD falls back to /tmp/ui-smoke/pw.txt for local runs).
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.SMOKE_BASE_URL || 'https://lifenavigator.tech';
const EMAIL = process.env.SMOKE_EMAIL || 'techavenger83@gmail.com';
let PASSWORD = process.env.SMOKE_PASSWORD || '';
if (!PASSWORD && fs.existsSync('/tmp/ui-smoke/pw.txt')) PASSWORD = fs.readFileSync('/tmp/ui-smoke/pw.txt', 'utf8').trim();
const INFRA_CAUSES = ['infrastructure_auth', 'provider_timeout', 'provider_error', 'malformed_output'];
// Non-numeric, low-variance prompt that should reliably ENHANCE when the LLM runs.
const PROMPT = 'How can I get promoted faster in my current career? Give me a concrete plan.';

function fail(msg) { console.error('❌ REGRESSION FAIL: ' + msg); process.exit(1); }

const b = await chromium.launch();
try {
  const c = await b.newContext();
  const p = await c.newPage();
  await p.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(2000);
  await p.fill('input[type="email"]', EMAIL).catch(() => {});
  await p.fill('input[type="password"]', PASSWORD).catch(() => {});
  await p.click('button[type="submit"]').catch(() => {});
  await p.waitForTimeout(6000);
  if (/\/auth/i.test(p.url())) fail('login failed (still on /auth) — check SMOKE_EMAIL/SMOKE_PASSWORD');

  const t0 = Date.now();
  const r = await c.request.post(BASE + '/api/chat/advisor',
    { data: { message: PROMPT, agent: 'relationship_manager' }, headers: { 'content-type': 'application/json' }, timeout: 200000 });
  const dt = Date.now() - t0;
  if (r.status() !== 200) fail('HTTP ' + r.status());
  const j = await r.json();
  console.log('llm_status      :', j.llm_status);
  console.log('provider        :', j.provider, '| model:', j.model);
  console.log('provider_called :', j.provider_called, '| fallback_cause:', j.fallback_cause || '(none)');
  console.log('route_path      :', j.route_path, '| latency_ms:', j.latency_ms, '| wall:', dt + 'ms');

  // HARD gates — these catch the socket/WIF/infra regression class.
  if (j.provider_called !== true) fail('provider_called !== true (model never invoked)');
  if (!j.model || !j.provider) fail('missing model/provider metadata (provider not really called)');
  if (INFRA_CAUSES.includes(j.fallback_cause)) fail('infrastructure fallback cause: ' + j.fallback_cause);
  if (j.llm_status === 'fallback:unavailable') fail('llm_status=fallback:unavailable (auth/socket/provider down)');
  if (!(j.latency_ms > 0)) fail('latency not recorded');

  if (j.llm_status === 'enhanced') {
    console.log('\n✅ PASS — live web path invoked the LLM and returned an enhanced answer.');
  } else {
    // content gate fired (trust spine / policy) — the LLM DID run; not an infra failure.
    console.log('\n✅ PASS (LLM ran; non-infra content fallback: ' + (j.fallback_cause || j.llm_status) + ').');
  }
} finally {
  await b.close();
}
