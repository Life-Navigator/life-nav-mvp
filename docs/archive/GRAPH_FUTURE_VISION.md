# Life Map — The Storytelling Vision (Destination)

> **Sprint H — Graph Product Decision** · LifeNavigator Elite Pilot Sprint
> This is the _eventual_ vision the pilot's "Coming Soon" teaser (`GRAPH_PILOT_DECISION.md`) points at. It **extends, not duplicates,** the Sprint-G surfacing spec in `GRAPH_STORYTELLING.md` (which covers the near-term layers 0–3 on the existing canvas). Read this for where we are going; read `GRAPH_STORYTELLING.md` for the next concrete graph-UX increment.

---

## The thesis

The moat is the **per-user life model**: cited, no-fabrication relationships across goals, risks, opportunities, documents, recommendations, dependencies, and time. The "Life Map" is how that model becomes _legible in 10 seconds_ — not a graph you study, but a map you _read_. The current 3D force-directed graph (`LifeGraphCanvas.tsx`) is the engine; the Life Map is the experience layered on top of it.

**North-star test:** a person who has never seen the product opens the Life Map and, in 10 seconds, can say one true, specific thing about their own life that they didn't have words for before — and can tap it to see exactly why we believe it.

---

## What the Life Map shows (the seven strata)

All seven are already-modeled entities in `personal_graph` / `build_workspace` / `RecommendationOS` — the vision is _composition and legibility_, not new data.

1. **Goals** — the Life Vision, objectives, and goals at the center of gravity (`_TYPE_MAP` "goal"). The map's anchors.
2. **Risks** — what threatens the goals, visually distinct from goals (today they are same-shape dots; the vision gives them their own glyph and a "threatens →" relationship rendered as a directional, colored edge).
3. **Opportunities** — upside the user hasn't claimed, rendered as reachable-but-not-yet-connected nodes ("one step away from your goal").
4. **Documents** — the will, the policy, the offer letter — as _provenance roots_. A document node visibly _feeds_ the facts and edges derived from it (this is now possible because `advisor_facts.py` made extracted document values citable). "This belief traces to page 3 of your will."
5. **Recommendations** — the rec→evidence→source lineage (`recommendation_lineage`) rendered as a _path of belief_ you can walk from "do this next" back to the raw data.
6. **Dependencies** — what must happen before what. The map's only true sequencing layer ("you can't fund the 529 until the emergency fund is whole").
7. **Future paths** — the speculative layer: _if you do X, these nodes light up_. Rendered as ghosted, clearly-labeled "projected" edges that never masquerade as fact (trust invariant below).

Plus the cross-cutting **timeline** axis: the same map, re-laid-out by time, so the user sees their life as a sequence, not just a structure (the `timeline` view mode in `page.tsx:53-58` is the seed of this).

---

## The experience: a map you read, not a graph you decode

| Today (engine)                      | Life Map (destination)                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Force-directed sphere constellation | A **stable, legible spatial layout** — goals in the center, domains as territories, time as an axis. Memorable, not re-randomized each load. |
| Counts + "Verified edges %" lead    | The user's **life_brief headline + next move** lead (Sprint-G Layer 0).                                                                      |
| Risks = dots like everything else   | Risks/opportunities have **their own glyphs and directional edges** (Sprint-G Layer 1 spotlight is the first step).                          |
| Double-click to drill               | A **guided "Show me" path** through goals → risks → recommendations → sources (Sprint-G Layer 2).                                            |
| Click a node → debug panel          | Click anything → a **"why we believe this" narrative** of provenance + citation (Sprint-G Layer 3, reframed `NodeDetailsPanel`).             |
| Static across data density          | **Density-invariant legibility** — clustering, de-collided labels, and progressive disclosure so it looks premium with 8 nodes or 800.       |
| No projection                       | **Future-path simulation** — "what changes if I do this" as honestly-ghosted projected edges.                                                |

The Sprint-G spec (`GRAPH_STORYTELLING.md`) is _exactly_ the first four rows of that right column, achievable on the existing canvas with zero new infra. This document adds the rows the canvas can't yet do: stable spatial storytelling, the document-as-provenance-root layer, the dependency sequencing layer, future-path projection, and the timeline axis.

---

## "Learn something in 10 seconds" — the staged payoff

- **0–2s:** the headline reads your life back to you (real `life_brief`).
- **2–4s:** the map points at the one thing that matters — the top risk pulses, the next move is highlighted (spotlight).
- **4–7s:** you see the _shape_ — your goals at the center, your documents feeding them, your risks pulling against them.
- **7–10s:** you tap the highlighted thing and read, in plain language, _why we believe it and what data it came from_.

Every second of that is grounded in data we already compute. The work is composition, legibility, and motion design — never fabrication.

---

## Trust invariants (carried forward, non-negotiable)

1. **No edge the advisor can't cite.** The Life Map and the Hybrid Advisor share `derive_graph_relations`; the map never draws a relationship the advisor would refuse to defend.
2. **Projected ≠ real.** Future-path edges are visually and labelically distinct ("projected"), never counted in real metrics, never citable as fact.
3. **Honest emptiness.** A thin life model looks _honestly in-progress_ (completeness signals + "add your X"), never padded with filler nodes.
4. **Provenance is always one tap away.** Every node and edge can answer "why do you believe this?" with a real source.

---

## Why this is a moat, not a feature

Anyone can render a 3D graph. The defensibility is: (a) a **per-user life model** assembled from the user's own accounts, documents, and conversations; (b) **provenance + citation on every claim**, so the map is _trustworthy_ in a category where trust is the whole game; and (c) **advisor/graph/report agreement** — the same relations power chat, the graph, and the PDF reports, so the user's life is _one coherent model_ surfaced three ways. The Life Map is the most legible window into that model. Investors fund the model and the trust; the map is how they _see_ both.

---

## Sequencing (no new infra at any step)

1. **Pilot:** the Life Map _teaser_ hero (`GRAPH_PILOT_DECISION.md`) — narrative lead + real cited edge cards. Ships now, reuse only.
2. **Next increment:** Sprint-G layers 0–3 on the existing canvas (`GRAPH_STORYTELLING.md`) — life_brief lead, spotlight, guided tour, reframed explainability.
3. **Then:** stable spatial layout + label de-collision + density clustering (visual-design work on the existing r3f scene — no new deps required beyond what `three`/`drei` already provide).
4. **Then:** document-as-provenance-root rendering (the data is already citable via `advisor_facts.py`).
5. **Later:** dependency sequencing layer + timeline axis (the `timeline` view mode is the seed).
6. **Vision:** future-path projection, honestly ghosted.

Each step is additive, reuses the existing engine and data, and preserves every trust invariant.
