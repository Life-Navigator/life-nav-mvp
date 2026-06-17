// Advisor Excellence harness — drives MULTI-TURN conversations (stable conversation_id) against the live
// advisor so cross-turn context retention (P0.1) is actually exercised, and measures the quality dimensions
// deterministically where possible. Turn 1 states context (numbers + the decision); turn 2 asks a follow-up
// that REQUIRES remembering turn 1. Cost-aware: define many, run a sample (SAMPLE env). Cleans up.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const CORE = 'https://lifenavigator-core-api.fly.dev';
const [URL, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const users = [];

async function mkUser(tag) {
  const email = `xeval-${tag}-${randomUUID().slice(0, 6)}@example.com`, password = 'Ev!' + Math.random().toString(36).slice(2, 12);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  users.push(data.user.id);
  await admin.from('profiles').upsert({ id: data.user.id, setup_completed: true, onboarding_completed: true });
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: s.session.access_token };
}
async function chat(token, message, pk, cid) {
  const t0 = Date.now();
  const r = await fetch(`${CORE}/v1/life/discovery/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, pending_key: pk || '', conversation_id: cid }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, latency_ms: Date.now() - t0, body };
}

// Each scenario: turn 1 = context-rich (numbers + the decision); turn 2 = a follow-up needing turn-1 memory.
// `remember` = strings (numbers/topics) from turn 1 that an elite turn-2 reply should reflect.
const SCENARIOS = [
  { tag: 'home', turns: ['I make $120k, have $60k saved, and want to buy a ~$450k house next year.', 'Can I afford it?'], remember: ['120', '60', '450', 'house'] },
  { tag: 'retire', turns: ['I am 45 with $300k in my 401k and want to retire early.', 'Am I on track?'], remember: ['45', '300', 'retire'] },
  { tag: 'career', turns: ['I am a senior engineer making $150k and considering a manager promotion.', 'Should I take it?'], remember: ['150', 'manager', 'promotion'] },
  { tag: 'mba', turns: ['I have a bachelor degree, make $80k in marketing, and am weighing a $120k MBA.', 'Is it worth it?'], remember: ['80', '120', 'mba'] },
  { tag: 'family', turns: ['I am married with two kids and I am the main earner.', 'How do I protect them if something happens to me?'], remember: ['two', 'kids', 'earner'] },
  { tag: 'relocate', turns: ['We are thinking about moving from California to Texas for a $20k raise.', 'Does the move make sense?'], remember: ['texas', '20', 'move'] },
  { tag: 'startup', turns: ['I want to leave my $130k job to start a business, with $90k in savings.', 'Can I make the leap?'], remember: ['130', '90', 'business'] },
  { tag: 'debt', turns: ['I have $15k in credit card debt at 22% and $5k in savings.', 'Should I pay it down or invest?'], remember: ['15', '22', '5'] },
  { tag: 'emergency', turns: ['I spend about $4k a month and have $6k in the bank.', 'How big should my emergency fund be?'], remember: ['4', '6'] },
  { tag: 'college', turns: ['My daughter starts college in 3 years and I have $25k saved for it.', 'Are we behind?'], remember: ['3', '25', 'college'] },
  { tag: 'newbaby', turns: ['We are expecting our first baby and I make $95k.', 'What should we get in order first?'], remember: ['95', 'baby'] },
  { tag: 'aging', turns: ['My mother is 78 and may need care soon; I have two siblings.', 'How should I think about this?'], remember: ['78', 'care', 'siblings'] },
  { tag: 'divorce', turns: ['I am going through a divorce and need to rebuild on a $70k salary.', 'What should I prioritize?'], remember: ['70', 'divorce'] },
  { tag: 'jobloss', turns: ['I was just laid off; I have $40k saved and a family of four.', 'What do I do first?'], remember: ['40', 'laid off', 'family'] },
  { tag: 'inherit', turns: ['I just inherited $200k and have a $180k mortgage at 4%.', 'What should I consider?'], remember: ['200', '180', '4'] },
  { tag: 'disability', turns: ['I have a chronic condition that may affect my ability to work; I make $85k.', 'How do I protect my income?'], remember: ['85', 'income'] },
];

const VISION = /what does .{0,40}(look like|mean to you)|your (?:ideal |broader )?(?:vision|aspirations)|truly (?:successful|fulfilling)|what success (?:looks|means)|define .{0,20}(success|on track)|what .{0,15}refers? to/i;
const FRAME = /comes down to|the real (question|decision)|boils down|depends (mostly )?on|trade[- ]?off|versus| vs\.? |weigh(ing)? |on one hand|the inputs?|what would (most )?(change|sharpen)|two things|three things/i;
const dollars = (s) => (String(s).match(/\$?\s?\d[\d,]*/g) || []).map((x) => x.replace(/[^0-9]/g, '')).filter((n) => n.length >= 2);

const rows = [];
async function run() {
  const N = Math.min(Number(process.env.SAMPLE || 16), SCENARIOS.length);
  for (const sc of SCENARIOS.slice(0, N)) {
    const u = await mkUser(sc.tag);
    const cid = `xeval-${sc.tag}-${randomUUID().slice(0, 8)}`;
    let pk = '';
    const said = [];
    const turnRecs = [];
    for (let i = 0; i < sc.turns.length; i++) {
      const msg = sc.turns[i];
      said.push(msg);
      const res = await chat(u.token, msg, pk, cid);
      pk = res.body?.pending_key || '';
      const reply = (res.body?.assistant_message || '');
      turnRecs.push({ i, msg, reply, status: res.status, latency_ms: res.latency_ms, llm_status: res.body?.llm_status });
    }
    // Measure the FOLLOW-UP turn (turn 2) — the one that needs turn-1 memory.
    const t2 = turnRecs[turnRecs.length - 1];
    const replyLow = (t2.reply || '').toLowerCase();
    const userNums = dollars(said.join(' '));
    const replyNums = dollars(t2.reply);
    rows.push({
      tag: sc.tag,
      context_use: sc.remember.some((r) => replyLow.includes(String(r).toLowerCase())),
      vision_deflection: VISION.test(t2.reply),
      framing: FRAME.test(t2.reply),
      fabricated_number: replyNums.some((n) => n.length >= 3 && !userNums.includes(n)),
      fallback: String(t2.llm_status || '').startsWith('fallback'),
      latency_ms: t2.latency_ms,
      reply: t2.reply,
    });
  }
  writeFileSync('/tmp/excellence_eval.json', JSON.stringify(rows, null, 2));
  const n = rows.length;
  const pct = (k) => Math.round((100 * rows.filter((r) => r[k]).length) / n);
  const lat = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
  console.log(`\n===== ADVISOR EXCELLENCE EVAL (live, multi-turn) — ${n} scenarios =====`);
  console.log(`context_use (reflects turn-1 specifics): ${pct('context_use')}%   <-- P0.1 (was ~0%)`);
  console.log(`framing (names tradeoff/decision):       ${pct('framing')}%`);
  console.log(`vision_deflection (LOWER is better):     ${pct('vision_deflection')}%   <-- was ~19-35%`);
  console.log(`fallback rate:                           ${pct('fallback')}%   (target 0)`);
  console.log(`fabricated numbers (MUST be 0):          ${pct('fabricated_number')}%`);
  console.log(`latency p50/p95: ${lat[Math.floor(n * 0.5)]}ms / ${lat[Math.floor(n * 0.95)] || lat[n - 1]}ms`);
  console.log('\n--- follow-up replies ---');
  for (const r of rows) console.log(`[${r.tag}] ctx=${r.context_use ? 'Y' : 'n'} frame=${r.framing ? 'Y' : 'n'} vis=${r.vision_deflection ? 'Y' : 'n'} :: ${(r.reply || '').replace(/\s+/g, ' ').slice(0, 120)}`);
  console.log('\nwritten to /tmp/excellence_eval.json');
}
try { await run(); } catch (e) { console.error('EXCELLENCE EVAL ERROR:', e.stack || e.message); }
finally {
  const life = admin.schema('life');
  for (const id of users) {
    for (const t of ['risks', 'opportunities', 'dependencies', 'goals', 'constraints', 'life_objectives', 'life_vision', 'life_graph_edges', 'candidate_goals', 'rejected_goals'])
      await life.from(t).delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(`[cleanup] removed ${users.length} eval users`);
}
