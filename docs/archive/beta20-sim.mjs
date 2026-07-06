// Part 8 — 20-user beta launch simulation. 20 fresh users (each of the 10
// personas x2), run CONCURRENTLY (pool) through the full journey to stress
// auth / activation / dashboard / recs / chat together. Captures per-step
// success + latency. Throwaway users deleted after.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, APP_URL } = process.env;
const APP = (APP_URL || 'https://life-nav-mvp-web.vercel.app').replace(/\/$/, '');
const CONCURRENCY = 5;

async function generateLink(type, email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, email, redirect_to: `${APP}/auth/confirm?next=/onboarding` }),
  });
  const j = await r.json();
  const hashed = j.hashed_token || j.properties?.hashed_token;
  const vtype = j.verification_type || j.properties?.verification_type || type;
  if (!hashed) throw new Error(`generate_link(${type})`);
  return `${APP}/auth/confirm?token_hash=${hashed}&type=${vtype}&next=/onboarding`;
}
const parseCookies = (sc) => (sc || '').split(/,(?=[^;]+?=)/).map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
async function clickLink(url) {
  const r = await fetch(url, { method: 'GET', redirect: 'manual' });
  return { cookies: parseCookies(r.headers.get('set-cookie')), location: r.headers.get('location') || '', status: r.status };
}
async function authed(method, path, cookies, body) {
  const t0 = Date.now();
  const r = await fetch(`${APP}${path}`, {
    method, headers: { Cookie: cookies, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(80000),
  }).catch((e) => ({ status: 0, _e: e.message, headers: { get: () => '' } }));
  let json = null; try { json = await r.json(); } catch { /**/ }
  return { status: r.status, location: r.headers.get?.('location') || '', json, ms: Date.now() - t0 };
}
async function deleteUser(email) {
  try {
    const u = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
    const id = u.users?.[0]?.id;
    if (id) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  } catch { /**/ }
}
const PERSONAS = ['young_professional', 'small_business_owner', 'married_family', 'salary_plus_bonus', 'high_income_executive', 'credit_rebuilding', 'gig_worker', 'earned_wage_access', 'bank_income', 'dynamic_transactions'];
const STEPS = ['invite', 'onboarding_redirect', 'activate', 'dashboard', 'recommendations', 'chat', 'logout_gate', 'return_login'];

async function runUser(persona, email) {
  const r = { persona, email, steps: {}, lat: {} };
  try {
    const inv = await clickLink(await generateLink('invite', email));
    r.steps.invite = !!inv.cookies && /3\d\d/.test(String(inv.status));
    r.steps.onboarding_redirect = /\/onboarding/.test(inv.location);
    const ck = inv.cookies;
    const act = await authed('POST', '/api/integrations/plaid/activate-persona', ck, { persona_id: persona }); r.lat.activate = act.ms;
    r.steps.activate = act.status === 200;
    const dash = await authed('GET', '/dashboard', ck); r.lat.dashboard = dash.ms;
    r.steps.dashboard = dash.status === 200 || (dash.status >= 300 && dash.status < 400 && !/\/auth\/login|\/onboarding/.test(dash.location));
    const rec = await authed('GET', '/api/recommendations', ck); r.lat.recommendations = rec.ms;
    const recs = rec.json?.recommendations || rec.json?.data || rec.json || [];
    r.steps.recommendations = rec.status === 200 && (Array.isArray(recs) ? recs.length >= 1 : !!recs);
    const chat = await authed('POST', '/api/agent/chat', ck, { message: 'What is my current account balance?' }); r.lat.chat = chat.ms;
    const msg = chat.json?.message || ''; r.steps.chat = chat.status === 200 && !!msg && !/trouble reaching/i.test(msg);
    r._chatcode = chat.status; r._fallback = /trouble reaching/i.test(msg);
    const noauth = await authed('GET', '/dashboard', '');
    r.steps.logout_gate = noauth.status >= 300 && noauth.status < 400 && /\/auth\/(login|magic)/.test(noauth.location);
    const back = await clickLink(await generateLink('magiclink', email));
    r.steps.return_login = !!back.cookies && !/\/auth\/(login|magic)/.test(back.location);
  } catch (e) { r.error = e.message; }
  finally { await deleteUser(email); }
  return r;
}

// concurrency pool
async function pool(items, n, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

const stamp = Date.now();
const users = Array.from({ length: 20 }, (_, i) => ({ persona: PERSONAS[i % 10], email: `beta20sim-${stamp}-${i}@lifenav.test` }));
const t0 = Date.now();
const results = await pool(users, CONCURRENCY, (u) => runUser(u.persona, u.email));
const wall = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`=== 20-user simulation (concurrency ${CONCURRENCY}, ${wall}s wall) ===`);
const full = results.filter((r) => STEPS.every((s) => r.steps[s])).length;
for (const s of STEPS) console.log(`  ${s.padEnd(20)} ${results.filter((r) => r.steps[s]).length}/20`);
console.log(`\nFULL JOURNEY (8/8): ${full}/20`);
const fb = results.filter((r) => r._fallback).length;
console.log(`chat: real=${results.filter((r) => r.steps.chat).length}/20  fallback=${fb}  429budget=${results.filter((r) => r._chatcode === 429).length}`);
function p(step) { const a = results.map((r) => r.lat[step]).filter(Boolean).sort((x, y) => x - y); return a.length ? `${a[Math.floor(a.length / 2)]}/${a[a.length - 1]}` : 'n/a'; }
console.log(`latency p50/max ms — activate ${p('activate')}  recs ${p('recommendations')}  chat ${p('chat')}`);
const fails = results.filter((r) => !STEPS.every((s) => r.steps[s]));
if (fails.length) for (const f of fails) console.log(`  PARTIAL ${f.persona} ${f.email}: missing ${STEPS.filter((s) => !f.steps[s]).join(',')}${f.error ? ' ERR:' + f.error : ''}`);
console.log('(throwaway users cleaned up)');
