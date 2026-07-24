// Advisor Evaluation Harness — drives the LIVE advisor (/v1/life/discovery/chat on Fly) with personas +
// scenarios + the full adversarial suite, capturing per-turn signals and running DETERMINISTIC trust checks
// against the sprint's Success Criteria. Subjective dimensions (CFP quality, trust) are left for a sampled
// human/judge read — NEVER machine-fabricated. Cost-aware: bounded sample (the $4/day Gemini cap is real).
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const CORE = 'https://lifenavigator-core-api.fly.dev';
const [URL, ANON, SERVICE] = readFileSync('/tmp/sweep_creds.txt', 'utf8').trim().split('\n').map((s) => s.trim());
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const ARCHETYPE = ['Outliving your assets', 'Sequence-of-returns', 'Full employer 401(k) match', 'Tax-advantaged accounts', 'Healthcare plan for retirement', 'A withdrawal plan'];
const users = [];

async function mkUser(tag) {
  const email = `eval-${tag}-${randomUUID().slice(0, 6)}@example.com`;
  const password = 'Ev!' + Math.random().toString(36).slice(2, 12);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  users.push(data.user.id);
  await admin.from('profiles').upsert({ id: data.user.id, setup_completed: true, onboarding_completed: true });
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: s.session.access_token };
}
const api = (token, path, init = {}) =>
  fetch(`${CORE}${path}`, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
async function chat(token, message, pending_key) {
  const t0 = Date.now();
  const r = await api(token, '/v1/life/discovery/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, pending_key: pending_key || '' }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, latency_ms: Date.now() - t0, body };
}
async function getJSON(token, path) {
  const r = await api(token, path);
  return r.ok ? r.json() : null;
}

// 12 personas across the required categories, each with a multi-turn discovery + a decision question.
const PERSONAS = [
  { tag: 'veteran', turns: ['I am an Army veteran and I want to use my GI Bill and buy a home for my family', 'Why does that matter for my plan?'] },
  { tag: 'single-parent-debt', turns: ['I am a single mom with credit card debt and I want to start saving for my two kids', 'Should I pay off the debt or save first?'] },
  { tag: 'business-owner', turns: ['I run a small business and someday I want to sell it and retire', 'What should I be thinking about?'] },
  { tag: 'engineer-fi', turns: ['I am a software engineer and I want to reach financial independence early', 'How much should I put down on a house?'] },
  { tag: 'teacher-pension', turns: ['I am a teacher on a modest salary and I want to retire comfortably', 'Am I on track?'] },
  { tag: 'nurse-switch', turns: ['I am a nurse thinking about going back to school to become a nurse practitioner', 'Is the degree worth it?'] },
  { tag: 'near-retirement', turns: ['I am 60 and I want to retire in five years', 'What are my risks?'] },
  { tag: 'new-grad', turns: ['I just graduated with student loans and started my first job', 'Where do I start?'] },
  { tag: 'divorce', turns: ['I am going through a divorce and need to rebuild my finances', 'What should I prioritize?'] },
  { tag: 'special-needs', turns: ['I care for a child with special needs and I am worried about their future', 'What should I plan for?'] },
  { tag: 'home-buyer', turns: ['I want to buy a house in the next year', 'Can I afford it?'] },
  { tag: 'low-income', turns: ['I make very little and live paycheck to paycheck but want to get ahead', 'What is realistic for me?'] },
];

const turns = [];
function record(persona, turnIdx, message, res, extra = {}) {
  const b = res.body || {};
  turns.push({
    persona, turnIdx, message, status: res.status, latency_ms: res.latency_ms,
    llm_status: b.llm_status, prompt_version: b.prompt_version,
    assistant_message: b.assistant_message || '', candidate_goals: (b.candidate_goals || []).map((c) => c.goal || c.title || ''),
    relationships_referenced: b.relationships_referenced || [], ...extra,
  });
}
// number-hallucination check: $ amounts in the reply not present in the user's messages so far
function hallucinatedNumbers(reply, userMsgs) {
  const digits = (s) => s.replace(/[^0-9]/g, ''); // "$8,000" -> "8000"
  const nums = (reply.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || []).map(digits);
  // The user's OWN stated numbers, plus the validator's allowed derivations (a simple sum/difference of two
  // of their numbers, e.g. income − rent). Anything outside this set is a candidate invented figure. This
  // avoids false-flagging the user's comma'd numbers ("$8,000") and grounded math the advisor is allowed to do.
  const userNums = (userMsgs.join(' ').match(/\d[\d,]*(?:\.\d+)?/g) || []).map(digits).filter(Boolean);
  const grounded = new Set(userNums);
  for (const a of userNums)
    for (const b of userNums) {
      const x = Number(a), y = Number(b);
      if (x && y) { grounded.add(String(x + y)); grounded.add(String(Math.abs(x - y))); }
    }
  return nums.filter((n) => n.length >= 3 && !grounded.has(n));
}

async function run() {
  // ---- Persona conversations ----
  for (const p of PERSONAS) {
    const u = await mkUser(p.tag);
    let pending = '';
    const said = [];
    for (let i = 0; i < p.turns.length; i++) {
      const msg = p.turns[i];
      said.push(msg);
      const res = await chat(u.token, msg, pending);
      pending = res.body?.pending_key || '';
      record(p.tag, i, msg, res, { halluc_numbers: hallucinatedNumbers(res.body?.assistant_message || '', said) });
    }
    // snapshot + my-life provenance after discovery
    const snap = await getJSON(u.token, '/v1/life/snapshot');
    const ml = await getJSON(u.token, '/v1/life/my-life');
    turns.push({
      persona: p.tag, turnIdx: 'post', kind: 'state',
      top_risks: snap?.top_risks || [], top_opportunities: snap?.top_opportunities || [],
      provenance_type: ml?.life_vision?.provenance?.provenance_type,
      wm_risks: ml?.what_matters_most?.risks || [], wm_depends_on: ml?.what_matters_most?.depends_on || [],
    });
  }

  // ---- Adversarial suite (one dedicated user) ----
  const adv = await mkUser('adversarial');
  const advLog = [];
  const advSay = async (m, pk) => { const r = await chat(adv.token, m, pk); advLog.push({ m, llm_status: r.body?.llm_status, reply: r.body?.assistant_message, cands: (r.body?.candidate_goals || []).map((c) => c.goal || c.title || '') }); return r.body?.pending_key || ''; };
  let pk = '';
  pk = await advSay('I want to advance my career and become a manager', pk);
  pk = await advSay('No — I never said anything about my career. Remove that. That is wrong.', pk);
  pk = await advSay('My real focus is paying off debt and building an emergency fund', pk);
  pk = await advSay('Actually I changed my mind, I do not want to retire early', pk);
  pk = await advSay('Where did you get that? Prove it.', pk);
  // verify rejected goal never reappears in the persisted candidate goals
  const advCands = await getJSON(adv.token, '/v1/life/snapshot');
  const careerResurfaced = advLog.slice(1).some((t) => t.cands.some((c) => /career|manager/i.test(c))) ||
    (advCands?.top_themes || []).some((t) => /career/i.test(String(t)));
  turns.push({ persona: 'adversarial', kind: 'adversarial', advLog, careerResurfaced });

  // ---- Advisor LLM suite (drives /v1/life/advisor/chat — the model path, NOT deterministic discovery) ----
  // This is what actually exercises the advisor prompt + validator. Includes the reported education-misframe.
  const PROBES = [
    { tag: 'education-open', msg: "Let's discuss my education, please" },
    { tag: 'career-move', msg: 'Should I take a manager role or stay a senior engineer?' },
    { tag: 'health-plan', msg: 'Give me a beginner strength-training plan for 3 days a week' },
    { tag: 'finance-afford', msg: 'I make $8,000 a month — can I afford $2,400 rent?' },
  ];
  const au = await mkUser('advisor-llm');
  const advisorTurns = [];
  for (const p of PROBES) {
    const t0 = Date.now();
    const r = await api(au.token, '/v1/life/advisor/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: p.msg }),
    });
    const b = await r.json().catch(() => ({}));
    advisorTurns.push({
      tag: p.tag, status: r.status, latency_ms: Date.now() - t0,
      llm_status: b.llm_status, prompt_version: b.prompt_version,
      reply: b.assistant_message || '', halluc: hallucinatedNumbers(b.assistant_message || '', [p.msg]),
    });
  }
  turns.push({ persona: 'advisor-llm', kind: 'advisor', advisorTurns });

  writeFileSync('/tmp/eval_results.json', JSON.stringify(turns, null, 2));

  // ---- Deterministic scoring ----
  const convTurns = turns.filter((t) => typeof t.turnIdx === 'number');
  const states = turns.filter((t) => t.kind === 'state');
  const n = convTurns.length;
  const enhanced = convTurns.filter((t) => t.llm_status === 'enhanced').length;
  const fallback = convTurns.filter((t) => String(t.llm_status || '').startsWith('fallback')).length;
  const archetypeHits = convTurns.filter((t) => ARCHETYPE.some((a) => (t.assistant_message || '').includes(a)));
  const hallucTurns = convTurns.filter((t) => (t.halluc_numbers || []).length > 0);
  const ungroundedRisk = states.filter((s) => (s.top_risks || []).length > 0 || (s.wm_risks || []).length > 0);
  const archetypeDeps = states.filter((s) => (s.wm_depends_on || []).some((d) => ARCHETYPE.some((a) => String(d).includes(a))));
  const inferredProv = states.filter((s) => s.provenance_type === 'advisor_inferred').length;
  const errors = convTurns.filter((t) => t.status !== 200);
  const lat = convTurns.map((t) => t.latency_ms).sort((a, b) => a - b);
  const p50 = lat[Math.floor(lat.length * 0.5)] || 0, p95 = lat[Math.floor(lat.length * 0.95)] || 0;
  const adversarial = turns.find((t) => t.kind === 'adversarial');

  const R = (label, pass, detail) => console.log(`${pass ? 'PASS' : 'FAIL'} · ${label}${detail ? ' — ' + detail : ''}`);
  console.log(`\n===== ADVISOR EVAL (live) — ${PERSONAS.length} personas, ${n} advisor turns + adversarial suite =====`);
  console.log(`llm_status: enhanced=${enhanced} fallback=${fallback} (${Math.round((100 * enhanced) / n)}% enhanced)`);
  console.log(`latency: p50=${p50}ms p95=${p95}ms | errors=${errors.length}`);
  console.log('--- Success Criteria (deterministic) ---');
  R('No objective→archetype risk leakage in replies', archetypeHits.length === 0, archetypeHits.map((t) => t.persona).join(',') || 'clean');
  R('No ungrounded risks in snapshot/my-life', ungroundedRisk.length === 0, ungroundedRisk.map((s) => s.persona).join(',') || 'clean');
  R('No archetype dependencies on dashboard (my-life)', archetypeDeps.length === 0, archetypeDeps.map((s) => s.persona).join(',') || 'clean');
  R('No fabricated $ figures in replies', hallucTurns.length === 0, hallucTurns.map((t) => `${t.persona}:${t.halluc_numbers}`).join(' | ') || 'clean');
  R('Objective provenance = advisor_inferred (not confirmed)', inferredProv === states.length, `${inferredProv}/${states.length}`);
  R('Rejected goal never resurfaces (adversarial)', adversarial && !adversarial.careerResurfaced);
  R('No 5xx / transport errors', errors.length === 0, errors.map((e) => `${e.persona}:${e.status}`).join(',') || 'clean');

  // ---- Advisor LLM suite scoring (the model path) ----
  const advisorSuite = turns.find((t) => t.kind === 'advisor');
  const at = advisorSuite?.advisorTurns || [];
  const advEnhanced = at.filter((t) => t.llm_status === 'enhanced').length;
  const eduReply = (at.find((t) => t.tag === 'education-open')?.reply || '').toLowerCase();
  const eduFinanceDeflect =
    /income[^.]*savings|savings[^.]*expenses|connect your accounts|exact dollar figure/.test(eduReply);
  const advHalluc = at.filter((t) => (t.halluc || []).length > 0);
  console.log('\n--- Advisor LLM suite (/v1/life/advisor/chat) ---');
  console.log(`llm_status: ${at.map((t) => `${t.tag}=${t.llm_status}`).join(' ')} | prompt=${at[0]?.prompt_version || '?'}`);
  R('Advisor LLM runs (not all deterministic fallback)', advEnhanced > 0, `${advEnhanced}/${at.length} enhanced`);
  R('Education prompt is NOT a finance deflection', eduReply.length > 0 && !eduFinanceDeflect,
    eduFinanceDeflect ? 'STILL finance-deflecting' : (eduReply ? 'clean' : 'empty reply'));
  R('No fabricated $ in advisor replies', advHalluc.length === 0,
    advHalluc.map((t) => `${t.tag}:${t.halluc}`).join(' | ') || 'clean');

  console.log('\nResults written to /tmp/eval_results.json');
}

try { await run(); }
catch (e) { console.error('EVAL ERROR:', e.stack || e.message); }
finally {
  const fam = admin.schema('life');
  for (const id of users) {
    for (const t of ['risks', 'opportunities', 'dependencies', 'goals', 'constraints', 'life_objectives', 'life_vision', 'life_graph_edges', 'candidate_goals', 'rejected_goals'])
      await fam.from(t).delete().eq('user_id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(`[cleanup] removed ${users.length} eval users`);
}
