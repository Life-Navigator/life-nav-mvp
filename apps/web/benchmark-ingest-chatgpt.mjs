// Ingest manually-captured ChatGPT replies into the same structured shape as the other two.
// Source: docs/advisor-benchmark/raw/chatgpt_pasted.txt — blocks delimited by a line "### <scenario-id>"
// followed by the verbatim ChatGPT reply (multi-line ok). Anything before the first ### is ignored.
// Emits docs/advisor-benchmark/raw/chatgpt.json. Warns about any of the 50 ids missing or unknown.
import { readFileSync, writeFileSync } from 'node:fs';

const SCEN = JSON.parse(readFileSync(new URL('../../docs/advisor-benchmark/scenarios.json', import.meta.url), 'utf8'));
const SRC = new URL('../../docs/advisor-benchmark/raw/chatgpt_pasted.txt', import.meta.url);
const OUT = new URL('../../docs/advisor-benchmark/raw/chatgpt.json', import.meta.url);
const byId = Object.fromEntries(SCEN.map((s) => [s.id, s]));

const raw = readFileSync(SRC, 'utf8');
const parts = raw.split(/^###[ \t]+(\S+)[ \t]*$/m);
const answers = {};
for (let i = 1; i < parts.length; i += 2) answers[parts[i].trim()] = (parts[i + 1] || '').trim();

const out = [];
for (const s of SCEN) {
  const a = answers[s.id];
  out.push({ id: s.id, domain: s.domain, topic: s.topic, input: `${s.context}\n\n${s.question}`, assistant_message: a || '', captured: !!a });
}
writeFileSync(OUT, JSON.stringify(out, null, 2));
const missing = SCEN.filter((s) => !answers[s.id]).map((s) => s.id);
const unknown = Object.keys(answers).filter((id) => !byId[id]);
console.log(`ingested ${Object.keys(answers).length} ChatGPT replies → raw/chatgpt.json (${out.filter((o) => o.captured).length}/${SCEN.length} captured)`);
if (missing.length) console.log(`MISSING (${missing.length}): ${missing.join(', ')}`);
if (unknown.length) console.log(`UNKNOWN ids (${unknown.length}): ${unknown.join(', ')}`);
