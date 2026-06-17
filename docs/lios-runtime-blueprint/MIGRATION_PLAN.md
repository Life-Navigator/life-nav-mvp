# LIOS Migration Plan — Week 1 → Week 4

> Implementation **planning only** — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> A no-big-bang, incremental path from today's single-agent advisor toward the LIOS orchestrator, mapped to the
> phases in `ORCHESTRATOR_IMPLEMENTATION_PLAN.md` and gated by the flags in `FEATURE_FLAG_STRATEGY.md`. Every
> week leaves the live advisor working and reversible by one toggle (`LIOS_ENABLED=false`).

**Honesty note:** these four weeks are a **sequence, not a promise of dates.** Any week can slip — the gate to
advance is the eval result, never the calendar. If a week's eval gate fails, you do not proceed; you fix or
revert. Prod stays off the whole time; "dev-only" means the flag is on only in a non-prod/eval environment or
for `allowed_user_ids` via `ops.feature_flags` (see `FEATURE_FLAG_STRATEGY.md` §5).

Backend deploys are `flyctl deploy -a lifenavigator-core-api`; flags are Fly secrets/env + `config.py:Settings`;
web is Vercel (unchanged across all four weeks — no web deploy is required for any step here). Telemetry is read
via `GET /v1/admin/advisor-metrics` and the `analytics.advisor_turns` / `advisor_turn_metrics` tables.

---

## Week 1 — Wrap (observe-only) + flags + telemetry [Phase 1]

**Deliverable:** `LiosOrchestrator.run` that, with `LIOS_ENABLED` on, calls the existing
`AdvisorOrchestrator.converse`/`converse_stream` and returns its output **unchanged**, recording a route-plan
stub + wrapper timing. `dependencies.py:get_advisor_orchestrator` returns the wrapper when `LIOS_ENABLED`, else
the existing orchestrator. New telemetry fields (`lios_wrapped`, `route_plan_stub`, wrapper `stages_ms`) added
to `advisor_turns`, non-blocking, metadata-only logs.

**Flag state:** `LIOS_ENABLED` exists, **OFF in prod**; ON only in dev/eval. All other flags OFF.

**Eval gate:** golden-diff — for the eval persona set, wrapper output (`LIOS_ENABLED=on`) is byte-identical to
baseline (`assistant_message`, `llm_status`, structured outcomes). Run `apps/web/advisor-eval.mjs` +
`apps/web/advisor-decisions-probe.mjs` with the flag on in the eval env: **trust = 0**, fallback rate not worse,
p95 latency within ~5% of baseline (wrapper adds no LLM call). Confirm new fields appear in
`GET /v1/admin/advisor-metrics`.

**Rollback:** `flyctl secrets set LIOS_ENABLED=false -a lifenavigator-core-api` → next request is baseline.
Code path off, no redeploy needed.

---

## Week 2 — Intent + selection (observe-only) + offline accuracy [Phase 2–3]

**Deliverable:** `intent.py` (LLM classifier + deterministic fallback to `discovery`) and `selection.py` (the
deterministic rule table → a route plan of which agents _would_ run). Both are **logged, not acted on** — the
advisor still runs exactly as today. Intent + route-plan recorded on every (sampled) turn.

**Flag state:** `LIOS_ENABLED` on (dev/eval), `ORCHESTRATOR_ENABLED` on (dev/eval). **Both OFF in prod.**
`DOMAIN_AGENTS_ENABLED` and below OFF.

**Eval gate:** output still byte-identical to baseline (no behavior change). Offline **intent-classifier
accuracy** measured on a labeled sample (target documented, not invented here); deterministic fallback path
exercised and observed. Route plans logged and reviewed against `AGENT_SELECTION_ENGINE.md` expectations on the
eval personas. Measure the **added latency/cost** of the extra read-only LLM call (intent) — confirm it can be
sampled (not every turn) to respect the $4/day Gemini cap. `advisor-eval.mjs` + `decisions-probe.mjs`: trust = 0.

**Rollback:** set `ORCHESTRATOR_ENABLED=false` (intent/selection observation stops; wrapper pass-through
remains) or `LIOS_ENABLED=false` (full baseline).

---

## Week 3 — First domain agent (Finance), dev-only [Phase 4]

**Deliverable:** Finance wrapped as a registry agent returning the common envelope (reusing the finance summary
service in `routers/finance.py` + `services/recommendations_os.py`). For intents the selection routes to Finance,
run it **in addition to** the advisor, surfacing its output **only behind `DOMAIN_AGENTS_ENABLED`**. The
deterministic `advisor_validator` gates the domain output before it can ever reach a user.

**Flag state:** `LIOS_ENABLED` + `ORCHESTRATOR_ENABLED` + `DOMAIN_AGENTS_ENABLED` on **dev/eval only**
(prod OFF). `MULTI_AGENT_ENABLED` and below OFF.

**Eval gate:** with `DOMAIN_AGENTS_ENABLED` off, output identical to today (re-prove the kill switch). With it
on (dev), the Finance path produces a **gated, grounded** result. Measure: **coverage** on data-rich personas
(needs the seeded finance persona — a known gap in `LIOS_EVALUATION_FRAMEWORK.md` §4/§11), **cost** per turn,
and **latency** (additive vs baseline). Trust = 0 on `advisor-eval.mjs` + a new finance-agent acceptance test.
The `RecommendationOS` evidence-or-nothing guard must hold (no rec without evidence).

**Rollback:** `DOMAIN_AGENTS_ENABLED=false` (domain agent stops surfacing; intent/selection observation
remains) → instantly back to Phase-3 behavior; or `LIOS_ENABLED=false` for full baseline.

---

## Week 4 — Parallel + conflict, dev-only + eval gate [Phase 5–6]

**Deliverable:** parallel domain execution (Finance ∥ Family ∥ Career…) with the join/degrade semantics from
`EXECUTION_STATE_MACHINE.md` / `PARALLELIZATION_MODEL.md`, plus conflict detection/ranking and confidence
propagation. Multi-agent outputs are framed **tradeoffs, never verdicts** (the Texas/job/house example).

**Flag state:** `MULTI_AGENT_ENABLED` on **dev/eval only** (prod OFF). Critic + Compliance-agent still OFF.

**Eval gate:** group latency ≈ slowest member (not sum) — proven on a complex multi-domain query; a blocked
member degrades only its branch; **latency p95 and cost/day within budget** (the readiness review's biggest
risk — `EXECUTION_READINESS_REVIEW.md` §4.1–4.2). Conflict cases produce framed tradeoffs with component
confidence. Trust = 0 across `advisor-eval.mjs` + `advisor-decisions-probe.mjs` + new parallel/conflict tests.
**This is the gate that decides whether multi-agent is viable before any beta exposure.**

**Rollback:** `MULTI_AGENT_ENABLED=false` → back to single-domain-agent (Week 3) behavior; any ancestor flag off
collapses further toward baseline.

---

## Cross-week guarantees

- **Reversible every week:** one toggle (`LIOS_ENABLED=false`) returns to today's advisor regardless of which
  week you are on; each child flag also reverts its own increment (`FEATURE_FLAG_STRATEGY.md` §3–4).
- **Behavior-preserving until proven:** Weeks 1–2 are observe-only; Weeks 3–4 are dev/eval-flagged only.
- **Telemetry-first:** each week adds its observability fields before it acts on anything.
- **No prod change, no web change:** all four weeks keep prod flags OFF and require no Vercel deploy.
- **Slip is allowed; skipping a gate is not.** A failing eval gate stops the week; you fix or revert, never
  proceed. Weeks 5+ (decision pipeline, Critic, Compliance-agent, full LIOS) continue the same cadence per
  `PHASED_BUILD_PLAN.md` Phases 7–10 — out of this 4-week window but on the identical pattern.

## Deployment & verification cheat-sheet (real commands)

```
# enable a step in the eval/dev environment only
flyctl secrets set LIOS_ENABLED=true ORCHESTRATOR_ENABLED=true -a <dev-or-eval-app>
# never on prod until a stage's go/no-go passes (see GO_LIVE_PLAN.md)

# run the gates against the targeted backend
node apps/web/advisor-eval.mjs
node apps/web/advisor-decisions-probe.mjs
node apps/web/fresh-user-e2e.mjs

# read telemetry
curl -s -H "Authorization: Bearer <admin>" https://<backend>/v1/admin/advisor-metrics

# instant rollback
flyctl secrets set LIOS_ENABLED=false -a lifenavigator-core-api
```
