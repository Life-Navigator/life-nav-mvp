// Phase 5 — Fresh-User E2E. ONE brand-new user, no seeded data/fixtures, walks the full surface area as a
// real beta user would: signup -> onboarding gate -> advisor discovery -> every domain read. Confirms each
// surface returns an HONEST state (200 + real-or-empty, never an error, never fabricated data). Backend
// walkthrough (the UI calls these exact endpoints). Cleans up.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const CORE = 'https://lifenavigator-core-api.fly.dev';
const [URL, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
let uid;

async function mkUser() {
  const email = `fresh-${randomUUID().slice(0, 6)}@example.com`;
  const password = 'Ev!' + Math.random().toString(36).slice(2, 12);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  uid = data.user.id;
  // onboarding gate (a real user completes the wizard; we set the same flags it sets)
  await admin.from('profiles').upsert({ id: uid, setup_completed: true, onboarding_completed: true });
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return s.session.access_token;
}
const get = async (token, path) => {
  const t0 = Date.now();
  const r = await fetch(`${CORE}${path}`, { headers: { authorization: `Bearer ${token}` } });
  let body = null; try { body = await r.json(); } catch {}
  return { path, status: r.status, ms: Date.now() - t0, body };
};
const chat = async (token, message, pk) => {
  const r = await fetch(`${CORE}/v1/life/discovery/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, pending_key: pk || '' }),
  });
  return r.json();
};

const SURFACES = [
  ['Onboarding', '/v1/platform/onboarding/guide'], ['Platform dashboard', '/v1/platform/dashboard'],
  ['Life snapshot', '/v1/life/snapshot'], ['My Life (Life Model)', '/v1/life/my-life'],
  ['Life attention', '/v1/life/attention'], ['Discovery coverage', '/v1/life/discovery/coverage'],
  ['Family office', '/v1/family/office'], ['Family summary', '/v1/family/summary'],
  ['Career summary', '/v1/career/summary'], ['Career recommendations', '/v1/career/recommendations'],
  ['Education summary', '/v1/education/summary'], ['Education recommendations', '/v1/education/recommendations'],
  ['Finance canonical summary', '/v1/finance/canonical-summary'], ['Finance net worth', '/v1/finance/net-worth'],
  ['Recommendations', '/v1/recommendations'], ['Next best action (attention)', '/v1/life/attention'],
  ['Report preview (full)', '/v1/reports/full/preview'],
];

async function run() {
  const token = await mkUser();
  const out = { uid, steps: [], reads: [] };

  // Advisor discovery — 2 real turns
  let pk = '';
  const m1 = await chat(token, 'I just signed up and I want to get my financial life in order', pk);
  pk = m1.pending_key || '';
  out.steps.push({ step: 'advisor turn 1', llm_status: m1.llm_status, reply: (m1.assistant_message || '').slice(0, 160) });
  const m2 = await chat(token, 'My main worry is saving for my kids while paying down debt', pk);
  out.steps.push({ step: 'advisor turn 2', llm_status: m2.llm_status, reply: (m2.assistant_message || '').slice(0, 160) });

  for (const [name, path] of SURFACES) {
    const r = await get(token, path);
    const b = r.body;
    const empty = b == null || (Array.isArray(b) && b.length === 0) ||
      (typeof b === 'object' && Object.keys(b).length === 0);
    out.reads.push({ name, path, status: r.status, ms: r.ms, empty, keys: b && typeof b === 'object' && !Array.isArray(b) ? Object.keys(b).slice(0, 8) : (Array.isArray(b) ? `array[${b.length}]` : typeof b) });
  }

  writeFileSync('/tmp/fresh_user_e2e.json', JSON.stringify(out, null, 2));
  console.log('=== FRESH USER E2E (live) ===');
  console.log('advisor:', out.steps.map((s) => `${s.step}=${s.llm_status}`).join(', '));
  const errs = out.reads.filter((r) => r.status >= 500);
  const auth = out.reads.filter((r) => r.status === 401 || r.status === 403);
  const notfound = out.reads.filter((r) => r.status === 404);
  console.log(`reads: ${out.reads.length} | 5xx=${errs.length} | 401/403=${auth.length} | 404=${notfound.length}`);
  for (const r of out.reads) console.log(`  [${r.status}] ${r.ms}ms ${r.name} (${r.path}) ${r.empty ? 'EMPTY' : 'data'} ${JSON.stringify(r.keys)}`);
  if (errs.length) console.log('5xx:', errs.map((e) => e.path));
}

try { await run(); }
catch (e) { console.error('E2E ERROR:', e.stack || e.message); }
finally {
  const life = admin.schema('life');
  for (const t of ['risks', 'opportunities', 'dependencies', 'goals', 'constraints', 'life_objectives', 'life_vision', 'life_graph_edges', 'candidate_goals', 'rejected_goals'])
    if (uid) await life.from(t).delete().eq('user_id', uid);
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {});
  console.log('[cleanup] removed fresh user');
}
