# Runtime Governance Verification

Sprint N.2 Phase 1 deliverable.

## What changed

Before Sprint N.2, the chokepoint `guardOutgoing` (the single function
every MUST_WIRE route calls) invoked Sprint L's `validateAndPersist` —
a regex-only policy engine. Sprint L2's constitutional pipeline
(`reviewAndPersist`) existed and was tested but only reached production
through `/api/constitutional/review`, which no client called in the hot
path.

After Sprint N.2, `guardOutgoing` calls `reviewAndPersist`. Sprint L's
policy engine runs **inside** the constitutional pipeline as steps
1-3 (lawfulness / safety / harm) and steps 6-9 (ethics / neutrality /
COI / autonomy). The block trigger — `governance.approved === false` —
is identical, so every route's existing 422-block semantic is preserved.

What changes is what executes **in addition**:

1. **Constitutional retrieval** — every guarded request now reads
   `governance.constitutional_entities` once per cache window (60s
   in-process). `decision_governance_audit.retrieval_ok` and
   `metadata.retrieved_rule_count` carry the live signal.
2. **Crisis detection** — every guarded request is screened for
   `suicidal_ideation`, `self_harm_risk`, `violence_risk`,
   `severe_emotional_instability`, `extreme_hopelessness`. When
   present, the audit row's `risk_level` is upgraded to HIGH or
   CRITICAL even when the Sprint L verdict is "approved".
3. **Emotional intelligence + cognitive distortion review** —
   the 12 distortion patterns (catastrophizing, hopelessness loop,
   revenge fixation, ...) are scored on each draft. Findings appear
   on the constitutional decision; they do not block by themselves
   but inform realism + redirection.
4. **Future visibility + future preservation review** — every draft
   is scored across 8 axes: freedom, health, relationships, career,
   education, financial flexibility, reputation, future options. If
   any axis is rated destructive, the redirection engine synthesizes
   a constructive alternative.
5. **Realism guard rewrite** — claims like "guaranteed", "always",
   "never fail" are rewritten in-place.
6. **Per-iteration trace** — `governance.review_iterations` gets one
   row per redraft cycle (max 3) with the verdict, modifications,
   retrieved rule ids, and latency.

## What the runtime audit row contains now

```sql
SELECT
  approved,
  constitutional_verdict,    -- APPROVE / APPROVE_WITH_MODIFICATION / CONSTITUTIONAL_REDIRECTION / REQUEST_CLARIFICATION / SAFE_CONSTITUTIONAL_RESPONSE
  risk_level,                -- LOW / MODERATE / HIGH / CRITICAL
  iteration_count,           -- 1..3
  total_latency_ms,
  draft_hash, final_hash,
  retrieval_ok,
  metadata->'retrieved_rule_count' AS rule_count,
  metadata->'rule_set_version' AS rule_set_version
FROM decision_governance_audit
ORDER BY created_at DESC
LIMIT 10;
```

If `iteration_count` is 0 or `constitutional_verdict` is NULL for any
recent traffic, the L2 pipeline is bypassed and Sprint N.2 has
regressed. Add a Grafana alert.

## How this was verified

### 1. Bypass test parity

`apps/web/src/lib/governance/__tests__/governance-bypass.spec.ts`
contains 50 tests covering all 10 governance categories
(illegal_activity, fraud, self_harm, harm_to_others, manipulation,
political_influence, unsafe_health, provider, simulation, optimizer).
All 50 pass under the new pipeline — bit-for-bit identical block
semantics.

### 2. New positive verification

`apps/web/src/lib/governance/__tests__/sprint-l2-runtime.spec.ts`
adds 2 tests:

- A clean recommendation is approved AND surfaces the full constitutional
  decision (crisis, emotional, future_preservation) AND persists exactly
  1 audit row + 1 iteration trace row.
- A blocked recommendation still emits the audit + iteration row (no
  silent block).

### 3. Structural test sweep

The bypass spec's structural test scans 26 MUST_WIRE route files and
asserts every one imports `guardOutgoing`. Sprint N.2 retained this
test; the journeys-e2e spec adds a smaller representative sweep on
7 routes to catch regression on the highest-impact subset.

### 4. Production smoke

The operator can run the following query against the production
`decision_governance_audit` view after deploy:

```sql
SELECT COUNT(*) FILTER (WHERE constitutional_verdict IS NULL) AS no_l2,
       COUNT(*) FILTER (WHERE constitutional_verdict = 'APPROVE') AS approve,
       COUNT(*) FILTER (WHERE constitutional_verdict = 'APPROVE_WITH_MODIFICATION') AS mod,
       COUNT(*) FILTER (WHERE constitutional_verdict = 'CONSTITUTIONAL_REDIRECTION') AS redirect,
       COUNT(*) FILTER (WHERE constitutional_verdict = 'SAFE_CONSTITUTIONAL_RESPONSE') AS safe,
       COUNT(*) AS total
FROM decision_governance_audit
WHERE created_at > NOW() - INTERVAL '1 hour';
```

`no_l2` should be 0 in production. If non-zero, a route is calling the
legacy `validateAndPersist` directly — find it and route it through
`guardOutgoing`.

## What does NOT change

- The block-and-return-422 contract on the HTTP layer. Existing route
  handlers using `if (!g.ok) return g.response;` continue to work
  unchanged.
- The `GovernanceDecision` shape returned in `g.decision`.
- The Sprint L policy-engine rules (no regex changes).
- The audit table schema. Sprint L2 columns were already added in
  migration 089; they were previously written only on the legacy
  `/api/constitutional/review` path.

## Known limits

- The constitutional retrieval cache is per-process. A Vercel cold start
  pays a single DB roundtrip for the rule set; subsequent requests use
  the cache for 60s.
- The 13-step review currently uses an in-process orchestrator. There is
  no LLM call in the review path — the engines are deterministic over
  the input text. (This is an intentional design — the audit chain must
  be replayable.) BYOM model calls happen separately, in extractors and
  agents that themselves go through `guardOutgoing` afterward.
- Crisis escalation messaging is generated by the redirection engine.
  External escalation (crisis hotline, 988 in the US, etc.) is the
  responsibility of the route handler — Sprint N.2 surfaces the signal
  on `g.constitutional.crisis.signals[]`; the renderer must render it.
