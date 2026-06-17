# Advisor V2 Roadmap

LifeNavigator lost the benchmark (0/50). This ranks the next improvements by **impact on advisor quality**, grounded in the measured gaps. **No architecture, no LIOS, no agents, no Vertex, no Claude-integration** — those are explicitly out of scope until the single advisor is competitive. Every item below is prompt/product-level on the existing advisor.

## The one-sentence diagnosis

The advisor **already computes** the frame, the tradeoffs, the missing info, and the best next move (the P0 "reason before asking" sequence) — and then **throws all of it away except one question.** V2 is mostly about **surfacing the reasoning it already does**, plus letting it commit to grounded counsel.

---

## P0 — do these first (they close the scenario-losing gaps)

### P0.1 — Let the advisor advise (actionability 3.2 → target 7+)

The single highest-impact change. After the frame + question, the advisor should deliver a grounded **"here's how I'd think about this / here's the likely path given what you've told me,"** including a recommended next step — using only grounded inputs, with explicit hedges and "what would change this."

- _Why:_ actionability is the −5.5 gap that produced 0 wins. Users pick the tool that helps them act.
- _Guardrail:_ keep the validator. Advice ≠ fabricated numbers. The model may reason to a recommendation without asserting unprovable figures.

### P0.2 — Surface the decision structure (decision framing 4.5 → 7+, tradeoff discovery 4.3 → 7+)

Output the 2–4 variables that actually decide the question and each option's pull (the internal TRADEOFFS/OBJECTIVES steps), not a single abstract "this is a tradeoff" sentence.

- _Why:_ LN names a tradeoff; Claude maps the decision. The mapping is already computed internally — print it.

### P0.3 — Kill the formulaic opener (executive presence 6.1 → 7.5+)

Eliminate the sticky "You're weighing a significant decision…" / "You've shared a clear snapshot…" stems. Cheapest win on the board — a prompt constraint + a reject-and-regenerate on the stock stem.

- _Why:_ across 50 reads the opener reads as scripted; it's half the executive-presence gap.

### P0.4 — Fix validator false positives (trust: keep 8.3, stop the 5 fallbacks)

Normalize "k/M" notation and allow simple arithmetic of user-stated numbers before the allowed-numbers gate, so the advisor stops rejecting the user's _own_ figures (fin-05 rejected `7000`/`72000` = the user's $7k/$72k).

- _Why:_ 4 of 5 critical losses were fallbacks. This is the only "code" item and belongs to a normal product sprint, not this evidence sprint.

---

## P1 — prove and extend the moat

### P1.1 — Run the benchmark that actually tests LifeNavigator's reason to exist

Build a **loaded-context / multi-turn** benchmark: populate goals + family graph + real financial data, then compare LN against Claude/ChatGPT **given the same context inline.** Personalization (6.1 vs Claude 8.1) was measured cold; LN's memory+graph advantage was never loaded. Until this is run, "personalization is our edge" is unproven.

### P1.2 — Insight injection (insight 4.2 → 6.5+)

The strongest competitor moments were non-obvious one-liners ("children can borrow for college, parents cannot borrow for retirement" — the only ChatGPT win, fin-09). Add a "surface one non-obvious, grounded insight" step to the turn.

### P1.3 — Right-size the question discipline

Keep the one-sharp-question strength (LN's only win, 6.8) but make it **step one of a two-step turn**, not the whole turn. Ask _and_ help in the same message.

---

## P2 — polish

- **P2.1 Time-phasing:** Claude's "This Week / This Month" structure raised actionability; adopt for urgent scenarios (job loss, new baby, medical event).
- **P2.2 Warmth calibration:** brief, genuine acknowledgment on high-stress scenarios (layoff, divorce, special-needs) without therapy clichés.
- **P2.3 Domain depth passes:** the largest deficits clustered in cross-domain + family/estate; targeted prompt exemplars there.

---

## Sequencing & exit criteria

1. Ship **P0.1–P0.4** on the existing advisor (prompt-level + one validator fix).
2. **Re-run this 50-scenario benchmark.** Gate on `BETA_READINESS_REPORT.md` (CONDITIONAL GO ≥ 20/50 wins-or-ties, overall ≥ 7.0, actionability/framing ≥ 6.5, 0 fabrications, ≤1 fallback).
3. Only after CONDITIONAL GO, run **P1.1** (loaded-context benchmark) to validate the personalization moat.
4. **Only after a real GO** consider whether any LIOS/multi-agent/Vertex/Claude work is justified — driven by a _specific_ capability the single advisor provably cannot deliver, not by ambition.

**Do not begin LIOS Runtime Phase 1 until step 2 reaches at least CONDITIONAL GO.**
