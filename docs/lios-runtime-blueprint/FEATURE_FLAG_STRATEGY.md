# LIOS Feature Flag Strategy

> Implementation **planning only** — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> This designs the flag set that gates the LIOS orchestrator path so it is **off in prod by default**,
> **reversible by one toggle**, and **behavior-identical to today's advisor** when disabled. Builds on
> `CURRENT_STATE_AUDIT.md` (§2 Config/flags, §7 guardrails) and `ORCHESTRATOR_IMPLEMENTATION_PLAN.md`.

## 1. How flags are read today (the pattern to extend)

The live advisor flags are read directly from the process env, not from pydantic fields:

- `apps/lifenavigator-core-api/app/dependencies.py:280` — `os.environ.get("ADVISOR_LLM_ENABLED", "true")`
- `apps/lifenavigator-core-api/app/routers/life.py:95,109` — `os.environ.get("ADVISOR_TRACE_ENABLED", "")`
- `apps/lifenavigator-core-api/app/config.py:14` — `class Settings(BaseSettings)` (pydantic-settings, env-sourced)

**Decision:** promote the LIOS flags to first-class `Settings` fields in `config.py` (typed, defaulted, testable
via `Settings(...)` overrides) AND keep the `os.environ`-style read available so existing tests/patterns work.
Each flag is set on Fly via `flyctl secrets set KEY=value -a lifenavigator-core-api` (or `fly.toml [env]` for
non-secret booleans). Web (Vercel) never reads these — the LLM/orchestrator runs Fly-only (Gemini key Fly-only).

Truthiness convention matches the existing flags: `("1","true","yes")` ⇒ on; anything else ⇒ off.

## 2. The flag set

| Flag                       | Gates                                                                                                               | Prod default | Depends on                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `LIOS_ENABLED`             | the master switch: whether `dependencies.py:get_advisor_orchestrator` returns the `LiosOrchestrator` wrapper at all | **OFF**      | none (root)                                                                  |
| `ORCHESTRATOR_ENABLED`     | intent classification + agent-selection **observation** (Phase 2–3): logged, never acted on                         | **OFF**      | `LIOS_ENABLED`                                                               |
| `DOMAIN_AGENTS_ENABLED`    | running + **surfacing** ≥1 domain agent (Finance first) output, after Compliance (Phase 4)                          | **OFF**      | `LIOS_ENABLED` + `ORCHESTRATOR_ENABLED`                                      |
| `MULTI_AGENT_ENABLED`      | parallel domain execution, conflict resolution, confidence propagation, decision pipeline (Phase 5–7)               | **OFF**      | `DOMAIN_AGENTS_ENABLED`                                                      |
| `CRITIC_ENABLED`           | the high-stakes Critic pass (Phase 8)                                                                               | **OFF**      | `MULTI_AGENT_ENABLED` (Critic only meaningful once multi-agent claims exist) |
| `COMPLIANCE_AGENT_ENABLED` | the optional LLM-assist _in front of_ the authoritative deterministic validator (Phase 9)                           | **OFF**      | `LIOS_ENABLED` (the deterministic gate never depends on it)                  |

### Per-flag detail

**`LIOS_ENABLED`** — root kill switch. When OFF, `get_advisor_orchestrator` constructs and returns today's
`AdvisorOrchestrator` exactly as it does now (`dependencies.py:268`); the `LiosOrchestrator` wrapper is never
instantiated. When ON, it returns the wrapper, which (Phase 1) still calls `AdvisorOrchestrator.converse`/
`converse_stream` and returns identical output, only adding observe-only telemetry.

**`ORCHESTRATOR_ENABLED`** — turns on `intent.py` + `selection.py` observation. Classified intent and the route
plan are **logged** (extended `advisor_turns` fields), the advisor still runs unchanged. Requires `LIOS_ENABLED`
because there is no wrapper to attach observation to otherwise.

**`DOMAIN_AGENTS_ENABLED`** — first flag that can change user-visible output. Wraps Finance as a registry agent
returning the common envelope (reuses the finance summary service + `RecommendationOS`). Output passes the
deterministic `advisor_validator` before it can reach a user. Dev/eval-on, prod-off until eval-gated.

**`MULTI_AGENT_ENABLED`** — fan-out (Finance ∥ Family ∥ Career…), join/degrade, conflict detection, confidence
aggregation, and the orchestrated decision pipeline. The single biggest latency/cost risk; gated hardest.

**`CRITIC_ENABLED`** — adds `critic.py` on high-stakes/regulated/decision-recommendation turns only (cost
control). Critic refutes, never rewrites; refuted claims drop to safe. Useless without multi-agent claims, so
it depends on `MULTI_AGENT_ENABLED`.

**`COMPLIANCE_AGENT_ENABLED`** — LLM-assist that can only _tighten_ in front of the deterministic validator.
The deterministic `advisor_validator` (`advisor_validator.py:validate`) remains authoritative and wins on any
hard rule, regardless of this flag — so it depends only on `LIOS_ENABLED`, not on the multi-agent chain.

## 3. Precedence / truth table

Resolution order (a child is inert unless every ancestor is on):

```
LIOS_ENABLED ── false ─────────────────────────────────► BASELINE (today's AdvisorOrchestrator). All others ignored.
      │ true
      ├─ ORCHESTRATOR_ENABLED ── false ─► Phase-1 wrapper only (pass-through + wrapper telemetry).
      │        │ true
      │        ├─ DOMAIN_AGENTS_ENABLED ── false ─► + intent/selection OBSERVED (logged, not acted on).
      │        │        │ true
      │        │        ├─ MULTI_AGENT_ENABLED ── false ─► + ONE domain agent (Finance), Compliance-gated.
      │        │        │        │ true
      │        │        │        ├─ (always) ─► parallel + conflict + confidence + decision pipeline.
      │        │        │        ├─ CRITIC_ENABLED ─► + high-stakes Critic pass.
      └────────┴────────┴────────┴─ COMPLIANCE_AGENT_ENABLED ─► + LLM-assist before the deterministic gate.
```

| LIOS | ORCH | DOMAIN | MULTI | CRITIC | COMPLY | Effective behavior                       |
| ---- | ---- | ------ | ----- | ------ | ------ | ---------------------------------------- |
| 0    | x    | x      | x     | x      | x      | **Baseline** — identical to today        |
| 1    | 0    | x      | x     | x      | x      | Wrapper pass-through (Phase 1)           |
| 1    | 1    | 0      | x     | x      | x      | + intent/selection observed (Phase 2–3)  |
| 1    | 1    | 1      | 0     | x      | x      | + Finance domain agent (Phase 4)         |
| 1    | 1    | 1      | 1     | 0      | 0      | + parallel/conflict/decision (Phase 5–7) |
| 1    | 1    | 1      | 1     | 1      | 0      | + Critic (Phase 8)                       |
| 1    | 1    | 1      | 1     | 1      | 1      | Full LIOS (Phase 9–10)                   |

`x` = don't-care (ignored because an ancestor is off). A child flag that is ON while an ancestor is OFF is a
**config error**: log a startup warning and treat the child as OFF (fail safe toward baseline, never toward more
LLM surface). This is validated once at process start when `Settings` is read.

## 4. The kill-switch guarantee

**Rule: `LIOS_ENABLED=false` ⇒ today's `AdvisorOrchestrator` path, exactly.** Mechanically:

1. `get_advisor_orchestrator` branches on `LIOS_ENABLED` as the **first** check; if false it returns the
   existing object built exactly as `dependencies.py:268` does today (no wrapper, no registry, no new imports
   on the hot path).
2. No LIOS code is on the request path when off — the wrapper is the only entry point and it is not created.
3. Telemetry stays as-is (`advisor_turns` baseline fields only); new event fields are simply not written.
4. Reverting is one command, no redeploy of code: `flyctl secrets unset LIOS_ENABLED -a lifenavigator-core-api`
   (or set to `false`); Fly restarts the machine and the next request is baseline. No web change required.

**"One toggle returns to baseline":** flipping `LIOS_ENABLED` off neutralizes the entire ladder regardless of
the other five flags' values, because they are all descendants in §3. Operators never need to remember to also
turn off the children.

## 5. Per-user / per-cohort gating

Env flags gate the **global** posture (off in prod). For ramped rollout, layer the existing ops tables on top —
they already exist (`supabase/migrations/090_beta_ops_feedback_meter.sql`):

- `ops.feature_flags` (`slug, enabled, rollout_pct, cohort_slug, allowed_user_ids[]`) — line 68.
- `ops.user_feature_flag_overrides` (`user_id, flag_slug, enabled, expires_at`) — line 82.
- `ops.cohorts` + `ops.user_cohorts` — cohort membership.

**Plan:** seed `feature_flags` rows with slugs `lios_enabled`, `domain_agents_enabled`, `multi_agent_enabled`
(etc.). At turn start, resolve effective state as:

```
effective(flag, user) =
    env_flag(FLAG)                                  # global master gate; if false → OFF
  AND ( ops.user_feature_flag_overrides[user]       # per-user override wins when present (and not expired)
        ?? in_cohort(user, feature_flags.cohort_slug)
        ?? user_in(feature_flags.allowed_user_ids)
        ?? bucket(user, feature_flags.rollout_pct) ) # deterministic hash bucket for % rollout
```

The **env flag is always an AND-gate above the DB**: a per-user override can never enable LIOS while
`LIOS_ENABLED=false` globally — so the kill switch in §4 is absolute. DB gating only _narrows_ an
env-enabled flag to a cohort/percentage. This keeps internal/founder/20-person stages (see `GO_LIVE_PLAN.md`)
addressable by `allowed_user_ids`/cohort without a redeploy, while prod stays off by default.

## 6. Reversibility & defaults summary

- All six flags **default OFF in prod** (set explicitly in `fly.toml [env]` / Fly secrets; `Settings` defaults
  also OFF so a forgotten env var fails safe).
- Every flag is independently testable via `Settings(LIOS_ENABLED=True, ...)` in unit tests (no env needed).
- The deterministic trust spine (RelationshipManager persistence, `advisor_validator`, `RecommendationOS`
  evidence-or-nothing, citation contract) is **never** behind a flag — it runs in every path, baseline or LIOS.
- Acceptance for this strategy: a golden-diff test proves output is byte-identical between `LIOS_ENABLED` off
  and the pre-LIOS build for the eval persona set (the Phase-1 acceptance in `ORCHESTRATOR_IMPLEMENTATION_PLAN.md`).
