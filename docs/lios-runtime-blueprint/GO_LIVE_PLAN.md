# LIOS Go-Live Plan — The Rollout Ladder

> Implementation **planning only** — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> The staged rollout ladder from internal testing to public release, with **success criteria and a go/no-go
> gate per stage.** Ties to the real eval harnesses (`apps/web/advisor-eval.mjs`,
> `apps/web/advisor-decisions-probe.mjs`, `apps/web/fresh-user-e2e.mjs`), the metrics endpoint
> (`GET /v1/admin/advisor-metrics`), the flags in `FEATURE_FLAG_STRATEGY.md`, and the build in
> `PHASED_BUILD_PLAN.md`. Every stage is reversible by one toggle (`LIOS_ENABLED=false`).

**Golden rule:** advancing a stage is gated by **evidence, not calendar.** Trust = 0 is a hard wall at every
stage; any non-zero trust violation halts the rollout and triggers rollback. Prod-facing stages only enable
flags through `ops.feature_flags` (cohort/`allowed_user_ids`/`rollout_pct`) **under** the global env gate, so
the kill switch stays absolute (`FEATURE_FLAG_STRATEGY.md` §5).

---

## Prerequisites BEFORE any beta-facing stage (from EXECUTION_READINESS_REVIEW)

These are hard blockers for Stage 4 (20-Person Beta) and beyond — not for the internal/synthetic/founder
stages, which exist precisely to build and prove them:

1. **The Critic exists** (`services/lios/critic.py`, Phase 8) — no high-stakes multi-agent output ships to beta
   users without it (`EXECUTION_READINESS_REVIEW.md` §7.5).
2. **Cost model defined + enforced** — per-turn cost ceiling and the $4/day Gemini cap respected under expected
   beta volume (§4.2, §6.4).
3. **Latency in budget on a complex query** — p95 within target, proven on a multi-domain decision turn (§4.1,
   §7.7); the go/no-go, not a nicety.
4. **Coverage measured on data-rich + seeded-graph personas** — multi-agent value proven, not assumed (§7.8;
   `LIOS_EVALUATION_FRAMEWORK.md` §4/§11).
5. **Per-turn retrieval-set logging** so multi-agent grounding is auditable (§7.9).
6. **The kill switch verified live** (`LIOS_ENABLED=false` ⇒ baseline) before any prod cohort is exposed.

---

## Stage 1 — Internal / Developer Testing

- **Who:** engineers, on a dev/eval backend (never prod).
- **Enabled:** progressively `LIOS_ENABLED` → `ORCHESTRATOR_ENABLED` → `DOMAIN_AGENTS_ENABLED` (Phases 1–4),
  dev env only. Prod flags OFF.
- **Success criteria:** golden-diff passes (wrapper byte-identical when at Phase 1); each phase's acceptance
  test green; trust = 0 on `advisor-eval.mjs`; new telemetry fields visible in `GET /v1/admin/advisor-metrics`.
- **Go/no-go to advance:** Phases 1–4 acceptance + GATE met in dev; kill switch verified.

## Stage 2 — Synthetic Evaluations (the harnesses)

- **Who:** automated — the harnesses against the dev/eval backend, with multi-agent flags on dev only.
- **Enabled:** up to `MULTI_AGENT_ENABLED` (Phases 5–7), dev/eval env.
- **Success criteria:**
  - `apps/web/advisor-eval.mjs`: **trust = 0**; fallback rate < 5%.
  - `apps/web/advisor-decisions-probe.mjs`: decision turns framed as tradeoffs (no verdicts); evasiveness not
    worse; context-use not worse.
  - `apps/web/fresh-user-e2e.mjs`: honest empty states, 0 errors across surfaces.
  - Latency **p95 within budget** on a complex multi-domain query; **cost/day within budget**.
  - Coverage measured on data-rich/seeded-graph personas (once those personas land — §11 gap).
- **Go/no-go to advance:** all harness gates green at least twice on consecutive runs; latency/cost ceilings met.

## Stage 3 — Founder Testing

- **Who:** founder(s) only, via `ops.user_feature_flag_overrides` / `allowed_user_ids` on prod, under the env
  gate. Real prod backend, single-digit users.
- **Enabled:** the proven phase set (typically up to `MULTI_AGENT_ENABLED`; `CRITIC_ENABLED` if Phase 8 is in).
- **Success criteria:** trust = 0 on real founder traffic (read `advisor_turns`); latency p95 within budget;
  cost within the daily cap; **subjective quality** sampled by the founder (CFP/CPA-grade judgment — human,
  never machine-fabricated, per `LIOS_EVALUATION_FRAMEWORK.md` §7). No P0 regressions vs baseline.
- **Go/no-go to advance:** founder sign-off + prerequisites §1–6 all satisfied (Critic exists, cost+latency in
  budget, coverage measured, retrieval logging on, kill switch verified).

## Stage 4 — 20-Person Beta

- **Who:** the existing 20-person beta cohort (`ops.cohorts`/`ops.user_cohorts`), prod, env-gated.
- **Enabled:** the founder-proven flag set, scoped to the beta cohort via `ops.feature_flags.cohort_slug`.
- **Success criteria (live, on `GET /v1/admin/advisor-metrics` + `advisor_turn_metrics`):**
  - **Trust = 0** (any violation halts + rolls back immediately).
  - Fallback rate < 5%.
  - Validation-failure rate near baseline (never raised by weakening safety).
  - Latency p95 within budget; time-to-first-useful-text < ~2s (streaming ack preserved).
  - Cost/day within the $4/day cap under cohort volume.
  - Coverage: data-rich beta users receive ≥ the baseline count of grounded, evidence-backed recs.
  - Satisfaction: positive sampled feedback (human-collected via the ops feedback meter).
- **Go/no-go to advance:** ≥ 2 weeks stable on all the above with no trust violation and no rollback;
  cost/latency stable under real load.

## Stage 5 — Expanded Beta

- **Who:** a larger cohort via `rollout_pct` on `ops.feature_flags` (deterministic hash bucket), prod.
- **Enabled:** the 20-person-proven set, ramped by percentage (e.g. 25% → 50% → 100% of the expanded cohort).
- **Success criteria:** Stage-4 criteria hold at higher volume; no cost-cap breach as volume scales; p95 does
  not degrade with load; trust = 0 maintained at scale.
- **Go/no-go to advance:** full expanded-cohort exposure stable; cost model validated at the larger N;
  `Compliance Agent` (Phase 9) eval-passed if enabling it here.

## Stage 6 — Public Release

- **Who:** all users, prod (`ops.feature_flags.enabled=true`, `rollout_pct=100`) under the env gate
  (`LIOS_ENABLED=true` in prod for the first time).
- **Enabled:** the full proven LIOS phase set per intent (Phase 10); the live single-agent advisor remains the
  always-available fallback floor.
- **Success criteria:** the full evaluation framework passes its gates continuously
  (`LIOS_EVALUATION_FRAMEWORK.md` §2/§9): trust = 0; latency/cost in budget; coverage measured; observability
  on for every turn. Continuous watch on `advisor_turn_metrics` (fallback, validation-failure, p95).
- **Go/no-go (this IS the gate):** all of the above sustained; rollback path rehearsed; on any trust violation
  or cost/latency breach, `flyctl secrets set LIOS_ENABLED=false -a lifenavigator-core-api` returns every user
  to today's advisor instantly.

---

## The rollback contract (every stage)

```
flyctl secrets set LIOS_ENABLED=false -a lifenavigator-core-api   # global kill: all users → baseline advisor
# or narrow a cohort/percentage in ops.feature_flags without touching the env gate
```

One toggle returns to today's advisor exactly (`FEATURE_FLAG_STRATEGY.md` §4). No web (Vercel) change is ever
required to roll back; the orchestrator runs Fly-only.

## Ladder summary

```
1 Internal (dev, P1–4)
  → 2 Synthetic evals (dev, P5–7, harness gates)
    → 3 Founder (prod, allowlist, prereqs §1–6)
      → 4 20-person beta (prod, cohort, trust=0 + cost/latency live)
        → 5 Expanded beta (prod, rollout_pct ramp)
          → 6 Public (prod, LIOS_ENABLED=true, full framework gate)
```

Each arrow is an explicit go/no-go; trust = 0 is the wall at every one; the kill switch is the floor under all
of them.
