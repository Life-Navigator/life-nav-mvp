// Live production smoke for the discovery-mode fix. Mints a throwaway Supabase user, hits the live
// Fly core-api, asserts the discovery contract, cleans up. Run: node discovery-smoke.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const [URL_, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const CORE = 'https://lifenavigator-core-api.fly.dev';
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

const FORBIDDEN = ['**The tradeoffs:**', '**What we know:**', '**My read:**', '**What would change this:**',
  'licensed professional', 'your primary objective is'];
const violations = (t) => { const low = (t || '').toLowerCase(); return FORBIDDEN.filter((f) => low.includes(f.toLowerCase())); };
const created = [];

async function mint() {
  const email = `smoke_${Date.now()}_${Math.floor(performance.now())}@example.com`, password = 'Test12345!';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  created.push(data.user.id);
  try { await admin.from('profiles').upsert({ id: data.user.id, setup_completed: true, onboarding_completed: true }); } catch { /* profile optional */ }
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw new Error('signIn: ' + e2.message);
  return s.session.access_token;
}

async function chat(token, message) {
  const r = await fetch(`${CORE}/v1/life/discovery/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, msg: json?.assistant_message ?? '', llm_status: json?.llm_status, raw: json };
}

async function stream(token, message) {
  const r = await fetch(`${CORE}/v1/life/discovery/chat/stream`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  const text = await r.text();
  const events = [];
  for (const frame of text.split('\n\n')) {
    const line = frame.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try { events.push(JSON.parse(line.slice(5).trim())); } catch { /* skip */ }
  }
  const final = [...events].reverse().find((e) => e.type === 'final') || events[events.length - 1];
  return { status: r.status, types: events.map((e) => e.type), final };
}

const results = [];
function record(name, pass, detail) { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}\n      ${detail}`); }

try {
  // 1. discovery/chat — "Reach financial independence"
  let t = await mint();
  const r1 = await chat(t, 'Reach financial independence');
  const v1 = violations(r1.msg);
  record('1. discovery/chat conversational (no six-section/disclaimer/fact)',
    r1.status === 200 && v1.length === 0,
    `status=${r1.status} llm_status=${r1.llm_status} violations=${JSON.stringify(v1)} len=${r1.msg.length} | "${r1.msg.slice(0, 160).replace(/\n/g, ' ')}"`);

  // 2. discovery/chat/stream — same input
  t = await mint();
  const r2 = await stream(t, 'Reach financial independence');
  const v2 = violations(r2.final?.assistant_message);
  record('2. discovery/chat/stream follows discovery mode',
    r2.status === 200 && v2.length === 0 && r2.types.includes('final'),
    `status=${r2.status} types=${JSON.stringify(r2.types)} llm_status=${r2.final?.llm_status} violations=${JSON.stringify(v2)} | "${(r2.final?.assistant_message || '').slice(0, 160).replace(/\n/g, ' ')}"`);

  // 3. finance question on the (only) chat route — must stay conversational, not regress, not crash
  t = await mint();
  const r3 = await chat(t, 'Should I move my 401k into an index fund to retire earlier?');
  const v3 = violations(r3.msg);
  record('3. finance question handled (discovery mode; advisor template NOT leaked)',
    r3.status === 200 && v3.length === 0,
    `status=${r3.status} llm_status=${r3.llm_status} violations=${JSON.stringify(v3)} | "${r3.msg.slice(0, 160).replace(/\n/g, ' ')}"`);

  // 4. health urgent — deterministic safety fallback wins
  t = await mint();
  const r4 = await chat(t, 'I have chest pain on and off for a week, what should I do?');
  const safe = /911|emergency room|emergency number|988/i.test(r4.msg);
  record('4. health urgent → deterministic safety fallback',
    r4.status === 200 && safe,
    `status=${r4.status} llm_status=${r4.llm_status} safety_text=${safe} | "${r4.msg.slice(0, 160).replace(/\n/g, ' ')}"`);
} catch (e) {
  record('SMOKE HARNESS', false, 'threw: ' + e.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n==== ${passed}/${results.length} live smoke checks passed (cleaned up ${created.length} users) ====`);
  process.exit(passed === results.length ? 0 : 1);
}
