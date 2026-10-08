# Live readiness runner

One command, one honest table. **Read-only by default.** Exercises the live stack with real
credentials to answer what the offline harness structurally cannot.

```bash
# what the credentials allow — no calls, no spend
python scripts/live/readiness.py --creds ~/.ln-live-creds.env --plan

# the decisive model probes first (~$1–3)
python scripts/live/readiness.py --creds ~/.ln-live-creds.env --only model

# everything read-only
python scripts/live/readiness.py --creds ~/.ln-live-creds.env --user-id <uuid> --json /tmp/readiness.json

# include the one write (a Plaid sandbox item)
python scripts/live/readiness.py --creds ~/.ln-live-creds.env --allow-writes
```

Exit `0` only when every **required** check passed.

## Credentials

Write a `KEY=value` file **outside the repo** (`chmod 600`) and pass `--creds`. Never argv — argv is
visible via `ps` and lands in shell history. Values are never printed; the summary shows a length
and an 8-char SHA-256 prefix, enough to confirm which key is in use and useless to a log reader.

`SUPABASE_URL` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` · `GCP_PROJECT` `VERTEX_REGION`
`CLAUDE_MODEL` `VERTEX_ACCESS_TOKEN` (optional; ADC otherwise) · `QDRANT_URL` `QDRANT_API_KEY`
`QDRANT_PERSONAL_COLLECTION` `QDRANT_CENTRAL_COLLECTION` · `NEO4J_URI` `NEO4J_USERNAME`
`NEO4J_PASSWORD` `NEO4J_PERSONAL_DATABASE` · `PLAID_CLIENT_ID` `PLAID_SECRET` `PLAID_ENV`
`CORE_API_URL` `WEB_URL`

A partial set produces partial results — missing credentials mean `UNMEASURED`, not a cascade of
failures.

## Four statuses, and why not two

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| `PASS`       | checked live and correct                                        |
| `FAIL`       | checked and wrong                                               |
| `UNMEASURED` | not checked — missing credential, missing label set, or skipped |
| `BLOCKED`    | something upstream failed first                                 |

**`UNMEASURED` on a required check counts against readiness.** "We did not look" must never read as
"it is fine" — the same discipline that makes the beta gate table trustworthy. A runner with two
statuses would turn a one-day credential window into a green table that means nothing.

There is no score and no percentage. Readiness is a conjunction: one failed tenant-isolation check
is not offset by nine healthy endpoints.

## What each group answers

**`model` — spends money.** The only group that does. Probes run cheapest-decisive-first and in
increasing order of risk, so a rejection names the exact field:

1. `vertex.reachable` — does rawPredict answer at all? (auth/project/region/model availability)
2. `vertex.accepts_thinking` — **the highest-risk unknown in the codebase.** `CLAUDE_THINKING`
   defaults ON; if Vertex rejects it, every advisor turn 400s and silently falls back to Gemini —
   full Opus price, no Opus, and `enhanced` in the logs. Escape hatch: `CLAUDE_THINKING=false`.
3. `vertex.prompt_cache` — two identical calls; asserts `cache_read_input_tokens > 0` on the second.
   Acceptance alone is not enough: Vertex could accept the field and cache nothing.
4. `vertex.accepts_effort` — is the in-model cost dial available here?
5. `vertex.throughput` — real tok/s and $/turn on the actual ~5.2k-token `ADVISOR_SYSTEM`.

`--budget` (default `$5`) caps spend from the provider's **reported** usage, not an estimate.
`--budget 0` disables model calls entirely.

**`stores` — read-only.** Uses the application's own clients, so it exercises the path production
uses rather than a re-implementation:

- `qdrant.dimension` — collections must be 3072 to match the embedder
- `qdrant.payload_domains` — **do payloads use `financial` or `finance`?** The canonical value is
  `financial`; the other is invisible to the domain filter while retrieval reports success. Same
  shape as the defect that made 71% of the corpus unreachable
- `neo4j.generated_cypher` — runs the **engine's own** generated expand pattern against live Aura.
  The repo records traversal "never worked vs live Neo4j" while passing every test, because the
  fakes returned a shape the real client does not
- `ontology.live_types` — a live relationship type absent from the manifest is unreachable data
- `neo4j.edge_provenance` — the advisor may only cite what it can trace (SP-010)
- `stores.alignment` — Supabase vs Neo4j vs Qdrant counts. Retrieval quality is bounded by the
  smallest store

**`platform` — read-only.** `supabase.rls_denies_anon` is the one that matters: service-role bypasses
every policy, so only an **anon** read tells you what an unauthenticated client can see. Plus the
ledger-migration check (the gate on `CALL_USAGE_LEDGER_ENABLED`), deployed health, R-5 SHA proof on
both tiers, and web security headers.

**`plaid` — the only write, gated behind `--allow-writes`, sandbox only.** Beyond "Plaid works":
the calculators fire only when `FinancialInputResolver` reports inputs PRESENT, which until now has
only been exercised with fakes. Real sandbox accounts are the first chance to see whether the
**strict** tier fires on real data, or whether every figure stays a scenario.

## Afterwards

Rotate every credential issued for the window, delete the credentials file, and delete
`/tmp/sweep_creds.txt` if the advisor eval ran.

## Tests

`python -m pytest scripts/live/test_readiness.py` — 18 tests covering the three things that would
silently ruin a run: a credential value getting printed, `UNMEASURED` being treated as a pass, and a
crashing check taking the rest of the run down with it. A runner you debug during the window is a
runner that wastes the window.
