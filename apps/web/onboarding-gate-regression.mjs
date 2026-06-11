// Onboarding-gate regression harness. Asserts the 4 invariants from the P0 hardening:
//   1. fresh user (no persona)        → /dashboard redirects to /onboarding/financial-profile
//   2. setup-only (persona, no advisor) → /dashboard redirects to /dashboard/advisor?onboarding=1
//   3. /api/onboarding/complete        → 410 (legacy; never sets onboarding_completed)
//   4. advisor-complete is the ONLY writer of onboarding_completed (asserted in code review, not here)
// Run:  SUPA_URL=… ANON=… SVC=… APP=https://app.lifenavigator.tech node onboarding-gate-regression.mjs
import { createServerClient } from '@supabase/ssr';

const { SUPA_URL, ANON, SVC, APP } = process.env;
const h = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const fail = (m) => {
  console.error('❌ FAIL:', m);
  process.exitCode = 1;
};

async function session(email, pw) {
  const s = await (
    await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    })
  ).json();
  const jar = {};
  const c = createServerClient(SUPA_URL, ANON, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (L) => L.forEach(({ name, value }) => (jar[name] = value)),
    },
  });
  await c.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return Object.entries(jar)
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join('; ');
}
const loc = async (cookie, path) => {
  const r = await fetch(`${APP}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location') };
};

async function mkUser(tag, patch) {
  const ts = Date.now();
  const email = `gatereg-${tag}-${ts}@lifenav.test`;
  const pw = `Gate-${ts}!a`;
  const uid = (
    await (
      await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ email, password: pw, email_confirm: true }),
      })
    ).json()
  ).id;
  if (patch) await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', headers: h, body: JSON.stringify(patch) });
  return { uid, email, pw };
}
const del = (uid) => fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: h });

const fresh = await mkUser('fresh', null);
const c1 = await session(fresh.email, fresh.pw);
const r1 = await loc(c1, '/dashboard');
console.log('1 fresh /dashboard →', r1.status, r1.location);
if (!(r1.status === 307 && r1.location === '/onboarding/financial-profile')) fail('fresh user not gated to persona');
const comp = await fetch(`${APP}/api/onboarding/complete`, { method: 'POST', headers: { Cookie: c1, 'Content-Type': 'application/json' }, body: '{}' });
console.log('3 /api/onboarding/complete →', comp.status);
if (comp.status !== 410) fail('legacy /api/onboarding/complete is not 410 Gone');
await del(fresh.uid);

const setup = await mkUser('setup', { setup_completed: true });
const c2 = await session(setup.email, setup.pw);
const r2 = await loc(c2, '/dashboard');
console.log('2 setup-only /dashboard →', r2.status, r2.location);
if (!(r2.status === 307 && r2.location === '/dashboard/advisor?onboarding=1')) fail('setup-only user not gated to advisor');
await del(setup.uid);

console.log(process.exitCode ? '\nREGRESSION DETECTED' : '\n✅ All onboarding-gate invariants hold');
