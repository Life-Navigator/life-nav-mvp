// PHASE 0.5 — Founder Journey Validation.
// Drives the REAL deployed app end-to-end for 3 fresh users (A/B/C), each on a
// distinct persona, and prints a Pass/Fail matrix. No mocks, no type-checks.
//
// Email verification is REAL: we use the Supabase admin generate_link API to get
// the actual signup confirmation URL and follow it through the app's /auth/confirm,
// then confirm server-side that email_confirmed_at is set.
//
// Run from apps/web:  node founder-journey.mjs
// Requires apps/web/.env.local with:
//   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
//   SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
//   SUPABASE_SERVICE_ROLE_KEY
//   APP_URL  (the deployed base URL, e.g. https://app.lifenavigator.tech)
// Optional: TEST_EMAIL_DOMAIN (default lifenav.test), KEEP_USERS=1 (skip cleanup)

import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';

// ---- env loading (.env.local) -------------------------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env.local — rely on shell env */
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || '').replace(/\/$/, '');
const EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN || 'lifenav.test';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!ANON) missing.push('SUPABASE_ANON_KEY');
if (!SERVICE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!APP) missing.push('APP_URL');
if (missing.length) {
  console.error(`\nMISSING ENV: ${missing.join(', ')}\nAdd them to apps/web/.env.local and re-run.\n`);
  process.exit(2);
}

const USERS = [
  { id: 'A', persona: 'young_professional' },
  { id: 'B', persona: 'married_family' },
  { id: 'C', persona: 'high_income_executive' },
];

const sAdmin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

// ---- low-level helpers --------------------------------------------------------
async function generateSignupLink(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: sAdmin,
    body: JSON.stringify({ type: 'signup', email, password, redirect_to: `${APP}/auth/confirm` }),
  });
  const j = await r.json().catch(() => ({}));
  return {
    ok: r.ok,
    status: r.status,
    link: j.action_link || j.properties?.action_link || null,
    uid: j.id || j.user?.id || j.user_id || j.properties?.user_id || null,
    raw: j,
  };
}
async function getUser(uid) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { headers: sAdmin });
  return r.ok ? r.json() : null;
}
async function deleteUser(uid) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: sAdmin }).catch(() => {});
}
async function cookieFor(email, password) {
  const session = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();
  if (!session?.access_token) return null;
  const jar = {};
  const c = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => (jar[name] = value)),
    },
  });
  await c.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  return Object.entries(jar).map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
}
async function appGet(path, cookie, manual = false) {
  try {
    const r = await fetch(`${APP}${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: manual ? 'manual' : 'follow',
      signal: AbortSignal.timeout(45000),
    });
    return r;
  } catch (e) {
    return { status: 0, headers: new Map(), _err: e?.message, json: async () => ({}), text: async () => '' };
  }
}
async function appPost(path, cookie, body) {
  try {
    return await fetch(`${APP}${path}`, {
      method: 'POST',
      headers: { Cookie: cookie || '', 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(70000),
    });
  } catch (e) {
    return { status: 0, _err: e?.message, json: async () => ({}) };
  }
}

// ---- the journey for one user -------------------------------------------------
async function runUser(u) {
  const email = `founder-${u.id.toLowerCase()}-${Date.now()}@${EMAIL_DOMAIN}`;
  const password = `Founder-${u.id}-${Math.floor(Math.random() * 1e9)}!`;
  const steps = {};
  const rec = (k, pass, detail) => { steps[k] = { pass: !!pass, detail }; console.error(`  ${u.id} ${k}: ${pass ? 'PASS' : 'FAIL'} — ${detail}`); };
  let uid = null, cookie = null;

  // 1. Signup (admin generate_link creates the user + returns the real confirm URL)
  const gl = await generateSignupLink(email, password);
  uid = gl.uid;
  rec('Signup', gl.ok && !!gl.link, gl.ok ? `user created, confirm link issued (uid=${uid || '?'})` : `generate_link ${gl.status}: ${JSON.stringify(gl.raw).slice(0, 160)}`);

  // 2. Verify Email — follow the REAL link, then confirm server-side
  if (gl.link) {
    try {
      const vr = await fetch(gl.link, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
      // Supabase verify → 303 to APP/auth/confirm?…; follow that to exercise the app route too.
      const loc = vr.headers.get('location');
      if (loc) await fetch(loc, { redirect: 'manual', signal: AbortSignal.timeout(30000) }).catch(() => {});
    } catch { /* fall through to server-side check */ }
    if (!uid) {
      // resolve uid by email if generate_link didn't return it
      const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: sAdmin }).then((r) => r.json()).catch(() => ({}));
      uid = list?.users?.[0]?.id || list?.[0]?.id || null;
    }
    const user = uid ? await getUser(uid) : null;
    const confirmed = !!(user?.email_confirmed_at || user?.confirmed_at);
    rec('Verify Email', confirmed, confirmed ? 'email_confirmed_at set after following link' : 'email not confirmed after link');
  } else {
    rec('Verify Email', false, 'no confirmation link to follow');
  }

  // session cookie for the rest of the journey
  cookie = await cookieFor(email, password);
  if (!cookie) {
    ['Select Persona','Advisor Starts','Advisor Completes','Dashboard Loads','Finance Loads','Accounts Loads','Transactions Load','Investments Load','Retirement Load','Recommendations Load','My Life Loads']
      .forEach((k) => rec(k, false, 'no session (login failed)'));
    return { user: u, email, uid, steps };
  }

  // 3. Select Persona (real Plaid sandbox activation on the deployment)
  const ap = await appPost('/api/integrations/plaid/activate-persona', cookie, { persona_id: u.persona });
  const apj = await ap.json?.().catch(() => ({})) || {};
  rec('Select Persona', ap.status === 200 && (apj.success || apj.accounts_linked > 0), `activate-persona ${ap.status} (${u.persona}) accounts=${apj.accounts_linked ?? '?'}`);
  await new Promise((s) => setTimeout(s, 1500)); // let persistence/graph settle

  // 4. Advisor Starts — the gate must bounce /dashboard → /dashboard/advisor
  const d0 = await appGet('/dashboard', cookie, true);
  const d0loc = d0.headers.get ? d0.headers.get('location') : null;
  rec('Advisor Starts', !!d0loc && /\/dashboard\/advisor/.test(d0loc), `GET /dashboard → ${d0.status} ${d0loc || '(no redirect)'}`);

  // 5. Advisor Completes — open a turn, then mark complete; gate must then open
  const chat = await appPost('/api/life/discovery-chat', cookie, { message: 'I want to retire comfortably.', pending_key: '' });
  const done = await appPost('/api/onboarding/advisor-complete', cookie, { skip: false });
  rec('Advisor Completes', chat.status === 200 && done.status === 200, `discovery-chat ${chat.status}, advisor-complete ${done.status}`);

  // 6. Dashboard Loads — now no redirect
  const d1 = await appGet('/dashboard', cookie, true);
  rec('Dashboard Loads', d1.status === 200, `GET /dashboard → ${d1.status}`);

  // 7. Finance Loads — canonical summary with a numeric net worth
  const fin = await appGet('/api/finance/canonical-summary', cookie);
  const finj = await fin.json?.().catch(() => ({})) || {};
  rec('Finance Loads', fin.status === 200 && typeof finj.net_worth === 'number', `canonical-summary ${fin.status} net_worth=${finj.net_worth ?? '?'}`);

  // 8. Accounts Loads — /api/financial returns accounts (nested or top-level)
  const acc = await appGet('/api/financial?timeframe=month', cookie);
  const accj = await acc.json?.().catch(() => ({})) || {};
  const accList = accj.accounts || accj.data?.accounts || [];
  rec('Accounts Loads', acc.status === 200 && accList.length > 0, `/api/financial ${acc.status} accounts=${accList.length}`);

  // 9. Transactions Load
  const txj = accj.transactions || accj.data?.transactions || null;
  let txPass = Array.isArray(txj) ? txj.length > 0 : !!txj;
  let txDetail = `from /api/financial: ${Array.isArray(txj) ? txj.length : typeof txj}`;
  if (!txPass) {
    const tx2 = await appGet('/api/data/financial/transactions', cookie);
    const tx2j = await tx2.json?.().catch(() => ({})) || {};
    const arr = tx2j.transactions || tx2j.data || [];
    txPass = tx2.status === 200 && arr.length > 0;
    txDetail = `/api/data/financial/transactions ${tx2.status} count=${arr.length}`;
  }
  rec('Transactions Load', txPass, txDetail);

  // 10. Investments Load — real endpoint: 200 + honest shape (holdings is an array,
  //     never fabricated). Reports the canonical account-level balance.
  const inv = await appGet('/api/investments/analytics', cookie);
  const invj = (await inv.json?.().catch(() => ({}))) || {};
  rec(
    'Investments Load',
    inv.status === 200 && Array.isArray(invj.holdings),
    `analytics ${inv.status} status=${invj.status} total=${invj.totalInvestmentBalance} accounts=${invj.accountCount} holdings=${(invj.holdings || []).length}`
  );

  // 11. Retirement Load — canonical projection endpoint
  const ret = await appGet('/api/finance/retirement-projection', cookie);
  rec('Retirement Load', ret.status === 200, `/api/finance/retirement-projection ${ret.status}`);

  // 12. Recommendations Load
  const recs = await appGet('/api/recommendations', cookie);
  rec('Recommendations Load', recs.status === 200, `/api/recommendations ${recs.status}`);

  // 13. My Life Loads
  const ml = await appGet('/api/life/my-life', cookie);
  rec('My Life Loads', ml.status === 200, `/api/life/my-life ${ml.status}`);

  return { user: u, email, uid, steps };
}

// ---- run all three + print matrix --------------------------------------------
const ROWS = ['Signup','Verify Email','Select Persona','Advisor Starts','Advisor Completes','Dashboard Loads','Finance Loads','Accounts Loads','Transactions Load','Investments Load','Retirement Load','Recommendations Load','My Life Loads'];

console.error(`\nFounder Journey → ${APP}\n`);
const results = [];
for (const u of USERS) {
  console.error(`User ${u.id} (${u.persona}):`);
  results.push(await runUser(u));
}

// matrix
const cell = (r, k) => (r.steps[k] ? (r.steps[k].pass ? 'PASS' : 'FAIL') : '—');
console.log('\n## Founder Journey Matrix\n');
console.log(`| Step | A (${USERS[0].persona}) | B (${USERS[1].persona}) | C (${USERS[2].persona}) |`);
console.log('|---|---|---|---|');
for (const k of ROWS) console.log(`| ${k} | ${cell(results[0], k)} | ${cell(results[1], k)} | ${cell(results[2], k)} |`);

console.log('\n## Failure detail\n');
for (const r of results) {
  for (const k of ROWS) {
    const s = r.steps[k];
    if (s && !s.pass) console.log(`- ${r.user.id} ${k}: ${s.detail}`);
  }
}

// cleanup
if (process.env.KEEP_USERS !== '1') {
  for (const r of results) if (r.uid) await deleteUser(r.uid);
  console.error('\nTest users deleted (set KEEP_USERS=1 to keep).');
} else {
  console.error('\nKEEP_USERS=1 — test users retained: ' + results.map((r) => r.email).join(', '));
}

console.log('\nJSON_START');
console.log(JSON.stringify(results.map((r) => ({ user: r.user.id, persona: r.user.persona, email: r.email, steps: r.steps })), null, 2));
console.log('JSON_END');
