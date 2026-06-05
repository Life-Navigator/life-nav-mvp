// Admin invite + magic-link tester for the invite-only beta.
//
// Uses Supabase Admin generate_link (built-in auth — NO custom auth) to mint an
// invite link per email, pointed at the app's /auth/confirm?token_hash=... SSR
// route so a click establishes a session and lands in /onboarding.
//
//   node beta-invite.mjs generate a@x.com b@y.com      # print distributable links (don't consume)
//   node beta-invite.mjs test 5                         # mint + FOLLOW links for 5 fresh emails (consumes them)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, APP_URL
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: ANON, APP_URL } = process.env;
const APP = (APP_URL || 'https://app.lifenavigator.tech').replace(/\/$/, '');

// Mint a link via the built-in admin endpoint. type 'invite' creates the user;
// 'magiclink' is for existing users. Returns { hashed_token, action_link, confirm_url }.
async function generateLink(type, email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, email, redirect_to: `${APP}/auth/confirm?next=/onboarding` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`generate_link ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  // hashed_token lives at top-level (REST) or under properties (sdk shape)
  const hashed = j.hashed_token || j.properties?.hashed_token;
  const vtype = j.verification_type || j.properties?.verification_type || type;
  if (!hashed) throw new Error(`no hashed_token in response: ${JSON.stringify(j).slice(0, 200)}`);
  const confirm_url = `${APP}/auth/confirm?token_hash=${hashed}&type=${vtype}&next=/onboarding`;
  return { hashed, vtype, action_link: j.action_link || j.properties?.action_link, confirm_url };
}

// Follow a confirm URL and verify: (a) session cookies set, (b) redirect target,
// (c) the resulting session actually authenticates against a protected route.
async function followAndVerify(confirmUrl) {
  const r1 = await fetch(confirmUrl, { method: 'GET', redirect: 'manual' });
  const setCookie = r1.headers.get('set-cookie') || '';
  const location = r1.headers.get('location') || '';
  const hasSession = /sb-[^=]*-auth-token/.test(setCookie) || /supabase|sb-/.test(setCookie);
  // Extract cookies to test the session against the landing route.
  const cookiePairs = setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean);
  const cookieHeader = cookiePairs.join('; ');
  let landedAuthed = null;
  if (cookieHeader && location) {
    const landUrl = location.startsWith('http') ? location : `${APP}${location}`;
    const r2 = await fetch(landUrl, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
    // authed if NOT bounced back to /auth/login
    const l2 = r2.headers.get('location') || '';
    landedAuthed = !/\/auth\/(login|magic)/.test(l2);
  }
  return { status: r1.status, location, hasSession, landedAuthed };
}

const [mode, ...rest] = process.argv.slice(2);

if (mode === 'generate') {
  const emails = rest;
  console.log(`Minting ${emails.length} invite link(s) (built-in Supabase auth):\n`);
  for (const email of emails) {
    try {
      const { confirm_url } = await generateLink('invite', email);
      console.log(`${email}\n  ${confirm_url}\n`);
    } catch (e) {
      console.log(`${email}\n  ERROR: ${e.message}\n`);
    }
  }
} else if (mode === 'test') {
  const n = parseInt(rest[0] || '5', 10);
  const stamp = Date.now();
  let pass = 0;
  const results = [];
  for (let i = 0; i < n; i++) {
    const email = `beta-invite-${stamp}-${i}@lifenav.test`;
    try {
      const { confirm_url, action_link } = await generateLink('invite', email);
      const v = await followAndVerify(confirm_url);
      const ok = (v.status === 302 || v.status === 303 || v.status === 307) &&
        v.hasSession && /\/onboarding/.test(v.location) && v.landedAuthed !== false;
      if (ok) pass++;
      results.push({ email, ok, ...v, action_link });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${email}  status=${v.status} session=${v.hasSession} → ${v.location} authed=${v.landedAuthed}`);
    } catch (e) {
      results.push({ email, ok: false, error: e.message });
      console.log(`FAIL ${email}  ${e.message}`);
    }
  }
  console.log(`\n${pass}/${n} fresh emails: invite link → session → /onboarding`);
  // cleanup: delete the throwaway invited users
  for (const res of results) {
    try {
      const u = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(res.email)}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
      const id = u.users?.[0]?.id;
      if (id) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    } catch { /* best-effort */ }
  }
  console.log('(throwaway users cleaned up)');
} else {
  console.log('usage: node beta-invite.mjs generate <email...>   |   node beta-invite.mjs test <count>');
}
