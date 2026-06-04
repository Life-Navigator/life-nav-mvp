// Full beta user-journey test: 10 fresh users, all 10 personas.
// invite → session → onboarding → activate persona → dashboard → recommendations
// → chat (grounded) → logout → return login. Records per-step success.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, APP_URL } = process.env;
const APP = (APP_URL || 'https://life-nav-mvp-web.vercel.app').replace(/\/$/, '');

async function generateLink(type, email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, email, redirect_to: `${APP}/auth/confirm?next=/onboarding` }),
  });
  const j = await r.json();
  const hashed = j.hashed_token || j.properties?.hashed_token;
  const vtype = j.verification_type || j.properties?.verification_type || type;
  if (!hashed) throw new Error(`generate_link(${type}): ${JSON.stringify(j).slice(0, 160)}`);
  return `${APP}/auth/confirm?token_hash=${hashed}&type=${vtype}&next=/onboarding`;
}
function parseCookies(setCookie) {
  return (setCookie || '')
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}
// Follow a confirm URL → return { cookies, location }
async function clickLink(confirmUrl) {
  const r = await fetch(confirmUrl, { method: 'GET', redirect: 'manual' });
  return { cookies: parseCookies(r.headers.get('set-cookie')), location: r.headers.get('location') || '', status: r.status };
}
async function authed(method, path, cookies, body) {
  const r = await fetch(`${APP}${path}`, {
    method,
    headers: { Cookie: cookies, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(75000),
  }).catch((e) => ({ status: 0, _e: e.message, headers: { get: () => '' } }));
  let json = null, text = '';
  try { json = await r.json(); } catch { try { text = await r.text(); } catch { /**/ } }
  return { status: r.status, location: r.headers.get?.('location') || '', json, text };
}

const PERSONAS = [
  'young_professional', 'small_business_owner', 'married_family', 'salary_plus_bonus',
  'high_income_executive', 'credit_rebuilding', 'gig_worker', 'earned_wage_access',
  'bank_income', 'dynamic_transactions',
];
const STEPS = ['invite', 'onboarding_redirect', 'activate', 'dashboard', 'recommendations', 'chat', 'logout_gate', 'return_login'];

async function deleteUser(email) {
  try {
    const u = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
    const id = u.users?.[0]?.id;
    if (id) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  } catch { /**/ }
}

async function runUser(persona, idx, stamp) {
  const email = `beta-journey-${stamp}-${idx}@lifenav.test`;
  const res = { persona, email, steps: {} };
  try {
    // 1. invite → session
    const invite = await clickLink(await generateLink('invite', email));
    res.steps.invite = !!invite.cookies && /3\d\d/.test(String(invite.status));
    const cookies = invite.cookies;
    // 2. onboarding redirect
    res.steps.onboarding_redirect = /\/onboarding/.test(invite.location);
    // 3. activate persona
    const act = await authed('POST', '/api/integrations/plaid/activate-persona', cookies, { persona_id: persona });
    res.steps.activate = act.status === 200;
    // 4. dashboard now loads (onboarded → not bounced to /onboarding or /login)
    const dash = await authed('GET', '/dashboard', cookies);
    res.steps.dashboard = dash.status === 200 || (dash.status >= 300 && dash.status < 400 && !/\/auth\/login|\/onboarding/.test(dash.location));
    // 5. recommendations
    const rec = await authed('GET', '/api/recommendations', cookies);
    const recs = rec.json?.recommendations || rec.json?.data || rec.json || [];
    res.steps.recommendations = rec.status === 200 && Array.isArray(recs) ? recs.length >= 1 : rec.status === 200 && !!recs;
    // 6. chat (grounded)
    const chat = await authed('POST', '/api/agent/chat', cookies, { message: 'What is my current account balance?' });
    const msg = chat.json?.message || '';
    res.steps.chat = chat.status === 200 && !!msg && !/trouble reaching/i.test(msg);
    res._chat = msg.slice(0, 90);
    // 7. logout gate — without cookies, protected route must bounce to auth
    const noauth = await authed('GET', '/dashboard', '');
    res.steps.logout_gate = noauth.status >= 300 && noauth.status < 400 && /\/auth\/(login|magic)/.test(noauth.location);
    // 8. return login — magiclink for existing (onboarded) user → session, → dashboard
    const back = await clickLink(await generateLink('magiclink', email));
    res.steps.return_login = !!back.cookies && !/\/auth\/(login|magic)/.test(back.location);
    res._return_loc = back.location;
  } catch (e) {
    res.error = e.message;
  } finally {
    await deleteUser(email);
  }
  return res;
}

const stamp = Date.now();
const results = [];
for (let i = 0; i < PERSONAS.length; i++) {
  const r = await runUser(PERSONAS[i], i, stamp);
  const passed = STEPS.filter((s) => r.steps[s]).length;
  results.push(r);
  console.log(`${passed === STEPS.length ? 'PASS' : 'PART'} ${r.persona.padEnd(22)} ${passed}/${STEPS.length}  ${STEPS.filter((s) => !r.steps[s]).map((s) => '✗' + s).join(' ') || '(all)'}${r.error ? '  ERR:' + r.error : ''}`);
}

console.log('\n=== per-step success across 10 users ===');
for (const s of STEPS) {
  const n = results.filter((r) => r.steps[s]).length;
  console.log(`  ${s.padEnd(20)} ${n}/10`);
}
const fullPass = results.filter((r) => STEPS.every((s) => r.steps[s])).length;
console.log(`\nFULL JOURNEY (all 8 steps): ${fullPass}/10`);
console.log('sample chat:', results[0]?._chat, '| return →', results[0]?._return_loc);
