# LIOS — Evaluation Framework

> How LifeNavigator's intelligence is evaluated: the dimensions, the metrics, the harnesses, the golden sets,
> the gates, and the cadence. This is the framework that the lifecycle documents and the architecture must
> satisfy before (and after) implementation. Architecture review only — no code, no prompts.

> "We cannot optimize what we cannot see." Evaluation is a first-class part of LIOS, not an afterthought.

---

## 1. Evaluation dimensions

LIOS is evaluated on five dimensions. **Trust is a gate (must pass); the others are graded.**

| Dimension          | Question                                                         | Type                      |
| ------------------ | ---------------------------------------------------------------- | ------------------------- |
| **Trust / Safety** | Does it ever fabricate, mis-advise, or leak?                     | **GATE — zero tolerance** |
| **Quality**        | Is the guidance useful, specific, non-evasive, expert-grade?     | graded                    |
| **Coverage**       | Does it produce enough high-value guidance for a data-rich user? | graded                    |
| **Latency / UX**   | Is it fast (or fast-feeling via streaming)?                      | graded vs targets         |
| **Observability**  | Can every decision be explained after the fact?                  | gate (must be on)         |

---

## 2. Trust gate (must be 0 — non-negotiable)

These are the hard invariants from the lifecycle docs, evaluated as pass/fail. Any non-zero is a release
blocker.

| Metric                                                   | Target | Source lifecycle         |
| -------------------------------------------------------- | ------ | ------------------------ |
| Invented goals / risks / opportunities / recommendations | **0**  | risk, recommendation     |
| Fabricated financial numbers (outside allowed-numbers)   | **0**  | fact                     |
| Ungrounded relationship claims (no cited edge)           | **0**  | relationship             |
| Recommendations without evidence                         | **0**  | recommendation           |
| Final financial / legal / medical / tax advice           | **0**  | compliance               |
| Rejected-goal resurrection                               | **0**  | fact, goal               |
| Candidate/assumption shown as confirmed                  | **0**  | fact                     |
| Archetype/generic-label risks/opps                       | **0**  | risk                     |
| LLM-initiated writes                                     | **0**  | all (LLM never persists) |

These are already measured live by the harnesses (the latest runs show 0 across the board).

---

## 3. Quality metrics (graded)

| Metric                      | Definition                                                                       | Current/target                                            |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Fallback rate**           | % turns served by deterministic fallback instead of enhanced LLM                 | live **0%**; target < 5%                                  |
| **Validation failure rate** | % LLM outputs rejected by Compliance                                             | live ~0%; lower is better (but never by weakening safety) |
| **Repair rate**             | % outputs repaired (e.g. multi-question trimmed)                                 | tracked; informational                                    |
| **Decision evasiveness**    | % decision turns that deflect to generic "vision" instead of engaging            | reduced to ~19% vision-deflection; lower is better        |
| **Context use**             | % decision turns that use the user's stated numbers                              | improving (same-message live; cross-turn = gap)           |
| **Recommendation quality**  | evidence-backed? assumptions explicit? would it survive expert (CFP/CPA) review? | structurally expert-grade; coverage unmeasured            |
| **Confidence calibration**  | does stated confidence match outcomes?                                           | planned (needs the feedback loop)                         |

---

## 4. Coverage metrics (graded)

| Metric                    | Definition                                                         | Status                                               |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Recommendation coverage   | # high-value recs produced for a **data-rich** user                | **gap — fresh-user evals only test the empty state** |
| Domain coverage           | each domain returns a real summary + recs when data exists         | partial                                              |
| Grounded-graph path       | the cite-a-real-edge path is exercised (not just the abstain path) | **gap — needs a seeded-graph persona**               |
| Document → truth coverage | uploaded docs produce cited facts across the taxonomy              | partial                                              |

> Coverage is the biggest measurement gap today: trust + empty-state correctness are proven, but the
> _richness_ of guidance for a user with real data is not yet measured. The eval personas must be extended
> with seeded finance accounts + documents + a connected graph.

---

## 5. Latency / UX metrics

| Metric                                | Target                   | Live                          |
| ------------------------------------- | ------------------------ | ----------------------------- |
| Time-to-first-useful-text (streaming) | < ~2s                    | **~1.3s** (deterministic ack) |
| Full validated answer (avg)           | < 4s                     | ~9–10s (model-bound)          |
| Full validated answer (p95)           | < 6s                     | ~13–16s                       |
| Stage attribution                     | `llm_generate` dominates | measured (~76%)               |

Streaming satisfies the perceived-latency goal; raw full-answer latency remains a graded gap (addressed by
streaming UX today; a true reduction needs prompt trimming or a faster model — future).

---

## 6. Observability gate (must be on)

Every turn must produce a durable, queryable record sufficient to answer:

- Why did the advisor say this? (raw output + composed response)
- Why did Compliance accept/repair/reject? (validator_result + reason + repairs)
- Why did a fallback occur? (fallback_reason)
- What context did it use? (graph edges available, relationships referenced; planned: full retrieval set)
- Where did the time go? (stage latencies)
- What did it cost? (tokens)

Live: `analytics.advisor_turns` + `analytics.advisor_turn_metrics` + `GET /v1/admin/advisor-metrics`.

---

## 7. The harnesses (how we measure — live)

| Harness                                | What it drives                               | Produces                                            |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `apps/web/advisor-eval.mjs`            | 12 personas × turns + adversarial, live      | fallback rate, latency, deterministic trust checks  |
| `apps/web/advisor-decisions-probe.mjs` | the hard-decision questions across 6 domains | decision fallback/latency, evasiveness, context use |
| `apps/web/fresh-user-e2e.mjs`          | a brand-new user across all surfaces         | journey health, honest empty states, 0 errors       |
| `analytics.advisor_turn_metrics`       | the live rollup                              | fallback rate, p95 latency, validation failure rate |

All mint + clean up their own users, hit the live backend, and run deterministic checks. Subjective quality
(CFP-grade) is sampled by a human/judge — **never machine-fabricated** (per the no-fabrication ethos).

**Planned harness additions:** data-rich personas (finance + documents) for coverage; a seeded-graph persona
for the grounded-citation path; a decision golden-set for tradeoff-framing quality; an adversarial Critic
panel for high-stakes claims.

---

## 8. Golden sets (planned)

Per entity type, a curated golden set anchors quality regression:

- **Fact golden set:** statements → expected category + provenance.
- **Risk golden set:** seeded data → expected evidence-backed risks (and expected _non_-risks).
- **Recommendation golden set:** data-rich profiles → expected high-value recs with evidence (coverage).
- **Relationship golden set:** seeded graph → expected citable edges (and claims that must be refused).
- **Decision golden set:** decision prompts + inputs → expected modeled tradeoffs + named missing inputs +
  the advice line held.

Golden sets are reviewed by a human; outputs are scored against them; drift is a regression signal.

---

## 9. Evaluation cadence & gates

| When                          | What runs                                       | Gate                                              |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Every prompt/validator change | the relevant harness + the validator unit tests | trust = 0; fallback not worse; safety tests pass  |
| Pre-deploy                    | advisor-eval + decisions-probe + fresh-user-e2e | trust gate; latency/UX within targets             |
| Post-deploy (live)            | re-run harnesses + read the metrics view        | confirm no regression on real traffic             |
| Continuous                    | `advisor_turn_metrics`                          | watch fallback rate, validation failure rate, p95 |

**Rule:** no change near a safety boundary ships without a test proving the gate still holds; loosening a
gate to cut false positives must be surgical and tested (precedent: the two Compliance carve-outs that
restored fallback to 0% without weakening safety).

---

## 10. How this framework validates the lifecycle docs

Each lifecycle doc's invariants map to a measurable gate or metric here, so the architecture review is
_checkable_, not just narrative:

| Lifecycle      | Validated by                                                                             |
| -------------- | ---------------------------------------------------------------------------------------- |
| Fact           | trust gate (no fabricated numbers, candidate≠confirmed, no resurrection) + observability |
| Risk           | trust gate (no evidence-free / archetype risks) + coverage (seeded data)                 |
| Recommendation | trust gate (no rec w/o evidence) + coverage + recommendation quality                     |
| Relationship   | trust gate (citation contract) + grounded-graph coverage                                 |
| Decision       | trust gate (advice boundary) + quality (evasiveness, context use) + decision golden-set  |

**Architecture-review "pass" criteria (this sprint):** a new engineer can, for every entity type, point to
(a) its states + transitions + owning agents, (b) its invariants, and (c) the metric/gate that proves each
invariant — and can name the measurement gaps (coverage, golden sets, cross-turn carry, freshness) that the
build phase must close.

---

## 11. Known measurement gaps (the honest backlog)

1. **Coverage is unmeasured** — need data-rich + seeded-graph personas.
2. **No golden sets yet** — quality regression relies on deterministic checks + sampled human review.
3. **Confidence calibration** — needs the recommendation feedback loop (adoption/outcome).
4. **Cross-turn context** — decision/fact carry across turns isn't measured because it isn't fully built.
5. **Per-turn retrieval-set logging** — we log counts, not the exact node/edge/doc ids used.
6. **Critic** — the adversarial high-stakes check isn't built, so its eval doesn't exist yet.

---

## 12. Definition of done (evaluation-framework architecture)

A new engineer can answer: what does "good" mean for LIOS, which metrics are gates vs. graded, which
harnesses produce them, what the golden sets will be, when evals run and what blocks a release, and exactly
which measurement gaps remain — so the build phase is steered by evidence, not vibes.
