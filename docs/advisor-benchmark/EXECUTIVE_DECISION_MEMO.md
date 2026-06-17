# Executive Decision Memo — Advisor, Models & LIOS

**Date:** 2026-06-16 · **Audience:** leadership · **Basis:** the Claude Control Experiment + V2–V6 arc +
Workstreams A–L. Evidence-only; identical 50-scenario benchmark, identical 5-judge rubric throughout.

---

## 1. What did the benchmark prove?

- The LifeNavigator advisor improved **5.78 → 6.66** (V2→V6) through prompt/mechanism work alone, **without
  ever breaking trust** (8.5, zero fabrications).
- Swapping **only the model** (Gemini-2.5-flash → Claude Opus 4.1) in the _identical_ pipeline lifted it to
  **7.30 (+0.64)**, improving every quality criterion. **Model capability is a real, primary lever.**
- On turns the pipeline passes, **LN+Claude (8.08) ≈ raw Claude (8.00)** — the platform adds **no quality drag**
  and actively makes Claude **safer** (it caught 3 fabrications raw Claude made → 0 in-pipeline).
- The remaining gap is **not architecture.** It is ~47% model + ~49% the validator's number gate.

## 2. What remains the largest bottleneck?

A tie between two well-localized causes: **(a) model capability** (Gemini's ceiling) and **(b) the validator's
number gate** (all-or-nothing fallbacks + blocking legitimate document/tool/benchmark numbers). Each ≈ half of
the residual gap. Everything else — prompt, composition, compliance, architecture — is ~0%.

## 3. What % of the gap is model / platform / rules / architecture?

(Residual gap, prod 6.66 → ceiling 8.00; see `ROOT_CAUSE_ATTRIBUTION.md`)

- **Model capability: ~47%**
- **Platform — validator number gate: ~49%**
- **Rules — non-number suppression (relationship gate, etc.): ~3%**
- **Prompt / composition / compliance: ~1%**
- **Architecture (LIOS absence): 0%**

## 4. Which models earned production roles?

(see `MODEL_ROLE_QUALIFICATION.md`) — only two are benchmark-evidenced:

- **Gemini-2.5-flash — CONDITIONAL PASS:** fast (12.7s), ~$0.003/turn, trustworthy (8.5), but quality-capped
  at 6.66. The right default for high-frequency/low-stakes turns.
- **Claude Opus 4.1 — CONDITIONAL PASS:** best quality (7.30 in-pipeline) but ~5× slower (61s) and ~40–50×
  costlier → selective high-stakes use only.
- **Claude Sonnet 4.5 — PENDING** (not yet enabled; likely best quality-per-dollar — run the 20-scenario test).
- Gemini Flash-Lite / Gemini Pro — UNTESTED; inferred only.

## 5. Should Claude be integrated?

**Yes — selectively.** It demonstrably beats the incumbent at the advisor role (+0.64, equal trust, safer
numbers), which is exactly the "earn its place" bar. The integration already exists behind the
`USE_VERTEX_CLAUDE` flag. **But not as a blanket model** — latency/cost dictate routing it to high-stakes,
latency-tolerant turns (and testing Sonnet as the cheaper workhorse first).

## 6. Should LIOS Runtime begin?

**No** (see `LIOS_RUNTIME_GATE_REVIEW.md`). 6 of 7 gate requirements pass, but **Advisor ≥ 7.5 is unmet**
(6.66 prod / 7.30 Claude), and the evidence shows LIOS does **not** address either lever behind that gap.

## 7. Which LIOS components are justified today?

(see `LIOS_FEATURE_JUSTIFICATION_MATRIX.md`) — the components that already exist in prod (Relationship Manager,
Recommendation Engine, Compliance Layer, Memory, GraphRAG) are justified and working. **Every _new_ LIOS
component — LIOS-orchestrator, Critic, Decision Engine, Scenario Engine, Domain Agents — is UNPROVEN against
the benchmark.** None maps to a measured weakness. Build none of them yet.

## 8. What is the highest-ROI next sprint?

**Number-Gate Refinement + Selective Claude Routing — re-benchmark.** (~49% + ~47% of the gap, the only two
levers.)

- Number gate (pure engineering, 0 trust cost): admit document-derived, tool-generated, and verified-derivation
  numbers into `allowed_numbers`; strip-not-reject the offending number instead of dropping the whole turn;
  allow benchmark figures labeled as general guidance. Recovers ~0.7 pt.
- Routing: default Gemini; escalate high-stakes advisory turns to Claude (Sonnet pending test). Recovers ~0.64.
- Projected re-benchmark: Gemini+gate-fix ≈ 7.0–7.2; Claude+gate-fix ≈ 8.0 → **clears 7.5**.

## 9. What should NOT be built yet?

- **LIOS Runtime Phase 1**, the LIOS-orchestrator, multi-agent execution, Critic, Decision Engine, Scenario
  Engine, new Domain Agents — all 0%-attributable / UNPROVEN.
- **A blanket Opus swap** — 5× latency, ~50× cost for +0.64.
- **Sonnet in production on estimate alone** — run the 20-scenario test first.

## 10. Recommended roadmap

**Beta (now):** keep **V6 on Gemini** in production (6.66, trust 8.5, 0 fab, 12.7s — the best trustworthy,
fast, cheap option). It is a credible decision-partner that ties Claude on trust and beats it on question
quality. Ship beta on it.

**Next sprint (highest ROI):** Number-Gate Refinement (engineering) + enable & test **Claude Sonnet** (20-scenario
economic run) + stand up **selective Claude routing** for high-stakes turns. Re-run the identical benchmark.

**Multi-model routing:** adopt the per-role plan in `LIOS_MODEL_ROUTING_PROPOSAL.md` — Gemini for
discovery/classification/compliance/high-frequency chat; Claude (Sonnet→Opus) for decision analysis, tradeoffs,
report writing, executive review, critic.

**Claude integration:** already built behind the flag; promote to selective production routing after the Sonnet
economic test and the number-gate fix.

**LIOS:** gated. Re-review `LIOS_RUNTIME_GATE_REVIEW.md` only after the advisor clears 7.5 via the two real
levers. Even then, build LIOS components one at a time, each only when it earns a JUSTIFIED rating against a
measured weakness — not as a wholesale program.

---

### One-line verdict

**Model + number-gate are the whole game; architecture is not. Ship beta on Gemini-V6 now, fix the number gate
and route high-stakes turns to Claude (test Sonnet first), re-benchmark to clear 7.5 — and do not start LIOS
until the evidence demands a specific component.**

### Document index (this program)

`CLAUDE_CONTROL_EXPERIMENT.md` · `MODEL_CAPABILITY_ANALYSIS.md` (A) · `RULE_INVENTORY.md` (B) ·
`SUPPRESSION_ANALYSIS.md` (C) · `TOP_25_RULES_BY_IMPACT.md` (D) · `NUMBER_GATE_FORENSICS.md` (E) ·
`LIOS_FEATURE_JUSTIFICATION_MATRIX.md` (F) · `MODEL_ROLE_QUALIFICATION.md` (G) ·
`LIOS_MODEL_ROUTING_PROPOSAL.md` (H) · `SONNET_ECONOMIC_ANALYSIS.md` (I) · `ROOT_CAUSE_ATTRIBUTION.md` (J) ·
`LIOS_RUNTIME_GATE_REVIEW.md` (K) · this memo (L). Plus the V3–V6 results and all `raw/*.json` evidence.
