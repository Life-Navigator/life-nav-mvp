// Phase 6 — Hard Decision Testing. Drives the LIVE advisor with the sprint's exact decision questions
// across Housing/Career/Education/Retirement/Family/Finance, after giving each domain a realistic bit of
// context (acting like a real beta user). Captures per-turn llm_status + latency + reply for the audit.
// Reuses the eval harness creds + cleanup pattern. Cost-aware: one user, ~20 turns.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const CORE = 'https://lifenavigator-core-api.fly.dev';
const [URL, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [];

async function mkUser(tag) {
  const email = `dec-${tag}-${randomUUID().slice(0, 6)}@example.com`;
  const password = 'Ev!' + Math.random().toString(36).slice(2, 12);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  users.push(data.user.id);
  await admin.from('profiles').upsert({ id: data.user.id, setup_completed: true, onboarding_completed: true });
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: s.session.access_token };
}
async function chat(token, message, pending_key) {
  const t0 = Date.now();
  const r = await fetch(`${CORE}/v1/life/discovery/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, pending_key: pending_key || '' }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, latency_ms: Date.now() - t0, body };
}

// Each block: a short realistic context message, then the sprint's hard decision question(s).
const BLOCKS = [
  { domain: 'housing', turns: [
    'I make $120k and have $60k saved. I am looking at a $450k house.',
    'Should I buy this house?', 'How much should I put down?', 'Can I afford this?'] },
  { domain: 'career', turns: [
    'I am a senior engineer making $150k and I feel stuck.',
    'Should I leave my job?', 'Should I take this promotion to manager?', 'Should I change industries?'] },
  { domain: 'education', turns: [
    'I have a bachelor degree and work in marketing.',
    'Should I go back to school?', 'Should I get an MBA?', 'Should I attend law school?'] },
  { domain: 'retirement', turns: [
    'I am 45 with $300k in my 401k and want to stop working someday.',
    'Can I retire early?', 'How much do I need to retire?'] },
  { domain: 'family', turns: [
    'I am married with two young kids and I am the main earner.',
    'What happens to my family if I die?', 'How much life insurance do I need?', 'How should I protect my family?'] },
  { domain: 'finance', turns: [
    'I have $15k in credit card debt and $5k in savings.',
    'Should I invest or pay off debt?', 'How much emergency fund do I need?'] },
];

const log = [];
async function run() {
  for (const blk of BLOCKS) {
    const u = await mkUser(blk.domain);
    let pk = '';
    for (let i = 0; i < blk.turns.length; i++) {
      const msg = blk.turns[i];
      const res = await chat(u.token, msg, pk);
      pk = res.body?.pending_key || '';
      log.push({
        domain: blk.domain, turnIdx: i, is_context: i === 0, message: msg,
        status: res.status, latency_ms: res.latency_ms, llm_status: res.body?.llm_status,
        reply: res.body?.assistant_message || '',
        relationships_referenced: res.body?.relationships_referenced || [],
        missing_data: res.body?.missing_data || [],
      });
    }
  }
  writeFileSync('/tmp/decisions_probe.json', JSON.stringify(log, null, 2));

  const q = log.filter((t) => !t.is_context); // the actual decision questions
  const n = q.length;
  const fb = q.filter((t) => String(t.llm_status || '').startsWith('fallback')).length;
  const errs = q.filter((t) => t.status !== 200);
  const lat = q.map((t) => t.latency_ms).sort((a, b) => a - b);
  console.log(`\n===== HARD DECISION PROBE (live) — ${q.length} decision questions across ${BLOCKS.length} domains =====`);
  console.log(`fallback=${fb}/${n} (${Math.round((100 * fb) / n)}%) | enhanced=${n - fb - errs.length} | errors=${errs.length}`);
  console.log(`latency: p50=${lat[Math.floor(n * 0.5)]}ms p95=${lat[Math.floor(n * 0.95)]}ms`);
  for (const t of q) {
    const tag = String(t.llm_status || '').startsWith('fallback') ? 'FALLBACK' : 'OK ';
    console.log(`  [${tag}] ${t.domain} (${t.latency_ms}ms): "${t.message}" -> ${(t.reply || '').replace(/\s+/g, ' ').slice(0, 110)}`);
  }
  console.log('\nWritten to /tmp/decisions_probe.json');
}

try { await run(); }
catch (e) { console.error('PROBE ERROR:', e.stack || e.message); }
finally {
  const life = admin.schema('life');
  for (const id of users) {
    for (const t of ['risks', 'opportunities', 'dependencies', 'goals', 'constraints', 'life_objectives', 'life_vision', 'life_graph_edges', 'candidate_goals', 'rejected_goals'])
      await life.from(t).delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(`[cleanup] removed ${users.length} probe users`);
}
