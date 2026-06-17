# Onboarding Quality Evaluation — LIOS vs. today's chat-native discovery

> Phase 5 — **evaluation only.** No code, no orchestration, no deploy, no beta change. Companion to
> `LIOS_SIMULATION_FRAMEWORK.md`. Grounded in the live discovery engine
> (`apps/lifenavigator-core-api/app/services/life_discovery.py`), the coverage engine
> (`app/services/discovery_coverage.py`), the rec engine (`app/services/recommendations_os.py`), and the
> specs `GOAL_DISCOVERY_AGENT.md`, `GOAL_CONFLICT_AGENT.md`, `MISSING_DATA_AGENT.md`. Improvement estimates
> are labeled **(estimate)** with a stated basis; where unmeasured, we say so.

---

## 1. The question

**Would LIOS improve goal discovery / constraint discovery / tradeoff discovery / relationship building /
family-context capture vs. today's chat-native discovery?**

Today's advisor already does **single-strong-question discovery at 0% fallback, 0 trust violations**
(framework §1). Onboarding is _not_ a blank slate that LIOS lights up — it is a working discovery flow.
`life_discovery.discover_goal` already: reasons about a surfaced goal, **probes once when uncertain instead
of guessing** (lines 411–416: `needs_followup` → one `followup_question`), decomposes the goal, extracts
**constraints from the user's own words** (lines 454–461, "grounded — explicitly provided by the user"),
emits **dependencies** as honest open requirements (lines 446–453), and **supersedes** stale objectives. The
deterministic `DiscoveryCoverageService` already computes **per-domain missing inputs** and a coverage % and
"what completing it unlocks" (discovery_coverage.py:36–97). So most onboarding intelligence the specs
describe as agents is **already live, deterministic, and trust-gated.**

The plausible LIOS gains are narrow: **(a) explicit value-of-information _ranking_ of missing data** across
domains, and **(b) goal-to-goal _tradeoff_ surfacing** with cited edges. Both are real; neither requires the
full per-agent fan-out the specs imply.

---

## 2. Per-dimension assessment

### 2.1 Goal discovery — **None / Low (estimate)**

Today: `discover_goal` already maps a surface goal → root objective, probes once on ambiguity, and never
invents a goal (lines 408–418; trust rule lines 439–445: "an objective MUST NOT auto-create RISKS or
OPPORTUNITIES from the archetype"). `GOAL_DISCOVERY_AGENT.md` is explicitly marked **"LIVE within discovery —
maps to `life_discovery.discover_goal`"** (spec §header). The agent's contract (propose grounded candidates,
ask one clarifying question, never persist on guess, never resurrect rejected) is _already the live
behaviour_. **Basis for None/Low:** the spec describes what ships; an LLM reformulation buys phrasing, not new
goals. The advisor's 0% fallback says intent capture already works. **Estimate: None to Low** — marginal
phrasing only.

### 2.2 Constraint discovery — **Low (estimate)**

Today: constraints come from the user's own statement via `analyze()` and persist with `kind/detail/severity`
(lines 454–461). They are _grounded_, not archetypal. A richer LLM extractor _might_ catch more
implicitly-stated constraints ("I can't relocate," "after my kid starts school") that a keyword/analyze pass
misses — a genuine but **unproven** lift. **Estimate: Low**, contingent on a measured miss-rate of the
current extractor (not yet measured). Risk: an LLM that _infers_ unstated constraints would violate the
"explicitly provided by the user" grounding rule and reintroduce fabrication.

### 2.3 Tradeoff discovery — **Medium (estimate) — the strongest case for LIOS**

Today: recommendation-level _resource_ conflicts are detected deterministically (`_conflicts`,
recommendations_os.py:635–655 — money/time, competing set, suggested sequence). But **goal-to-goal** tradeoffs
(e.g. "down payment vs. emergency liquidity") are only **PARTIAL** — `GOAL_CONFLICT_AGENT.md` (§header) maps
to `advisor_context.connected_pairs` + the validator's `_check_relationships`, i.e. the citation gate exists
but goal-to-goal tradeoff _framing_ is not a first-class onboarding output. This is a real gap: surfacing
"these two goals you told us pull against each other, here's what each costs/protects, which matters more?"
is high-value during onboarding and _not_ fully delivered today. **Estimate: Medium** — but note the value is
in the _cited-edge detection + framing_ (deterministic-adjacent), not in an LLM that _resolves_ the tradeoff
(forbidden by the spec, §3 — resolution escalates to Decision Scientist). The win is "surface the cited
tradeoff," which leans on GraphRAG edges + the existing validator, not on a new LLM reasoning call.

### 2.4 Relationship building (rapport / conversational quality) — **Low (estimate)**

Today: the advisor is hybrid (rules guardrail + LLM-led narration), single strong question, 0% fallback. An
extra discovery agent does not make the conversation warmer; the LLM that talks to the user is already the
LLM. **Estimate: Low.** Decision-evasiveness (~19%, framework §1) is a _narration/decisiveness_ problem, not
a missing-agent problem — adding agents does not fix it and may add latency that hurts perceived rapport.

### 2.5 Family-context capture — **Low / None (estimate)**

The Family domain is already a real domain summary (`family_office.assess`) feeding the rec engine (estate
DEPENDENCY, life-insurance RISK; recommendations_os.py:274–316). Family facts are captured through the same
discovery/document flow and are already evidence-gated. A dedicated Family discovery _agent_ adds an LLM call
without a measured capture gap. **Estimate: Low to None** — the deterministic family engine + document
intelligence already populate the context; the gap, if any, is data _upload_, not discovery _reasoning_.

| Dimension                | Expected improvement (estimate) | Why                                                   |
| ------------------------ | ------------------------------- | ----------------------------------------------------- |
| Goal discovery           | **None–Low**                    | `discover_goal` is LIVE; 0% fallback; spec maps to it |
| Constraint discovery     | **Low**                         | already user-grounded; richer extractor unproven      |
| Tradeoff discovery       | **Medium**                      | goal-to-goal cited tradeoffs only PARTIAL today       |
| Relationship building    | **Low**                         | same LLM already narrates; evasiveness ≠ agent gap    |
| Family-context capture   | **Low–None**                    | deterministic family engine already feeds context     |
| Missing-data **ranking** | **Medium**                      | see H1 below — ranking ≠ raw missing list             |

---

## 3. The merge hypothesis H1 (the core test)

**H1: Goal Discovery + Goal Conflict + Missing Data → one "Discovery Analyst" in ONE LLM call, not three.**

The framework (§4, H1) and the unit economics (§1: one LLM call ≈ 7–8s / ~3k tokens) make this the decisive
question. Three separate LLM agents = **+3 serial calls ≈ 21–24s / ~9k tokens** for a single discovery turn.

**The merge is sound — and partly already realized deterministically.** All three operate on the _same
discovery context_ in one reasoning step:

- **Goal Discovery** is already live deterministically (`discover_goal`), so it contributes **0 new LLM
  calls** — it does not need to be an LLM agent at all (H1's premise that "3 calls → 1" is conservative; the
  honest count today is closer to "1 LLM narration call wrapping mostly-deterministic work").
- **Missing Data** is _measuring absence_ — and `DiscoveryCoverageService` already computes the per-domain
  missing list, coverage %, and unlocks **deterministically** (discovery_coverage.py:42–97). The
  `MISSING_DATA_AGENT` spec is explicitly **PARTIAL — maps to `discovery_coverage.py`** (spec §header). The
  _only_ increment an LLM adds is **value-of-information _ranking_** ("the single most valuable thing we don't
  know for _this_ question," spec §1) — and even that can be a deterministic priority over the existing
  coverage list before reaching for an LLM. **Estimate: Medium** for ranking, **None** for the raw list
  (already live).
- **Goal Conflict** needs the cited goal-to-goal edges (§2.3) — a GraphRAG read + the existing validator,
  not necessarily its own LLM call.

**Conclusion on H1:** collapse all three into **one** "Discovery Analyst" reasoning step that _reads_ the
deterministic coverage map + the deterministic discovery output + GraphRAG edges and produces, in a single
gated call: (ranked missing inputs) + (any cited goal-to-goal tradeoff to pose) + (the one next question).
This turns **3 LLM calls → 1**, cutting ~14–16s and ~6k tokens off a discovery turn (framework §1) with **no
loss** — because two of the three were already deterministic. The framework's projection (H1–H3 → complex
turn from 6–10 calls to ~2–3) is supported here for the onboarding path specifically.

---

## 4. Where onboarding genuinely improves vs. "same advisor + more machinery"

**Genuinely improves (worth building, narrowly):**

1. **Value-of-information ranking of missing data** (Medium estimate) — turning the existing deterministic
   coverage list into a _ranked "ask this next"_ with `why_it_matters`. This is the bridge the lifecycle doc
   asks for (`RECOMMENDATION_LIFECYCLE.md` §10 open-Q1: "Should `missing_inputs` be the bridge that turns a
   low-confidence rec into the advisor's next question?"). Best done as a **deterministic ranking first**, LLM
   only if a measured gap remains.
2. **Goal-to-goal cited tradeoff surfacing** (Medium estimate) — the one onboarding dimension that is only
   PARTIAL today (§2.3). Built on GraphRAG edges + the existing validator citation gate, _not_ an LLM that
   resolves the tradeoff. The value is honest surfacing ("here's the tension, you decide"), which fits the
   live trust posture (0 trust violations).

**Same advisor with more machinery (do NOT build as separate LLM agents):** 3. A **Goal Discovery LLM agent** — `discover_goal` already ships this behaviour; an LLM agent adds latency,
not goals. 4. A **Missing Data LLM agent that re-derives the coverage map** — `DiscoveryCoverageService` already does it;
the LLM's only add is ranking, which folds into H1's single call. 5. A **Family discovery LLM agent** — the deterministic family engine already feeds context; the real gap is
document _upload_, not reasoning. 6. **Three separate discovery LLM calls** — rejected by H1: +14–16s / +6k tokens for output a single gated
"Discovery Analyst" call (over deterministic inputs) produces.

---

## 5. Risks specific to onboarding LIOS

- **Latency on the first impression.** Onboarding is where a slow turn costs most (abandonment). Three serial
  discovery LLM calls (~21–24s) would _worsen_ perceived onboarding vs. today's single-question flow. H1 is
  not optional here — it is the difference between an acceptable and an unacceptable first turn.
- **Re-opening fabrication.** Today constraints/goals are user-grounded (lines 439–461). An LLM agent that
  _infers_ unstated goals/constraints/conflicts without the citation gate would regress the 0-trust-violation
  posture. Any onboarding agent must keep the live grounding rules (`GOAL_DISCOVERY_AGENT.md` §3,
  `GOAL_CONFLICT_AGENT.md` §3 — no edge ⇒ no conflict claim).
- **Decisiveness is not an agent gap.** The ~19% evasiveness (framework §1) is a narration property of the
  one LLM that already talks; more discovery agents do not address it.

---

## 6. Conclusion

| Dimension                             | Verdict                               | Estimate   |
| ------------------------------------- | ------------------------------------- | ---------- |
| Goal discovery                        | already live; LIOS = same             | None–Low   |
| Constraint discovery                  | already user-grounded; marginal       | Low        |
| **Tradeoff discovery (goal-to-goal)** | **genuine gap today**                 | **Medium** |
| Relationship building                 | same LLM narrates                     | Low        |
| Family-context capture                | deterministic engine already feeds it | Low–None   |
| **Missing-data _ranking_**            | **genuine, via H1's single call**     | **Medium** |

**Bottom line:** onboarding genuinely improves on exactly **two** dimensions — **value-of-information ranking
of missing data** and **cited goal-to-goal tradeoff surfacing** — both of which are _deterministic-adjacent_
and both of which **H1 collapses into a single "Discovery Analyst" call** (3 LLM calls → 1, saving ~14–16s /
~6k tokens with no loss, because Goal Discovery and the missing-data map are already deterministic/live).
Everything else is the same advisor with more machinery. **Recommendation:** build the merged single-call
Discovery Analyst over the existing deterministic discovery + coverage + GraphRAG layers; do **not** build
three independent discovery LLM agents.
