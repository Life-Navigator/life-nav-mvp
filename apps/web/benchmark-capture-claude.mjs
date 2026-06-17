// Benchmark capture — Claude via Vertex AI. Sends each scenario's EXACT combined input (context + question)
// to a real Claude model on Vertex, with NO advisor system prompt — i.e. Claude as a user meets it out of the
// box. Records the real reply verbatim. Writes docs/advisor-benchmark/raw/claude.json (same shape as the LN file).
//
// Config (env or /tmp/vertex_creds.json = {project, region, model, access_token}):
//   VERTEX_PROJECT   GCP project id
//   VERTEX_REGION    e.g. us-east5 | europe-west1 | global   (default us-east5)
//   VERTEX_MODEL     e.g. claude-sonnet-4-5@20250929 | claude-opus-4-1@20250805
//   VERTEX_TOKEN     OAuth access token (else falls back to `gcloud auth print-access-token`)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SCEN = JSON.parse(readFileSync(new URL('../../docs/advisor-benchmark/scenarios.json', import.meta.url), 'utf8'));
const OUT = new URL('../../docs/advisor-benchmark/raw/claude.json', import.meta.url);

let cfg = {};
const cfgPath = '/tmp/vertex_creds.json';
if (existsSync(cfgPath)) cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const PROJECT = process.env.VERTEX_PROJECT || cfg.project;
const REGION = process.env.VERTEX_REGION || cfg.region || 'us-east5';
const MODEL = process.env.VERTEX_MODEL || cfg.model;
let TOKEN = process.env.VERTEX_TOKEN || cfg.access_token;
if (!TOKEN) { try { TOKEN = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim(); } catch { /* */ } }
if (!PROJECT || !MODEL || !TOKEN) {
  console.error('Missing Vertex config. Need VERTEX_PROJECT, VERTEX_MODEL, and a token (VERTEX_TOKEN or gcloud login).');
  process.exit(2);
}
const HOST = REGION === 'global' ? 'aiplatform.googleapis.com' : `${REGION}-aiplatform.googleapis.com`;
const ENDPOINT = `https://${HOST}/v1/projects/${PROJECT}/locations/${REGION}/publishers/anthropic/models/${MODEL}:rawPredict`;

async function ask(input) {
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ anthropic_version: 'vertex-2023-10-16', max_tokens: 1024, messages: [{ role: 'user', content: input }] }),
  });
  const body = await r.json().catch(() => ({}));
  const text = Array.isArray(body?.content) ? body.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
  return { status: r.status, latency_ms: Date.now() - t0, text, usage: body?.usage || {}, err: body?.error?.message || (r.ok ? '' : JSON.stringify(body).slice(0, 300)) };
}

const out = [];
console.log(`Claude via Vertex: ${MODEL} @ ${REGION} (project ${PROJECT})`);
let i = 0;
for (const sc of SCEN) {
  i++;
  const input = `${sc.context}\n\n${sc.question}`;
  let rec;
  try {
    const res = await ask(input);
    rec = { id: sc.id, domain: sc.domain, topic: sc.topic, input, status: res.status, latency_ms: res.latency_ms, model: MODEL, assistant_message: res.text, usage: res.usage, error: res.err || undefined };
  } catch (e) { rec = { id: sc.id, domain: sc.domain, topic: sc.topic, input, error: String(e.message || e) }; }
  out.push(rec);
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`[${i}/${SCEN.length}] ${sc.id} ${rec.error ? 'ERROR ' + rec.error : `${rec.status} ${rec.latency_ms}ms ${(rec.assistant_message || '').length}ch`}`);
}
console.log(`wrote ${out.length} records to raw/claude.json`);
