# Advisor Conversation Intelligence

The agent that connects the user's actual words to the
intelligence stack underneath. Builds on top of:

| Sprint | Provides                                                                 |
| ------ | ------------------------------------------------------------------------ |
| A      | base `AdvisorConversationAgent` + the LLM bypass guard                   |
| E      | XAI / Trust Layer (deterministic WhyChain / Counterfactual / Assumption) |
| F      | ProbabilityEngine / DecisionImpactEngine / Catch-Up / Ranker             |
| G      | Curated central knowledge (CFP / BLS / IRS / VA / ACSM / ABA)            |

Sprint H adds the **conversation-level** intelligence — Need-Behind-Need
drill-down, driver inference, domain prompting, and five explainers
that make every decision-engine output answerable in natural
language.

No new dashboards. The conversation surface is API-level only;
front-end teams consume the structured payloads.

## What shipped

| Deliverable                                                                | File                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Migration 084 — 3 tables + RLS + sync triggers                             | `supabase/migrations/084_conversation_intelligence.sql`                                                 |
| Types                                                                      | `apps/web/src/types/conversation-intel.ts`                                                              |
| `DriverInferenceEngine` (pure, deterministic)                              | `apps/web/src/lib/conversation/driver-inference-engine.ts`                                              |
| `NeedBehindNeedEngine` (pure, deterministic)                               | `apps/web/src/lib/conversation/need-behind-need-engine.ts`                                              |
| Domain prompt library + driver-tuned phrasing                              | `apps/web/src/lib/conversation/domain-prompts.ts`                                                       |
| 5 explainers (tradeoff / simulation / probability / assumption / followup) | `apps/web/src/lib/conversation/conversation-explainers.ts`                                              |
| API routes                                                                 | `apps/web/src/app/api/discovery/{start,[id]/turn,[id]/state}` + `api/explainers/{probability,tradeoff}` |
| Rust worker — 3 new entity types                                           | `apps/ingestion-worker/src/{entities,normalizer}.rs` + `tests/conversation_entities.rs`                 |
| RLS verifier                                                               | `scripts/validation/verify_084_conversation_rls.sql`                                                    |
| This doc                                                                   | `ADVISOR_CONVERSATION_INTELLIGENCE.md`                                                                  |

## Verification

| Check                                            | Result                                           |
| ------------------------------------------------ | ------------------------------------------------ |
| Rust `cargo test`                                | **45 / 45** (was 42; +3 `conversation_entities`) |
| Rust `cargo fmt --check`                         | clean                                            |
| Rust `cargo clippy --all-targets -- -D warnings` | clean                                            |
| Web strict `tsc --noEmit -p tsconfig.json`       | clean                                            |
| Web jest                                         | **523 / 523** (was 473; +50)                     |
| Migration 084 self-test                          | raises if any of 3 tables lacks RLS              |
| `verify_084_conversation_rls.sql`                | per-table A↔B isolation + 2 write-as-B blocks    |

---

## 1. Schema (migration 084)

Three new tables in `decision_intelligence`:

| Table                   | Purpose                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discovery_sessions`    | Session-level state: `domain`, `current_depth`, `max_depth`, three driver scores, `dominant_driver`, `secondary_driver`, `driver_confidence`, `inferred_root_goal`. Links back to `goal_discovery_turns` via `primary_session_token`. |
| `assumption_challenges` | Per-Socratic-challenge: `assumption_text`, `challenge_prompt`, `challenge_kind` (`what_if / why_assume / counter_evidence / time_pressure / recency_bias`), `user_response`, `response_state`, `changed_outcome`.                     |
| `conversation_traces`   | Per-turn structured audit: `turn_index`, `classified_intent`, `turn_kind`, `explainer_kind`, `used_llm`, `llm_calls`, `llm_rejected_mutations[]`, `detected_drivers`, missing/contradiction counts.                                   |

Strict owner-only RLS + service_role escape hatch + public read-views.
The shared `trigger_decision_intel_sync()` function is extended in 084
to add the three new entity-type mappings (`discovery_session`,
`assumption_challenge`, `conversation_trace`).

---

## 2. Driver Inference Engine

`apps/web/src/lib/conversation/driver-inference-engine.ts`

```ts
inferDrivers({ current_text, prior_per_turn_scores }) → DriverInferenceResult
```

Hand-coded lexical pattern matcher — **not** an LLM classifier — so
the same answer text always produces the same scores. Three driver
families, mirroring the Achieve Global framework:

| Driver                 | Sample lexical signals                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Financial Security** | "safe", "secure", "stability", "worry", "running out", "sleep at night", "peace of mind", "emergency", "nest egg", "provide for my family", "take care of my kids", "never had", "growing up"  |
| **Image**              | "respect(ed)", "recognition", "status", "legacy", "what people see", "people to see what I built", "reputation", "validate", "prestige", "brand", "set an example", "role model", "successful" |
| **Performance**        | "achieve", "optimize", "progress", "mastery", "best version of", "push myself", "potential", "maximize", "personal record / PR / best", "level up", "compete", "challenge myself"              |

Each utterance produces a `DriverScores` triple in `[0,1]` (normalized
so the three sum to ≤ 1). Session-level cumulative scores are
averaged across all per-turn scores; the dominant + secondary driver
are chosen from the top two when the gap is ≥ 0.05.

**Confidence ramp** (number of observed turns → confidence):

```
0 turns → 0
1 turn  → 0.3
3 turns → 0.6
5 turns → 0.8
6+ turns → 0.85
```

**Tests (14 in `driver-inference-engine.test.ts`):** driver matrix
across all three families, determinism contract, empty-input handling,
combineDriverScores averaging, pickDominantSecondary tie-handling,
confidenceFromObservations curve, full-session inference.

---

## 3. Need-Behind-Need Engine

`apps/web/src/lib/conversation/need-behind-need-engine.ts`

Implements Achieve Global's **"What? What? Why?"** recursive
drill-down. Same conversation history → same tree, every time.

### Drill-down semantics

```
Level 0 — what_accomplish   "What do you want?"
   ↓
Level 1 — what_unlock        "What would that get you / let you do?"
   ↓
Level 2 — why_important      "Why does that matter to you?"
   ↓
Level 3 — why_important      "And why does THAT matter?"   (optional)
```

### Termination heuristics

The engine stops drilling when ONE of:

| Reason                | Trigger                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `max_depth`           | Hit configured limit (default 3)                                                                           |
| `values_reached`      | Answer contains "because" / "I value" / "matters to me" / "always wanted" / "never had" / "my identity"    |
| `consequence_reached` | Answer contains "can't afford to" / "if I don't" / "people will think" / "miss out" / "run out" / "end up" |
| `low_signal`          | < 3 word answer (no real signal to drill into)                                                             |

`inferred_root_goal` is synthesized from the deepest node when
`values_reached` or `consequence_reached`; from the last+first answers
concatenated otherwise. `inferred_root_confidence` is calibrated:

```
values_reached       → 0.85 base (+ depth boost)
consequence_reached  → 0.7
max_depth            → 0.6
low_signal           → 0.4
```

### Domain prompting

For each `(domain, prompt_kind)` pair the engine selects the
appropriate question from `domain-prompts.ts`. When the cumulative
session has surfaced a `dominant_driver`, the **driver-tuned variant**
is used:

| Domain    | What_accomplish prompt (Financial Security variant)                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Financial | _"When you imagine having 'enough' financially, what does that picture look like for you and the people you care about?"_ |
| Career    | _"What career trajectory would make the rest of your financial life unhurried?"_                                          |
| Health    | _"What state of health do you need to be in to know your future medical risks are managed?"_                              |
| Education | _"What education or credential would meaningfully lower your career or income risk?"_                                     |
| Estate    | _"What protection do you want in place for the people who depend on you — even if something happens tomorrow?"_           |

Each domain has Neutral / Financial Security / Image / Performance
variants for `what_accomplish`, `what_unlock`, `why_important`, plus
closing prompts (`success_definition`, `consequence_of_inaction`,
`urgency`).

**Tests (10 in `need-behind-need-engine.test.ts`):** termination
matrix, depth-0 → next_prompt correctness, values_reached
termination at confidence > 0.7, max_depth termination, low_signal
termination, determinism contract, driver-tuned phrasing selection.

---

## 4. Five Conversation Explainers

`apps/web/src/lib/conversation/conversation-explainers.ts`

Every explainer is **pure + deterministic** and returns a structured
`ExplainerOutput<Body>` envelope with:

```
{ kind, headline, body, uncertainty_language[], follow_ups[],
  phrasing_hint?, citations[] }
```

The LLM (Gemini `LlmExplainer` from Sprint A) is allowed to rephrase
the headline and body text but not the structured fields — same
no-manipulation contract enforced by `sanitizeLlmOutput`.

| Explainer             | Input                                                                    | Body shape                                                                                                     |
| --------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `explainTradeoff`     | `RecommendationOutput` + optional `dominant_driver`                      | `framings[]` (summary / gives_up / gains / net_assessment) + `hard_constraint_warnings[]`                      |
| `explainSimulation`   | `RecommendationOutput` + ranked hierarchy-aware scenarios + cycles_count | `evaluated_scenarios`, `best_scenario_id`, `best_scenario_score`, `ranked_summary[]`, `cycles_warning?`        |
| `explainProbability`  | `ProbabilityDistribution` + optional `dominant_driver`                   | `time_horizon`, `most_likely_text`, `range_text`, `confidence_text`, `variance_summary`, `what_would_change[]` |
| `challengeAssumption` | assumption_text + sensitivity + counter_evidence                         | `assumption_text`, `challenge_kind`, `prompt`, `what_changes_if_flipped`, `evidence_against[]`                 |
| `askFollowup`         | reason + field + question_text + why + options?                          | `question`, `prompt_kind`, `why`, `binds_to?`, `options[]?`                                                    |

### Uncertainty language is always present

Every explainer surfaces hedge phrases the UI MUST display alongside
the answer. Examples:

| Explainer   | Hedge phrase                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tradeoff    | _"Tradeoff weights are estimates; actual experience depends on follow-through."_                                                          |
| Simulation  | _"Scenario scores are deterministic snapshots, not predictions."_                                                                         |
| Probability | _"These quantiles are scenario-based estimates, not statistical confidence intervals."_                                                   |
| Assumption  | _"Challenging an assumption is not the same as rejecting the recommendation. If the assumption survives, confidence in the rec goes UP."_ |

### Driver-tuned net assessment (tradeoff)

The net-assessment phrasing varies by dominant driver to land in the
user's frame:

| Driver             | Phrasing template                                                       |
| ------------------ | ----------------------------------------------------------------------- |
| Financial Security | _"You trade [give-up] for greater certainty on [gain]."_                |
| Image              | _"Net: [gain] — the kind of move that's visible to people who matter."_ |
| Performance        | _"Net: more progress on [gain], less slack on [give-up]."_              |
| Neutral            | _"Net: gains '[gain]', costs '[give-up]'."_                             |

**Tests (16 in `conversation-explainers.test.ts`):** each explainer's
determinism + structural correctness, headline format, uncertainty
language presence, challenge kind classifier (5 cases), follow-up
prompt kind selection.

---

## 5. API surface

| Method + path                      | Purpose                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/discovery/start`        | Open a session for the chosen domain. Returns the first prompt (driver-neutral).                                                                                                            |
| `POST /api/discovery/[id]/turn`    | Records the user's answer, runs `buildDrillDown`, scores drivers cumulatively, persists to both `discovery_sessions` and `goal_discovery_turns`, returns next prompt OR completion summary. |
| `GET /api/discovery/[id]/state`    | Read-only — returns session + all linked turns.                                                                                                                                             |
| `POST /api/explainers/probability` | Wraps `ProbabilityDistribution` → `ProbabilityExplanation`.                                                                                                                                 |
| `POST /api/explainers/tradeoff`    | Wraps `RecommendationOutput` → `TradeoffExplanation`.                                                                                                                                       |

All routes derive `user_id` strictly from the server session — never
from the request body. RLS bounds every read and write.

---

## 6. The integration story

```
User                                                          ┌──────────────────────────────────────┐
 │   "I want to pay off all my debt and own a home"           │       Sprint A AdvisorReasoning      │
 │                                                             │   (deterministic recommendation)     │
 ▼                                                             └────────────────┬─────────────────────┘
┌────────────────────────────────────────┐                                       │
│ /api/discovery/start { domain: 'financial' } ─► discovery_sessions row         │
│                                                                                 │
│  ┌───────────────────────┐                                                      │
│  │ DriverInferenceEngine │  scoreTurn("...debt...own a home")                  │
│  │   (lexical, det.)     │  → financial_security: 0.3, performance: 0.7         │
│  └─────────┬─────────────┘                                                      │
│            ▼                                                                    │
│  ┌─────────────────────────────────┐                                            │
│  │ NeedBehindNeedEngine            │  Next prompt = "what_unlock" (performance) │
│  │   buildDrillDown                │  → "If you reached that, what bigger      │
│  │   (det.)                        │     ambition becomes the next target?"    │
│  └─────────┬───────────────────────┘                                            │
│            ▼                                                                    │
└────────────┴──────► /api/discovery/[id]/turn — next prompt                      │
                                                                                  │
 User answers ...                                                                 │
                                                                                  │
 At max_depth or values/consequence reached → inferred_root_goal written to       │
   goals.root_goal, dominant_driver to discovery_sessions, mirrored into          │
   goal_discovery_turns. The recommendation engine reads it on the next pass.     │
                                                                                  ▼
                                              ┌──────────────────────────────────────────┐
                                              │  /api/explainers/probability             │
                                              │  /api/explainers/tradeoff                │
                                              │  + Sprint E XAI APIs (why / evidence /   │
                                              │      assumptions / counterfactuals)      │
                                              └──────────────────────────────────────────┘
```

Every layer below the conversation surface is unchanged. Sprint H is
purely additive.

---

## 7. The determinism + no-manipulation contracts (still in force)

This sprint extends but does not weaken the contracts established in
Sprints A + E:

1. **Same input → same output** for `inferDrivers`, `buildDrillDown`,
   `selectPrompt`, all five explainers.
2. **LLM bypass guard** (`sanitizeLlmOutput` from Sprint A) is
   unchanged. The new explainer outputs add fields the LLM cannot
   mutate — `headline`, `body`, `uncertainty_language[]`,
   `follow_ups[]`, `citations[]` — only the _phrasing_ of free-text
   fields may be rephrased.
3. **Personal Learning Profile `PROTECTED_KEYS`** (Sprint Decision
   Intelligence Completion) is unchanged. The five new transparency
   fields on `RecommendationOutput` remain protected from learning-
   layer mutation.
4. **No timing manipulation.** No `delay_until` / `surface_at`
   anywhere in the conversation layer. Drill-down depth is bounded by
   `max_depth`; no infinite recursion.

---

## 8. What this sprint did NOT do

- ❌ No new dashboards.
- ❌ No new database tables in `central.*` or `goals` (we use the
  existing `goal_discovery_turns` table with the new
  `discovery_sessions` orchestration).
- ❌ No LLM in the answer path. The five explainers and the
  drill-down engine are deterministic.
- ❌ No automated session resumption / pause-and-resume scheduling.
  Sessions terminate by reaching `max_depth` / `values_reached` /
  `consequence_reached` / `low_signal`. Long-running multi-week
  sessions are a follow-up.

---

## Apply + verify runbook

```bash
psql "$DATABASE_URL" -f supabase/migrations/084_conversation_intelligence.sql
psql "$DATABASE_URL" -f scripts/validation/verify_084_conversation_rls.sql

pnpm --filter @life-navigator/web test \
  --testPathPattern='lib/conversation/__tests__'

cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected:

- Migration applies cleanly + self-test passes + no destructive
  statements.
- RLS verifier prints `ALL PASS`.
- Web jest 523/523; cargo 45/45; fmt + clippy silent.
