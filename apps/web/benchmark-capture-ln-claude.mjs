// Benchmark capture — LifeNavigator. Drives the LIVE advisor (Fly) with each of the 50 benchmark scenarios
// and records the REAL output verbatim. One fresh synthetic user per scenario (no cross-contamination); the
// input is exactly context + "\n\n" + question — identical to what ChatGPT/Claude receive, for a fair test.
// Captures the assistant text + all structured signals (candidate goals, missing data, llm_status, prompt
// version, latency) so the trust analysis can use real provenance. Writes docs/advisor-benchmark/raw/lifenavigator_claude_v6.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const CORE = 'https://lifenavigator-core-api.fly.dev';
const SCEN = JSON.parse(readFileSync(new URL('../../docs/advisor-benchmark/scenarios.json', import.meta.url), 'utf8'));
const OUT = new URL('../../docs/advisor-benchmark/raw/lifenavigator_claude_v6.json', import.meta.url);
const [URL_, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const users = [];

async function mkUser(tag) {
  const email = `benchcl-${tag}-${randomUUID().slice(0, 6)}@example.com`, password = 'Bx!' + Math.random().toString(36).slice(2, 12);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  users.push(data.user.id);
  await admin.from('profiles').upsert({ id: data.user.id, setup_completed: true, onboarding_completed: true });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: s.session.access_token };
}
async function chat(token, message, cid) {
  const t0 = Date.now();
  const r = await fetch(`${CORE}/v1/life/discovery/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, pending_key: '', conversation_id: cid }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, latency_ms: Date.now() - t0, body };
}

const out = [];
async function run() {
  let i = 0;
  for (const sc of SCEN) {
    i++;
    const input = `${sc.context}\n\n${sc.question}`;
    let rec;
    try {
      const u = await mkUser(sc.id);
      const cid = `benchcl-${sc.id}-${randomUUID().slice(0, 8)}`;
      const res = await chat(u.token, input, cid);
      rec = {
        id: sc.id, domain: sc.domain, topic: sc.topic, input,
        status: res.status, latency_ms: res.latency_ms,
        llm_status: res.body?.llm_status || '', prompt_version: res.body?.prompt_version || '',
        assistant_message: res.body?.assistant_message || '',
        candidate_goals: (res.body?.candidate_goals || []).map((c) => c.goal || c.title || ''),
        missing_data: res.body?.missing_data || [],
        relationships_referenced: res.body?.relationships_referenced || [],
      };
    } catch (e) {
      rec = { id: sc.id, domain: sc.domain, topic: sc.topic, input, error: String(e.message || e) };
    }
    out.push(rec);
    writeFileSync(OUT, JSON.stringify(out, null, 2)); // checkpoint after every scenario (resumable evidence)
    console.log(`[${i}/${SCEN.length}] ${sc.id} ${rec.error ? 'ERROR ' + rec.error : `${rec.llm_status} ${rec.latency_ms}ms`}`);
  }
}
try { await run(); } catch (e) { console.error('CAPTURE ERROR:', e.stack || e.message); }
finally {
  const life = admin.schema('life');
  for (const id of users) {
    for (const t of ['risks', 'opportunities', 'dependencies', 'goals', 'constraints', 'life_objectives', 'life_vision', 'life_graph_edges', 'candidate_goals', 'rejected_goals'])
      await life.from(t).delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(`[cleanup] removed ${users.length} users · wrote ${out.length} records to raw/lifenavigator_claude_v6.json`);
}
