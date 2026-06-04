/**
 * Phase 0 — live fresh-user journey against PRODUCTION.
 *
 * Registration → Persona Selection → Activation → Dashboard → First Insight →
 * First Chat. Mints a correctly-formatted @supabase/ssr session cookie (via the
 * library itself, so chunking/base64 match the server) and replays it against
 * the deployed app. No secrets in this file — all via env.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL,
 *      API_URL, PERSONA (optional, default married_family).
 */
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (process.env.APP_URL || '').replace(/\/$/, '');
const API = (process.env.API_URL || '').replace(/\/$/, '');
const PERSONA = process.env.PERSONA || 'married_family';

const out = (step, ok, detail) =>
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step.padEnd(34)} | ${detail}`);

const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
const email = `phase0-${PERSONA}-${Math.floor(Math.random() * 1e9)}@lifenav.test`;
const password = 'Phase0-Test-' + Math.floor(Math.random() * 1e9);
let userId = null;
let pass = 0,
  fail = 0;
const tally = (ok) => (ok ? pass++ : fail++);

async function main() {
  // 1) Registration (admin create, email pre-confirmed).
  let r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  let j = await r.json();
  userId = j.id;
  tally(r.ok && !!userId);
  out('1. Registration', r.ok && !!userId, `user ${userId || j.msg || JSON.stringify(j)}`);
  if (!userId) return finish();

  // 2) Sign in → session.
  r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await r.json();
  const haveSession = !!session.access_token;
  tally(haveSession);
  out('2. Login (session)', haveSession, haveSession ? 'access_token acquired' : JSON.stringify(session));
  if (!haveSession) return finish();

  // Mint the app session cookie using @supabase/ssr's own serializer.
  const jar = {};
  const client = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (jar[name] = value)),
    },
  });
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  const cookieHeader = Object.entries(jar)
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join('; ');
  const cookieOk = Object.keys(jar).some((n) => n.startsWith(`sb-${ref}-auth-token`));
  out('   (session cookie minted)', cookieOk, `${Object.keys(jar).length} cookie(s)`);

  const appGet = (path, opts = {}) =>
    fetch(`${APP}${path}`, { headers: { Cookie: cookieHeader, ...(opts.headers || {}) }, redirect: 'manual', ...opts });

  // 3) Persona selection — list available sample profiles.
  r = await appGet('/api/integrations/plaid/personas');
  j = await r.json().catch(() => ({}));
  const personaCount = Array.isArray(j.personas) ? j.personas.length : Array.isArray(j) ? j.length : 0;
  tally(r.status === 200 && personaCount > 0);
  out('3. Persona selection', r.status === 200 && personaCount > 0, `${r.status} · ${personaCount} personas`);

  // 4) Activation — server-side Plaid sandbox flow + persistence.
  r = await appGet('/api/integrations/plaid/activate-persona', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: PERSONA }),
  });
  j = await r.json().catch(() => ({}));
  const activated = r.status === 200 && j.success;
  tally(activated);
  out('4. Activation', activated, `${r.status} · ${j.accounts_linked ?? '?'} accounts, ${j.transactions_synced ?? '?'} txns`);

  // Give the persist/trigger a beat.
  await new Promise((s) => setTimeout(s, 1500));

  // 5) Dashboard + First Insight (server-rendered HTML on first paint).
  r = await appGet('/dashboard');
  const html = await r.text().catch(() => '');
  const reachedDashboard = r.status === 200;
  const hasBrief = /Today&rsquo;s brief|Today.s brief|Governed/.test(html);
  // Pull the headline out of the server HTML for evidence.
  const m = html.match(/text-xl sm:text-2xl font-semibold[^>]*>([^<]{8,200})</);
  const headline = m ? m[1].trim() : '(headline not located in HTML)';
  tally(reachedDashboard);
  out('5. Dashboard reachable', reachedDashboard, `${r.status}${r.status >= 300 ? ' → ' + (r.headers.get('location') || '') : ''}`);
  tally(hasBrief);
  out('6. First Insight rendered', hasBrief, hasBrief ? `“${headline}”` : 'no brief card in server HTML');

  // 7) Accounts route reads persisted finance data.
  r = await appGet('/api/integrations/plaid/accounts');
  j = await r.json().catch(() => ({}));
  const accts = Array.isArray(j.accounts) ? j.accounts.length : 0;
  tally(r.status === 200 && accts > 0);
  out('7. Accounts populated', r.status === 200 && accts > 0, `${r.status} · ${accts} accounts`);

  // 8) First chat — governed conversation (cookie-authed Next.js route, the
  //    same path the ChatSidebar uses). Non-streaming for a clean JSON read.
  try {
    r = await appGet('/api/agent/chat', {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What should I focus on first with my money?' }),
      signal: AbortSignal.timeout(45000),
    });
    const ct = r.headers.get('content-type') || '';
    const cj = ct.includes('json') ? await r.json().catch(() => ({})) : {};
    const replyLen = (cj.message || cj.text || '').length;
    const chatOk = (r.status === 200 || r.status === 201) && (replyLen > 0 || !!cj.message);
    tally(chatOk);
    out('8. First chat (governed)', chatOk, `${r.status} · ${chatOk ? `governed reply (${replyLen} chars)` : JSON.stringify(cj).slice(0, 120)}`);
  } catch (e) {
    tally(false);
    out('8. First chat (governed)', false, `error: ${e.message}`);
  }

  finish();
}

function finish() {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  console.log(`CLEANUP_USER_ID=${userId || ''}`);
  console.log(`CLEANUP_EMAIL=${email}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('JOURNEY ERROR:', e);
  finish();
});
